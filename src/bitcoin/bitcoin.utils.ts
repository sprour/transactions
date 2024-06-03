import * as bitcoin from 'bitcoinjs-lib';
import { Network } from 'bitcoinjs-lib';
import { Logger } from '@nestjs/common';
import { PsbtBuilder } from './psbt.builder';
import { isP2SHAddress } from 'bchaddrjs';
import { AddressType, KeyProvider, TxData } from './bitcoin.types';

const logger = new Logger('Bitcoin Util');

export const generateAddress = (
  pubkey: any,
  addressType: AddressType = AddressType.P2SH,
  network: bitcoin.Network): string => {
  let btcAddress: string | undefined;
  if (addressType === AddressType.P2PKH) {
    const {address} = bitcoin.payments.p2pkh({pubkey, network});
    btcAddress = address;
  }
  if (addressType === AddressType.P2SH) {
    const {address} = bitcoin.payments.p2sh({
      redeem: bitcoin.payments.p2wpkh({pubkey, network}),
      network,
    });
    btcAddress = address;
  }
  if (addressType === AddressType.P2WPKH) {
    const {address} = bitcoin.payments.p2wpkh({pubkey, network});
    btcAddress = address;
  }
  if (btcAddress) {
    return btcAddress;
  } else {
    throw new Error('Failed to generate BTC address');
  }
};

export const buildAndSignTransaction = async (
  txData: TxData,
  signers: KeyProvider[],
  network: Network,
): Promise<bitcoin.Psbt> => {
  const psbtBuilder = new PsbtBuilder(network);
  const psbt = psbtBuilder
    .addInputsForPsbt(txData)
    .addOutputForPsbt(txData)
    .getPsbt();

  for (const signer of signers) {
    const keyPair = {
      publicKey: Buffer.from(signer.publicKey, 'hex'),
      sign: async (hashBuffer: Buffer) => {
        const hexString = hashBuffer.toString('hex');
        return await signer.sign(hexString);
      },
    };
    await psbt.signAllInputsAsync(keyPair);
  }
  return psbt;
};

export const validateAndFinalizeTransaction = (psbt: bitcoin.Psbt): { txId: string, txHex: string } => {
  const isValid = psbt.validateSignaturesOfAllInputs();
  if (isValid) {
    psbt.finalizeAllInputs();
    const txHex = psbt.extractTransaction().toHex();
    const txId = psbt.extractTransaction().getId();
    return {
      txId,
      txHex,
    };
  }
  throw new Error('signature verification failed');
};

export const isSegwitAddress = (address: string): boolean => {
  return isP2SHAddress(address);
};
