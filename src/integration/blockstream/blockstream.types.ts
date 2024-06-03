export class BlockStreamVout {
  scriptpubkey: string;
  scriptpubkey_asm: string;
  scriptpubkey_type: string;
  scriptpubkey_address: string;
  value: number;
}

export class UtxoInfo {
  constructor(public txId: string, public vout: BlockStreamVout) {
  }
}

export class BlockStreamTransaction {
  txid: string;
  vout: BlockStreamVout[];
}

export class BlockStreamWitnessUtxo {
  constructor(public script: string, public value: number, public hash: string, public index: number) {
  }
}
