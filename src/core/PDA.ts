import { PublicKey } from '@solana/web3.js';

export default class PDA extends Array<any> {
  public readonly seeds: Array<any>;

  constructor(key: PublicKey, nonce: number, seeds: Array<any>) {
    super();
    this.push(key);
    this.push(nonce);
    this.seeds = seeds;
  }

  get key(): PublicKey {
    return this[0];
  }

  get nonce(): number {
    return this[1];
  }
}
