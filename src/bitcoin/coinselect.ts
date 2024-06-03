import { split } from '../lib/coinselect-lib/outputs/split';
import { coinselect2 } from '../lib/coinselect-lib';
import { transactionBytes } from '../lib/coinselect-lib/utils';
import { isCashAddress, toLegacyAddress } from 'bchaddrjs';
import * as bitcoinJs from 'bitcoinjs-lib';
import { Network as BitcoinJsNetwork } from 'bitcoinjs-lib';
import { OutputItem, RawUtxo } from './bitcoin.types';
import { BusinessLogicError } from '../common/errors';

// https://bitzuma.com/posts/making-sense-of-bitcoin-transaction-fees/ - Description of transaction size
const SEGWIT_INPUT_SCRIPT_LENGTH = 51; // actually 50.25, but let's make extra room
const INPUT_SCRIPT_LENGTH = 106;
const P2PKH_OUTPUT_SCRIPT_LENGTH = 25;
const P2SH_OUTPUT_SCRIPT_LENGTH = 23;
const P2WPKH_OUTPUT_SCRIPT_LENGTH = 22;
const P2WSH_OUTPUT_SCRIPT_LENGTH = 34;

export interface InputOut {
  txId: string;
  vout: number;
  script: {
    length: number;
  };
  value: number;
}

interface OutputIn {
  value?: number;
  script: {
    length: number;
  };
}

export interface OutputOut {
  value: number;
  script?: {
    length: number,
  };
}

export class CoinResult {
  constructor(public inputs: InputOut[],
              public outputs: OutputOut[],
              public fee: number) {
  }
}

export class CompleteResult {
  constructor(public inputs: InputOut[],
              public outputs: OutputOut[],
              public fee: number,
              public feePerByte: number,
              public bytes: number,
              public totalSpent: number,
              public max: number,
  ) {
  }
}

export const coinSelect = (
  utxos: RawUtxo[],
  rOutputs: OutputItem[],
  feeRate: number,
  isSegwit: boolean,
  countMax: boolean,
  network: BitcoinJsNetwork,
  ): CompleteResult => {
    const inputs = convertInputs(utxos, isSegwit);
    const outputs = convertOutputs(rOutputs, network);
    const dustThres = dustThreshold(feeRate, isSegwit);

    const options = {
      inputLength: isSegwit ? SEGWIT_INPUT_SCRIPT_LENGTH : INPUT_SCRIPT_LENGTH,
      changeOutputLength: isSegwit ? P2SH_OUTPUT_SCRIPT_LENGTH : P2PKH_OUTPUT_SCRIPT_LENGTH,
      dustThreshold: dustThres,
    };

    const algorithm = countMax ? split : coinselect2;
    const result = algorithm(inputs, outputs, feeRate, options);

    if (!result.inputs) {
      throw new BusinessLogicError('Not enough balance');
    }

    const {fee} = result;
    let maxAmount = 0;
    if (countMax && result.outputs[1]) {
      maxAmount = result.outputs[1].value;
    }

    const totalSpent = (result.outputs
        .filter((output, i) => i !== rOutputs.length)
        .map(o => o.value)
        .reduce((a, b) => a + b, 0)
    ) + result.fee;

    const allSize = transactionBytes(result.inputs, result.outputs);
    const feePerByte = fee / allSize;

    return new CompleteResult(result.inputs, result.outputs, result.fee, feePerByte, allSize, totalSpent, maxAmount);
  }
;

export const convertInputs = (
  rUtxo: RawUtxo[],
  segwit: boolean,
): InputOut[] => {
  const bytesPerInput = segwit ? SEGWIT_INPUT_SCRIPT_LENGTH : INPUT_SCRIPT_LENGTH;
  return rUtxo.map((input) => ({
    txId: input.txid,
    vout: input.vout,
    script: {length: bytesPerInput},
    value: input.value,
    confirmed: input.status.confirmed,
  }));
};

const dustThreshold = (feeRate: number, segwit: boolean): number => {
  const bytesPerInput = segwit ? SEGWIT_INPUT_SCRIPT_LENGTH : INPUT_SCRIPT_LENGTH;
  return bytesPerInput * feeRate;
};

export const convertOutputs = (
  outputs: OutputItem[],
  network: BitcoinJsNetwork,
): OutputIn[] => {
  return outputs.map((output) => {
    return {
      value: output.value,
      address: output.address,
      script: getScriptAddress(output.address, network),
    };
  });
};

export const getScriptAddress = (address: string, network: BitcoinJsNetwork): { length: number } => {
  if (!address) {
    return {length: P2PKH_OUTPUT_SCRIPT_LENGTH};
  }

  let pubkeyhash;
  const bech = isBech32(address);
  if (!bech) {
    const decoded = bitcoinJs.address.fromBase58Check(convertCashAddress(address));
    pubkeyhash = decoded.version === network.pubKeyHash;
  } else {
    const decoded = bitcoinJs.address.fromBech32(address);
    pubkeyhash = decoded.data.length === 20;
  }

  const becLength = pubkeyhash ? P2WPKH_OUTPUT_SCRIPT_LENGTH : P2WSH_OUTPUT_SCRIPT_LENGTH;
  const norLength = pubkeyhash ? P2PKH_OUTPUT_SCRIPT_LENGTH : P2SH_OUTPUT_SCRIPT_LENGTH;
  const length = bech ? becLength : norLength;
  return {length};
};

function convertCashAddress(address: string) {
  try {
    if (isCashAddress(address)) {
      return toLegacyAddress(address);
    }
  } catch (e) {
    // nothing
  }
  return address;
}

function isBech32(address: string): boolean {
  try {
    bitcoinJs.address.fromBech32(address);
    return true;
  } catch (e) {
    return false;
  }
}
