import * as sorts from './sorts';
import { accumulative } from './inputs/accumulative';
import { CoinResult } from '../../bitcoin/coinselect';

export const coinselect2 = (inputs, outputs, feeRate, options): CoinResult => {
  const sortedInputs = inputs.sort(sorts.score(feeRate));
  return accumulative(sortedInputs, outputs, feeRate, options);
};
