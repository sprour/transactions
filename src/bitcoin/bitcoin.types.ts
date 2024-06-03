import { IsBoolean, IsNotEmpty, IsNumber, ValidateNested } from 'class-validator';
import { Type } from 'class-transformer';

export class AzureKeyDto {
  @IsNotEmpty()
  keyVaultId: string;
  @IsNotEmpty()
  keyVaultVersion: string;
}

export class BitcoinAddressDto {
  @ValidateNested()
  @Type(() => AzureKeyDto)
  azureKey: AzureKeyDto;
  @IsBoolean()
  isSegwit: boolean;
}

export class FeeRequestDto {
  @IsNotEmpty()
  public fromAddress: string;
  @IsNotEmpty()
  amount: string;
}

export class AddressDto {
  @IsNotEmpty()
  public address: string;
}

export class BitcoinPaymentDto {
  @ValidateNested()
  @Type(() => AzureKeyDto)
  public azureKey: AzureKeyDto;
  @IsNotEmpty()
  public fromAddress: string;
  @IsNotEmpty()
  public toAddress: string;
  @IsNotEmpty()
  public amount: string;
}

export class SendTransactionResponseDto {
  constructor(public txHash: string, public txFee: string) {
  }
}

export enum AddressType {
  P2PKH = 'P2PKH',
  P2SH = 'P2SH',
  P2WPKH = 'P2WPKH',
}

export enum NetWorkType {
  mainNet = 'mainNet',
  testNet = 'testNet',
}

export interface RawUtxo {
  txid: string;
  vout: number;
  status: {
    confirmed: boolean;
    block_height: number;
    block_hash: string;
    block_time: number;
  };
  value: number;
}

export class Utxo {
  constructor(
    public txId: string,
    public vout: number,
    public value: number,
  ) {
  }
}

export interface OutputItem {
  address: string;
  value: number;
}

// https://github.com/bitcoinjs/bitcoinjs-lib/issues/1478
/*
witnessUtxo can be created by most blockchain explorers, since it's just the amount of the utxo and the output's scriptPubkey.
nonWitnessUtxo is just the full raw transaction, so 2 steps: 1. get utxos. 2. for any non-segwit utxos, fetch raw tx from separate API endpoint.
it will take much longer. but it's possible.
 */
export class WitnessUtxo {
  constructor(
    public publicKey: string,
    public script: string,
    public value: number) {
  }
}

export class NonWitnessUtxo {
  constructor(
    public nonWitnessUtxo: string,
    public value: number) {
  }
}

export interface TxInputItem {
  hash: string;
  index: number;
  utxo: WitnessUtxo | NonWitnessUtxo;
}

export interface Destination {
  to: string;
  amount: number; // sat unit
  fee: number;
  changeAddress: string;
}

export class TxData {
  constructor(public inputs: TxInputItem[], public outputs: OutputItem[] | Destination) {
  }
}

export interface Result {
  r: string;
  s: string;
  recId: number;
}

export interface SignProvider {
  sign: (hex: string) => Promise<Result>;
}

export interface SignProviderBuffer {
  sign: (hex: string) => Promise<Buffer>;
}

export interface SignProviderSync {
  sign: (hex: string) => Result;
}

export interface KeyProvider extends SignProviderBuffer {
  publicKey: string;
}
