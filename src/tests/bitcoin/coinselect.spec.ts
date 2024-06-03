import { convertInputs, convertOutputs, getScriptAddress } from '../../bitcoin/coinselect';
import * as bitcoinJs from 'bitcoinjs-lib';

import { toBitcoin } from 'satoshi-bitcoin-ts';
import { OutputItem } from '../../bitcoin/bitcoin.types';
import { legacyRawUtxo } from './fixtures/legacyRawUtxo';
import { split } from '../../lib/coinselect-lib/outputs/split';

const SEGWIT_INPUT_SCRIPT_LENGTH = 51; // actually 50.25, but let's make extra room
const INPUT_SCRIPT_LENGTH = 106;
const P2PKH_OUTPUT_SCRIPT_LENGTH = 25;
const P2SH_OUTPUT_SCRIPT_LENGTH = 23;
const P2WPKH_OUTPUT_SCRIPT_LENGTH = 22;
const P2WSH_OUTPUT_SCRIPT_LENGTH = 34;
const testNet = bitcoinJs.networks.testnet;
describe('Coinselect Transaction size and fee', () => {
  it('getScriptAddress Length of segwit address', () => {
    const scriptAddress = getScriptAddress('2MzJHE6ZNu2ADFosnZkeh4pUBhVyaNsXXTm', testNet);
    expect(scriptAddress.length).toEqual(23);
  });

  it('getScriptAddress', () => {
    const scriptAddress = getScriptAddress('mxgRFH4qTEX1w2DTCdkZs4LKKMhwtB7NCZ', testNet);
    expect(scriptAddress.length).toEqual(25);
  });

  it('Coinselect split Segwit test', () => {
    const outputs: OutputItem[] = [{
      address: null, // '2MzJHE6ZNu2ADFosnZkeh4pUBhVyaNsXXTm',
      value: 0,
    }];
    // const result = coinSelect(utxo, outputs, 10, false, false, 0, 546, bitcoinJs.networks.testnet);
    const options = {
      inputLength: SEGWIT_INPUT_SCRIPT_LENGTH,
      changeOutputLength: P2SH_OUTPUT_SCRIPT_LENGTH,
      dustThreshold: 546,
    };

    const inputs = convertInputs(legacyRawUtxo, true);
    const outputIns = convertOutputs(outputs, testNet);
    const actual = split(inputs, outputIns, 10, options);
    expect(toBitcoin(actual.fee)).toEqual(0.0000261);
  });

  it('Coinselect split Legacy test', () => {
    const outputs: OutputItem[] = [{
      address: 'mxgRFH4qTEX1w2DTCdkZs4LKKMhwtB7NCZ',
      value: 0.02,
    }];
    const options = {
      inputLength: INPUT_SCRIPT_LENGTH,
      changeOutputLength: P2PKH_OUTPUT_SCRIPT_LENGTH,
      dustThreshold: 546,
    };

    const inputs = convertInputs(legacyRawUtxo, false);
    const outputIns = convertOutputs(outputs, testNet);
    const actual = split(inputs, outputIns, 10, options);
    expect(toBitcoin(actual.fee)).toEqual(0.0000339);
    expect(toBitcoin(actual.inputs[0].value)).toEqual(0.1);
    expect(toBitcoin(actual.inputs[1].value)).toEqual(0.3);
    expect(actual.outputs[0].value).toEqual(0.02);
  });
});
