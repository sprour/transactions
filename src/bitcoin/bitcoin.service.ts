import { Injectable, Logger } from '@nestjs/common';

import { AzureService } from '../azure/azure.service';
import * as bitcoin from 'bitcoinjs-lib';
import { Network } from 'bitcoinjs-lib';
import { BlockStreamService } from '../integration/blockstream/blockstream.service';
import { toBitcoin, toSatoshi } from 'satoshi-bitcoin-ts';

import { KeyBundle } from 'azure-keyvault/lib/models';
import { AzureSignerAsync } from '../azure/azureSignerAsync';
import { buildAndSignTransaction, generateAddress, isSegwitAddress, validateAndFinalizeTransaction } from './bitcoin.utils';
import {
  AddressType,
  BitcoinAddressDto,
  BitcoinPaymentDto,
  FeeRequestDto,
  NonWitnessUtxo,
  OutputItem, SendTransactionResponseDto,
  TxData,
  TxInputItem,
  WitnessUtxo,
} from './bitcoin.types';
import { envConfig } from '../config/env.config';
import { coinSelect, InputOut } from './coinselect';

import { BusinessLogicError, TechnicalError } from '../common/errors';
import { UtxoInfo } from '../integration/blockstream/blockstream.types';

/**
 * Check and push raw transaction https://testnet.smartbit.com.au/txs/decodetx
 */
const env = envConfig();

@Injectable()
export class BitcoinService {
  private logger = new Logger('BitcoinService');
  network: Network;

  constructor(private azureService: AzureService, private blockStreamService: BlockStreamService) {
    const networkMode = env.get('NETWORK_MODE');
    this.network = (networkMode === 'test') ? bitcoin.networks.testnet : bitcoin.networks.bitcoin;
  }

  async getAddress(bitcoinAddressDto: BitcoinAddressDto): Promise<string> {
    try {
      const {azureKey, isSegwit} = bitcoinAddressDto;
      this.logger.log(bitcoinAddressDto);
      const publicKey = await this.publicKey(azureKey.keyVaultId, azureKey.keyVaultVersion, isSegwit);
      return (isSegwit)
        ? generateAddress(publicKey, AddressType.P2SH, this.network)
        : generateAddress(publicKey, AddressType.P2PKH, this.network);
    } catch (e) {
      throw new TechnicalError(e.message);
    }
  }

  async calculateFee(feeRequestDto: FeeRequestDto): Promise<number> {
    const address = feeRequestDto.fromAddress;
    const rawUtxo = await this.blockStreamService.getRawConfirmedUtxo(address);
    const outputs = [{
      address: null,
      value: toSatoshi(feeRequestDto.amount),
    }];
    const feeRate = await this.blockStreamService.feeRate();
    const isSegwit = isSegwitAddress(address);
    const result = coinSelect(rawUtxo, outputs, feeRate, isSegwit, false, this.network);
    return toBitcoin(result.fee);
  }

  async calculateMaximumTransactionSize(addressDto: { address: string }): Promise<number> {
    const address = addressDto.address;
    const rawUtxo = await this.blockStreamService.getRawConfirmedUtxo(address);
    const feeRate = Math.floor(await this.blockStreamService.feeRate() * 1.2);
    const outputs = [{
      address,
      value: 0,
    }];
    const isSegwit = isSegwitAddress(address);
    const result = coinSelect(rawUtxo, outputs, feeRate, isSegwit, true, this.network);
    return toBitcoin(result.max);
  }

