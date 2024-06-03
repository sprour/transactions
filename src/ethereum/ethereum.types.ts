import { AzureKeyDto } from '../bitcoin/bitcoin.types';
import { IsNotEmpty, IsNumber, IsObject, IsString, ValidateNested } from 'class-validator';
import { Type } from 'class-transformer';
import { number } from 'bitcoinjs-lib/types/script';
import { getTransaction } from './ethereum.utils';

export class Erc20MaxAmountDto {
  @IsNotEmpty()
  symbol: string;
  @IsNotEmpty()
  contractAddress: string;
  @IsNotEmpty()
  address: string;

  constructor(symbol: string, contractAddress: string, address: string) {
    this.symbol = symbol;
    this.contractAddress = contractAddress;
    this.address = address;
  }
}

export class Erc20PreviewDto {
  @IsNotEmpty()
  public symbol: string;
  @IsNotEmpty()
  public decimals: string;
  @IsNotEmpty()
  public contractAddress: string;
  @IsNotEmpty()
  public fromAddress: string;
  @IsNotEmpty()
  public toAddress: string;
  @IsNotEmpty()
  public amount: string;
  @IsNotEmpty()
  public gasPrice: string;
}

export class Erc20PaymentDto extends Erc20PreviewDto {
  @ValidateNested()
  @Type(() => AzureKeyDto)
  public azureKey: AzureKeyDto;
}

export class EthPreviewDto {
  @IsNotEmpty()
  public fromAddress: string;
  @IsNotEmpty()
  public amount: string;
  @IsNotEmpty()
  public gasPrice: string;
}

export class EthPaymentDto {
  @ValidateNested()
  @Type(() => AzureKeyDto)
  public azureKey: AzureKeyDto;
  @IsNotEmpty()
  public fromAddress: string;
  @IsNotEmpty()
  public toAddress: string;
  @IsNotEmpty()
  public amount: string;
  @IsNotEmpty()
  public gasPrice: string;
}

export class TxDetails {
  toAddress: string;
  weiAmount: string;
  gas: {
    price: string,
    limit: string
  };
  nonce: number;
  data: string;
}

export interface TxSignature {
  r: Buffer;
  s: Buffer;
  v: Buffer;
}
