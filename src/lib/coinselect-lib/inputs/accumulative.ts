import { finalize, inputBytes, sumOrNaN, transactionBytes, uintOrNaN } from '../utils';
import { CoinResult } from '../../../bitcoin/coinselect';

// add inputs until we reach or surpass the target value (or deplete)
// worst-case: O(n)
export const accumulative = (utxos, outputs, feeRate, options): CoinResult => {
  const {changeOutputLength, dustThreshold: explicitDustThreshold, inputLength} = options;
  let fee;
  if (!Number.isFinite(uintOrNaN(feeRate))) {
    return new CoinResult([], [], null);
  }
  let bytesAccum = transactionBytes([], outputs);

  let inAccum = 0;
  const inputs = [];
  const outAccum = sumOrNaN(outputs);

  for (let i = 0; i < utxos.length; ++i) {
    const utxo = utxos[i];
    const utxoBytes = inputBytes(utxo);
    const utxoFee = feeRate * utxoBytes;
    const utxoValue = uintOrNaN(utxo.value);

    // skip detrimental input
    if (utxoFee > utxo.value) {
      if (i === utxos.length - 1) {
        fee = feeRate * (bytesAccum + utxoBytes);
        return new CoinResult(null, null, fee);
      }
    } else {
      bytesAccum += utxoBytes;
      inAccum += utxoValue;
      inputs.push(utxo);

      fee = feeRate * bytesAccum;

      // go again?
      if (!(inAccum < outAccum + fee)) {
        return finalize(
          inputs,
          outputs,
          feeRate,
          inputLength,
          changeOutputLength,
          explicitDustThreshold,
        );
      }
    }
  }
  return new CoinResult(null, null, fee);
};