  async sendTransaction(transactionDto: BitcoinPaymentDto): Promise<SendTransactionResponseDto> {
    try {
      const isSegwit = isSegwitAddress(transactionDto.fromAddress);
      const publicKey = await this.publicKey(transactionDto.azureKey.keyVaultId, transactionDto.azureKey.keyVaultVersion, isSegwit);
      const rawUtxo = await this.blockStreamService.getRawConfirmedUtxo(transactionDto.fromAddress);
      const outputItems: OutputItem[] = [
        {
          address: transactionDto.toAddress,
          value: toSatoshi(transactionDto.amount),
        },
      ];
      const feeRate = await this.blockStreamService.feeRate();
      const coinsResult = coinSelect(rawUtxo, outputItems, feeRate, isSegwit, false, this.network);
      const inputOuts = coinsResult.inputs;

      const txIds: string[] = inputOuts.map(ut => ut.txId);
      const inputInfos = await this.blockStreamService.utxoInfo(transactionDto.fromAddress, txIds);

      const publicKeyHex = publicKey.toString('hex');

      const indexes = {};
      inputOuts.forEach((inputOut: InputOut) => {
        indexes[inputOut.txId] = inputOut.vout;
      });

      const inputs = await this.separateInputTypes(inputInfos, publicKeyHex, indexes);
      const outputs = {
        to: transactionDto.toAddress,
        amount: toSatoshi(transactionDto.amount),
        fee: coinsResult.fee,
        changeAddress: transactionDto.fromAddress,
      };
      const txData = new TxData(inputs, outputs);
      const signer = this.azureSignerAsync(publicKeyHex, transactionDto);
      const psbt = await buildAndSignTransaction(txData, [signer], this.network);
      const tx = validateAndFinalizeTransaction(psbt);
      const axiosResponse = await this.blockStreamService.pushRaw(tx.txHex);
      const txHash = axiosResponse.data;
      const txFee = toBitcoin(coinsResult.fee).toString();
      return new SendTransactionResponseDto(txHash, txFee);
    } catch (err) {
      this.logger.error(err);
      throw new TechnicalError(err.message);
    }
  }

  validateAddress(address) {
    try {
      bitcoin.address.toOutputScript(address, this.network);
    } catch (e) {
      throw new BusinessLogicError('Invalid bitcoin address');
    }
  }

  private azureSignerAsync(publicKeyHex, transactionDto: BitcoinPaymentDto) {
    return new AzureSignerAsync(publicKeyHex, this.azureService, transactionDto.azureKey.keyVaultId, transactionDto.azureKey.keyVaultVersion);
  }

  private async separateInputTypes(inputInfos: UtxoInfo[], publicKeyHex: string, indexes) {
    const inputs: TxInputItem[] = [];
    for (const inputInfo of inputInfos) {
      let utxoType: WitnessUtxo | NonWitnessUtxo;
      const txType = inputInfo.vout.scriptpubkey_type.toUpperCase();
      if (txType === AddressType.P2SH) {
        utxoType = new WitnessUtxo(publicKeyHex, inputInfo.vout.scriptpubkey, inputInfo.vout.value);
      } else if (txType === AddressType.P2PKH) {
        const txHex = await this.blockStreamService.getTxHex(inputInfo.txId);
        utxoType = new NonWitnessUtxo(txHex, inputInfo.vout.value);
      }

      const input = {
        hash: inputInfo.txId,
        index: indexes[inputInfo.txId],
        utxo: utxoType,
      };
      inputs.push(input);
    }
    return inputs;
  }

  public async publicKey(keyVaultId: string, keyVaultVersion: string, isCompressed: boolean): Promise<Buffer> {
    const keyBundle: KeyBundle = await this.azureService.getKey(keyVaultId, keyVaultVersion);
    if (!Object.keys(keyBundle).length || keyBundle.key === undefined) {
      throw new TechnicalError('KeyBundle is empty!');
    }

    const {key: {x, y}} = keyBundle;
    const leading = Buffer.alloc(1, 0x04);

    if (typeof x !== 'undefined' && typeof y !== 'undefined') {
      const publicKey = Buffer.concat([leading, x, y]);
      const ecPair = bitcoin.ECPair.fromPublicKey(publicKey, {compressed: isCompressed});
      return ecPair.publicKey;
    } else {
      throw new Error('Invalid key Bundle');
    }

  }
}
