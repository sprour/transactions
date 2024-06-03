import { HttpService, Injectable, Logger } from '@nestjs/common';
import { blockStreamConfig } from '../../config/blockstream.config';
import { AxiosResponse } from 'axios';
import { map } from 'rxjs/operators';
import { RawUtxo } from '../../bitcoin/bitcoin.types';
import { BlockStreamTransaction, UtxoInfo } from './blockstream.types';
import { TechnicalError } from '../../common/errors';

@Injectable()
export class BlockStreamService {
  private logger = new Logger('BlockStreamService');
  baseUrl: string;
  network: string;

  constructor(private httpService: HttpService) {
    this.network = blockStreamConfig.network;
    this.baseUrl = blockStreamConfig.baseUrl;
  }

  public async getRawConfirmedUtxo(address: string): Promise<RawUtxo[]> {
    try {
      const url = `${this.baseUrl}/${this.network}/api/address/${address}/utxo`;
      return await this.httpService.get(url)
        .pipe(map((response: AxiosResponse<RawUtxo[]>) => response.data.filter(utxo => utxo.status.confirmed))).toPromise();
    } catch (error) {
      this.logger.error(error.message);
      throw new TechnicalError(`Failed to fetch UTXO for address: ${address}`);
    }
  }

  public async utxoInfo(address: string, utxoTxIds: string[]): Promise<UtxoInfo[]> {
    const utxoInfos: UtxoInfo[] = [];
    const transactions = await this.getTransactions(address);
    transactions.filter(tx => utxoTxIds.includes(tx.txid)).forEach(tx => {
      const blockStreamVout = tx.vout
        .filter(vout => vout.scriptpubkey_address === address)
        .pop();
      utxoInfos.push(new UtxoInfo(tx.txid, blockStreamVout));
    });
    return utxoInfos;
  }

  async feeRate(): Promise<number> {
    try {
      const url = `${blockStreamConfig.feeBaseUrl}/btc/${blockStreamConfig.feeNetwork}`;
      return await this.httpService.get(url)
        .pipe(map((apiResponse: AxiosResponse<any>) => Math.ceil(apiResponse.data.high_fee_per_kb / 1024 / 2)))
        .toPromise();
    } catch (error) {
      this.logger.error(error.message);
      throw new TechnicalError(`Failed to fetch BTC fee rate `);
    }
  }

  async pushRaw(rawTx) {
    try {
      const url = `${this.baseUrl}/${this.network}/api/tx`;
      return await this.httpService.post(url, rawTx).toPromise();
    } catch (error) {
      this.logger.error(error.message);
      throw new TechnicalError(`Failed to send signed transaction`);
    }
  }

  async getTxHex(txId: string): Promise<string> {
    try {
      const url = `${this.baseUrl}/${this.network}/api/tx/${txId}/hex`;
      return await this.httpService.get(url).pipe(map((response: AxiosResponse<string>) => response.data)).toPromise();
    } catch (error) {
      this.logger.error(error.message);
      throw new TechnicalError(`Failed to fetch transaction details: ${txId}`);
    }
  }

  private async getTransactions(address: string): Promise<BlockStreamTransaction[]> {
    try {
      const url = `${this.baseUrl}/${this.network}/api/address/${address}/txs`;
      return await this.httpService.get(url)
        .pipe(map((apiResponse: AxiosResponse<BlockStreamTransaction[]>) => {
          return apiResponse.data;
        }))
        .toPromise();
    } catch (error) {
      this.logger.error(error.message);
      throw new TechnicalError(`Failed to fetch transactions for address: ${address}`);
    }
  }

}
