import { HttpService, Injectable } from '@nestjs/common';
import * as math from 'mathjs';
import { TechnicalError } from '../common/errors';

@Injectable()
export class GasPriceService {

  constructor(private httpService: HttpService) {
  }

  async getPrices() {
    try {
      const rate = await this.httpService.get('https://ethgasstation.info/json/ethgasAPI.json').toPromise();
      const {fastest, fast, safeLow}: { fastest: number, fast: number, safeLow: number } = rate.data;
      return {
        fastest: math.ceil((fastest / 10)),
        fast: math.ceil((fast / 10)),
        slow: math.ceil((safeLow / 10)),
      };
    } catch (e) {
      throw new TechnicalError('Failed to fetch gas prices');
    }

  }
}
