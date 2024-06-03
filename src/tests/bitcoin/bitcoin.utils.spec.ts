import * as BtcUtil from '../../bitcoin/bitcoin.utils';
import { ECPair, networks, payments } from 'bitcoinjs-lib';

describe('Bitcoin Util', () => {
  it('isSegwitAddress - true if segwit testnet address', () => {
    const actual = BtcUtil.isSegwitAddress('2MzJHE6ZNu2ADFosnZkeh4pUBhVyaNsXXTm');
    expect(actual).toEqual(true);
  });

  it('isSegwitAddress address - false if testnet legacy address', () => {
    const actual = BtcUtil.isSegwitAddress('mxgRFH4qTEX1w2DTCdkZs4LKKMhwtB7NCZ');
    expect(actual).toEqual(false);
  });

});
