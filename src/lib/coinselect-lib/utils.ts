// baseline estimates, used to improve performance
import { CoinResult } from '../../bitcoin/coinselect';

const TX_EMPTY_SIZE = 4 + 1 + 1 + 4 + 1;
// 8 bytes start, 2 times 1 byte nonce in/out, 1 extra byte for segwit start

const TX_INPUT_BASE = 32 + 4 + 1 + 4;
const TX_OUTPUT_BASE = 8 + 1;

export const inputBytes = (input) => {
  if (input.script.length == null) {
    throw new Error('Null script length');
  }
  return TX_INPUT_BASE + input.script.length;
};

export const outputBytes = (output) => {
  if (output.script.length == null) {
    throw new Error('Null script length');
  }
  return TX_OUTPUT_BASE + output.script.length;
};

export const dustThreshold = (
  feeRate,
  inputLength,
  outputLength,
  explicitDustThreshold,
) => {
  const size = transactionBytes([
    {
      script: {
        length: inputLength,
      },
    },
  ], [
    {
      script: {
        length: outputLength,
      },
    },
  ]);
  const price = size * feeRate;
  return Math.max(explicitDustThreshold, price);
};

export const transactionBytes = (inputs: any, outputs: any) => {
  return TX_EMPTY_SIZE
    + inputs.reduce((a, x) => a + inputBytes(x), 0)
    + outputs.reduce((a, x) => a + outputBytes(x), 0);
};

export const uintOrNaN = (v) => {
  if (typeof v !== 'number') {
    return NaN;
  }
  if (!Number.isFinite(v)) {
    return NaN;
  }
  if (Math.floor(v) !== v) {
    return NaN;
  }
  if (v < 0) {
    return NaN;
  }
  return v;
};

export const sumForgiving = (range) => {
  return range.reduce((a, x) => a + (Number.isFinite(x.value) ? x.value : 0), 0);
};

export const sumOrNaN = (range) => {
  return range.reduce((a, x) => a + uintOrNaN(x.value), 0);
};

export const finalize = (
  inputs,
  outputsO,
  feeRate,
  inputLength,
  changeOutputLength,
  explicitDustThreshold?,
): CoinResult => {
  let outputs = outputsO;
  const bytesAccum = transactionBytes(inputs, outputs);
  const blankOutputBytes = outputBytes({script: {length: changeOutputLength}});
  const feeAfterExtraOutput = feeRate * (bytesAccum + blankOutputBytes);
  const remainderAfterExtraOutput = sumOrNaN(inputs) - (sumOrNaN(outputs) + feeAfterExtraOutput);
  let fee;
  // is it worth a change output?
  if (remainderAfterExtraOutput > dustThreshold(
    feeRate,
    inputLength,
    changeOutputLength,
    explicitDustThreshold,
  )) {
    outputs = outputs.concat({
      value: remainderAfterExtraOutput,
      script: {
        length: changeOutputLength,
      },
    });
  }

  fee = sumOrNaN(inputs) - sumOrNaN(outputs);
  if (!Number.isFinite(fee)) {
    fee = feeRate * bytesAccum;
    return new CoinResult(inputs, outputs, fee);
  }
  return new CoinResult(inputs, outputs, fee);
};

// export const anyOf = (algorithms) => {
//   return (utxos, outputs, feeRate, inputLength, outputLength) => {
//     let result = {fee: Infinity, inputs: []};
//
//     // tslint:disable-next-line:prefer-for-of
//     for (let i = 0; i < algorithms.length; i++) {
//       const algorithm = algorithms[i];
//       result = algorithm(utxos, outputs, feeRate, inputLength, outputLength);
//       if (result.inputs) {
//         return result;
//       }
//     }
//
//     return result;
//   };
// };

export const utxoScore = (x, feeRate) => {
  return x.value - (feeRate * inputBytes(x));
};
