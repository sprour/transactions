import { AzureService } from './azure.service';
import { Logger } from '@nestjs/common';
import { TechnicalError } from '../common/errors';
const BN = require('bn.js');

const curveOrderBuffer = Buffer.from('FFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFEBAAEDCE6AF48A03BBFD25E8CD0364141', 'hex');
const CURVE_ORDER = new BN(curveOrderBuffer);
const HALF_CURVE_ORDER = CURVE_ORDER.clone().ishrn(1);

export class AzureSignerAsync {
  private logger = new Logger('AzureSignerAsync');

  constructor(public publicKey: string,
              private azureService: AzureService,
              private keyVaultId: string,
              private  keyVaultVersion: string) {
  }

  public async sign(hash: string): Promise<Buffer> {
    try {
      const input = Buffer.from(hash, 'hex');
      const response = await this.azureService.signTransaction(input, this.keyVaultId, this.keyVaultVersion);
      const result = response.result;
      return this.makeCanonical(result);
    } catch (e) {
      this.logger.error(e);
      throw new TechnicalError('Failed to sign inputs');
    }
  }

  private makeCanonical(buffer) {
    const r = new BN(buffer.slice(0, 32));
    let s = new BN(buffer.slice(32, 64));

    if (this.isHigh(s)) {
      s = CURVE_ORDER.sub(s);
    }

    return Buffer.concat([r.toBuffer(), s.toBuffer()]);
  }

  isHigh(num) {
    return num.ucmp(HALF_CURVE_ORDER) === 1;
  }
}
