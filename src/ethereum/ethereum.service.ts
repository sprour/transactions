import { Injectable, Logger } from '@nestjs/common';
import { AzureKeyDto } from '../bitcoin/bitcoin.types';
import { AzureService } from '../azure/azure.service';
import {
  amountToWei,
  erc20Balance,
  ethBalance,
  fromGweiToWei,
  fromWeiToEther,
  getErc20Contract, getErc20TransactionData,
  getEthereumAddress,
  getTransaction,
  getTransactionCount, sendEthTransaction, signTransaction,
  validateContractAddress,
  validateErc20Transaction,
  validateEthereumAddress,
  validateEthTransaction,
} from './ethereum.utils';
import { GasPriceService } from './gas-price.service';
import { TechnicalError } from '../common/errors';
import Transaction from 'ethereumjs-tx';

import BN from 'bn.js';
import BigNumber from 'bignumber.js';
import { Erc20PaymentDto, Erc20PreviewDto, EthPaymentDto, EthPreviewDto } from './ethereum.types';

export class EthAddressResponse {
  constructor(public address: string) {
  }
}

@Injectable()
export class EthereumService {
  private logger = new Logger('EthereumService');

  constructor(private azureService: AzureService, private gasPriceService: GasPriceService) {
  }

  async getAddress(azureKeyDto: AzureKeyDto): Promise<EthAddressResponse> {
    const keyBundle = await this.azureService.getKey(azureKeyDto.keyVaultId, azureKeyDto.keyVaultVersion);
    const address = getEthereumAddress(keyBundle.key.x, keyBundle.key.y);
    return new EthAddressResponse(address);
  }

  validateAddress(cryptoAddress: string): void {
    validateEthereumAddress(cryptoAddress);
  }

  async getMaximumEthTransactionSize(address: string): Promise<{ txAmount: string }> {
    try {
      const gasLimit = 150000;
      const balance = await ethBalance(address);
      const weiBalance = new BN((balance).toString());
      const {fast} = await this.gasPriceService.getPrices();
      const gweiTxFee = gasLimit * fast;
      const weiTxFee = new BN(fromGweiToWei(gweiTxFee.toString()));

      if (weiBalance.lte(weiTxFee)) {
        return {
          txAmount: '0',
        };
      }

      const weiAmount = (weiBalance.sub(weiTxFee)).toString();
      const txAmount = fromWeiToEther(weiAmount);

      return {
        txAmount: txAmount.toString(),
      };
    } catch (error) {
      this.logger.error(`Exception in getMaximumEthTransactionSize. Address: ${address}. Error: ${error.toString()} `);
      throw new TechnicalError(`Failed to calculate ETH max balance for address ${address}`);
    }
  }

  async getMaximumErc20TransactionSize(symbol: string, contractAddress: string, address: string): Promise<{ txAmount: string }> {
    try {
      contractAddress = validateContractAddress(contractAddress);
      address = validateEthereumAddress(address);
      const contract = getErc20Contract(symbol, contractAddress, address);

      if (typeof contract.methods.decimals !== 'function') {
        throw new TechnicalError(` ${contract.options.address} doesn't have decimals method`);
      }
      const decimals: number = await contract.methods.decimals().call();
      const balance = await erc20Balance(address, contract);
      const weiBalance = new BigNumber(balance);
      const decimal = Math.pow(10, decimals).toString();
      const txAmount = weiBalance.div(new BigNumber(decimal)).toFixed();
      return {txAmount};
    } catch (error) {
      this.logger.error(error.message.message);
      throw new TechnicalError(`Failed to calculate max balance for address ${address} with currencyCode ${symbol}`);
    }

  }

  async previewErc20(erc20PaymentDto: Erc20PreviewDto): Promise<{ txFee: string }> {
    const {symbol, decimals, contractAddress, fromAddress, toAddress, amount, gasPrice} = erc20PaymentDto;
    let defaultAmount = amount;

    if (typeof amount === 'undefined' || amount === null) {
      defaultAmount = '0.1';
    }

    const weiAmount = amountToWei(defaultAmount.toString(), decimals);
    const {txFee} = await validateErc20Transaction(symbol, contractAddress, fromAddress, toAddress, weiAmount, gasPrice);

    return {
      txFee,
    };
  }

  async previewEth(ethPreviewDto: EthPreviewDto): Promise<{ txFee: string }> {
    const {fromAddress, amount, gasPrice} = ethPreviewDto;

    const {txFee} = await validateEthTransaction(fromAddress, amount, gasPrice);
    return {
      txFee,
    };
  }

  async sendEth(ethPaymentDto: EthPaymentDto): Promise<{ txHash: string, txFee: string }> {
    const {azureKey, fromAddress, toAddress, amount, gasPrice} = ethPaymentDto;
    validateEthereumAddress(toAddress);
    const {gasLimit, txFee} = await validateEthTransaction(fromAddress, amount, gasPrice);
    const weiAmount = amountToWei(amount.toString(), '18');
    const gas = {price: gasPrice, limit: gasLimit};
    const nonce = await getTransactionCount(fromAddress);
    const txDetails = {
      toAddress,
      weiAmount,
      gas,
      nonce,
      data: '0x',
    };
    const txHash = await this.signAndSendTransaction(txDetails, azureKey);

    return {txHash, txFee};
  }

  async signAndSendTransaction(txDetails, azureKey: AzureKeyDto) {
    const keyVault = {
      client: this.azureService.getClient(),
      uri: this.azureService.getKeyVaultUri(),
      id: azureKey.keyVaultId,
      version: azureKey.keyVaultVersion,
    };

    const tx = getTransaction(txDetails);
    const signature = await signTransaction(tx, keyVault);

    return await sendEthTransaction(tx, signature).catch((e) => {
      if (e.message.includes('"nonce too low"')) {
        this.logger.warn(`Nonce ${txDetails.nonce} too low, retying with ${txDetails.nonce + 1}`);
        txDetails.nonce++;

        return this.signAndSendTransaction(tx, azureKey);
      }

      throw new TechnicalError(e);
    });
  }

  async sendErc20(erc20PaymentDto: Erc20PaymentDto) {
    const {
      azureKey,
      symbol,
      decimals,
      contractAddress,
      fromAddress,
      toAddress,
      amount,
      gasPrice
    } = erc20PaymentDto;
    const weiAmount = amountToWei(amount.toString(), decimals);
    const {gasLimit, txFee} = await validateErc20Transaction(symbol, contractAddress,
      fromAddress, toAddress, weiAmount, gasPrice);
    const contractAbi = getErc20Contract(symbol, contractAddress, fromAddress);
    const nonce = await getTransactionCount(fromAddress);
    const contractData = {
      abi: contractAbi, address: contractAddress
    };
    const transactionData = getErc20TransactionData(symbol, contractData.address, fromAddress, toAddress, weiAmount);
    const gas = {
      price: gasPrice, limit: gasLimit
    };

    const txDetails = {
      toAddress: contractAddress,
      weiAmount,
      gas,
      nonce,
      data: transactionData,
    };
    const txHash = await this.signAndSendTransaction(txDetails, azureKey);
    return {
      txHash, txFee
    };

  }
}
