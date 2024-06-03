import { utxoScore } from './utils';

export const score = (feeRate) => {
    return (a, b) => {
        const difference = utxoScore(a, feeRate) - utxoScore(b, feeRate);
        if (difference === 0) {
            return a.i - b.i;
        }
        return -difference;
    };
}
