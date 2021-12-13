import { Keypair, PublicKey } from '@solana/web3.js';
import PDA from './PDA';

export enum Commitment {
  // eslint-disable-next-line no-unused-vars
  Finalized = 'finalized',
  // eslint-disable-next-line no-unused-vars
  Confirmed = 'confirmed',
  // eslint-disable-next-line no-unused-vars
  Processed = 'processed',
}

export type DataSlice = {
  offset: number | null;
  length: number | null;
};

export type MemcmpFilter = {
  offset: number;
  bytes: string;
};

export type Seed = string | Buffer | Uint8Array | PublicKey;

export type Address = string | PublicKey | Keypair | PDA;

export type MemcmpTarget =
  | string
  | number
  | Buffer
  | Array<number>
  | Uint8Array
  | PublicKey;
