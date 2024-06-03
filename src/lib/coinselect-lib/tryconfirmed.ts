function filterCoinbase(utxos, minConfCoinbase) {
  return utxos.filter((utxo) => {
    if (utxo.coinbase) {
      return utxo.confirmations >= minConfCoinbase;
    }
    return true;
  });
}

function filterUtxos(utxos, minConfOwn, minConfOther) {
  const usable = [];
  const unusable = [];

  // tslint:disable-next-line:prefer-for-of
  for (let i = 0; i < utxos.length; i++) {
    const utxo = utxos[i];

    const isUsed = (utxo.own)
      ? utxo.confirmations >= minConfOwn
      : utxo.confirmations >= minConfOther;

    if (isUsed) {
      usable.push(utxo);
    } else {
      unusable.push(utxo);
    }
  }
  return {
    usable,
    unusable,
  };
}

export const tryConfirmed = (algorithm, options) => {
  return (utxos, outputs, feeRate, optionsIn) => {

    // Filter only confirmed utxo
    // const utxos = filterCoinbase(utxosO, coinbase);
    if (utxos.length === 0) {
      return {};
    }

    const result = algorithm(utxos, outputs, feeRate, optionsIn);
    if (result.inputs) {
      return result;
    }

    // we should never end here
    throw new Error('Unexpected unreturned result');
  };
};
