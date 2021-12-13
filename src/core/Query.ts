import 'reflect-metadata';
import { PublicKey } from '@solana/web3.js';
import { Commitment, DataSlice, MemcmpFilter, MemcmpTarget } from './types';
import ProgramObject from './ProgramObject';
import Account from './Account';
import { Program, Solana } from '..';

const b58 = require('b58');

/**
 * Helper class for building program account queries.
 */
export default class Query<T extends ProgramObject> {
  private programId: PublicKey;
  private commitmentLevel: Commitment | null = null;
  private memcmpFilters: Array<MemcmpFilter> = [];
  private dataSizeFilter: number | null = null;
  private dataSlice: DataSlice | null = null;

  // eslint-disable-next-line no-unused-vars
  private dtype: new (data: any) => T;

  // eslint-disable-next-line no-unused-vars
  constructor(program: Program, dtype: new (data: any) => T) {
    this.programId = program.id;
    this.dtype = dtype;
    this.size(Reflect.getMetadata('space', dtype));
  }

  public memcmp(offset: number, bytes: MemcmpTarget): Query<T> {
    let byteStr: string = '';
    if (bytes instanceof Buffer) {
      byteStr = b58.encode(bytes);
    } else if (typeof bytes === 'number') {
      // assume it's a single byte
      byteStr = byteStr = b58.encode(Buffer.from([bytes]));
    } else if (bytes instanceof Array || bytes instanceof Uint8Array) {
      byteStr = b58.encode(Buffer.from(bytes));
    } else if (bytes instanceof PublicKey) {
      byteStr = bytes.toBase58();
    } else {
      byteStr = bytes.toString();
    }
    this.memcmpFilters.push({ offset, bytes: byteStr });
    return this;
  }

  public match(target: { [key: string]: any }): Query<T> {
    const offsets = Reflect.getMetadata('offsets', this.dtype);
    Object.entries(target).forEach(([name, bytes]) => {
      const offset = offsets[name]!;
      this.memcmp(offset, bytes);
    });
    return this;
  }

  public slice(offset: number | null, length: number | null): Query<T> {
    this.dataSlice = { offset, length };
    return this;
  }

  public commitment(commitment: Commitment | null): Query<T> {
    this.commitmentLevel = commitment;
    return this;
  }

  public size(dataSize: number | null = null): Query<T> {
    this.dataSizeFilter = dataSize;
    return this;
  }

  public async execute(): Promise<Array<Account<T>>> {
    // init config object expected by web3.js
    let config: { [key: string]: any } = {
      filters: [],
    };
    // add memcmp filters
    if (this.memcmpFilters.length) {
      this.memcmpFilters.forEach((filter) =>
        config.filters.push({ memcmp: filter }),
      );
    }
    // add dataSize filter
    if (this.dataSizeFilter !== null) {
      config.filters.push({ dataSize: this.dataSizeFilter });
    }
    // add dataSlice (i.e. byte range in account data)
    if (this.dataSlice !== null) {
      config.dataSlice = {};
      if (this.dataSlice.offset !== null) {
        config.dataSlice.offset = this.dataSlice.offset;
      }
      if (this.dataSlice.length !== null) {
        config.dataSlice.length = this.dataSlice.length;
      }
    }
    // set account commitment level
    if (this.commitmentLevel !== null) {
      config.commitment = this.commitmentLevel;
    }
    // fetch list of objects with form: {[pubkey: Pubkey], [account:
    // AccountInfo]}. then process each result into a corresponding
    // solana-program Account, deserializing its raw data buffer.
    return (
      await Solana.conn.getParsedProgramAccounts(this.programId, config)
    ).map((result: any) => {
      const data = new this.dtype(result.account.data);
      return new Account<T>(result.pubkey, result.account, data);
    });
  }
}
