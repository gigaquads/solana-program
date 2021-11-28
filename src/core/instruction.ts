import 'reflect-metadata';
import * as borsh from 'borsh';
import Account from './Account';
import Solana from './Solana';

/**
 * A decorator that associates the decorated class with a specified "index",
 * used when routing the instruction in the on-chain Solana program.
 * @param {number} index - Integer index to tag the decorated class with.
 * @return {Function} - A new constructor.
 */
export function tag(index: number): Function {
  return function (constructor: Function) {
    Reflect.defineMetadata('tag', index, constructor);
  };
}

/**
 * A decorator that registers a property declared on a class as a serializable
 * field, targeting a specific Rust datatype, like u64, etc.
 * @param {string | Array<string>} type - Rust type name, like 'u8' (or ['u8']
 * for array thereof)
 * @return {Function} - Decorated instance property.
 */
export function field(type: string | Array<string>): Function {
  return function (target: {} | any, name: PropertyKey): any {
    let schema = Reflect.getMetadata('schema', target.constructor);
    if (!schema) {
      schema = { fields: [], kind: 'struct', dependencies: new Set() };
      Reflect.defineMetadata('schema', schema, target.constructor);
    }
    schema.fields.push([name, type]);
  };
}

/**
 * InstructionData objects are used for sending and receiving Instruction data via their
 * `fromBuffer` and `toBuffer` methods.
 */
export class InstructionData {
  // eslint-disable-next-line no-undef
  [key: string]: any;

  /**
   * Return a new InstructionData isntance.
   * @param {any | Account | null} source - Either an account whose data we
   * intend to deserialize into this message's fields or an object containing
   * its fields as properties.
   */
  constructor(source: any | Account | null = null) {
    if (source) {
      if (source instanceof Account) {
        this.fromBuffer(source.info.data);
      } else {
        Object.keys(source).map((k: string) => {
          this[k] = source[k];
        });
      }
    }
  }

  /**
   * @return {number} - The integer offset of this class in its corresponding
   * Rust enum. If this class corresponds to the second enum variant, for
   * example, then we'd expect index == 1.
   */
  public get tag(): number {
    return Reflect.getMetadata('variant', this.constructor);
  }

  /**
   * @return {any} - The borsh schema object built up via `tag` and `field`
   * decorators.
   */
  public get schema(): any {
    return Reflect.getMetadata('schema', this.constructor);
  }

  /**
   * Return size (in bytes) of this InstructionData when serialized via Borsh as
   * a Rust struct.
   * @return {number} - Num bytes.
   */
  public measure(): number {
    // NOTE: we subtract 1 because the first byte is a "tag", not part of the
    // instance object/struct to be serialized.
    return this.toBuffer().length - 1;
  }

  /**
   * Borsh serialize this message to a buffer. To serialize the object to
   * something we receive as an enum variant in Rust, we set the first byte of
   * the buffer to the index of the variant in the enum.
   * @return {Buffer} - The serialized message as a buffer.
   */
  public toBuffer(): Buffer {
    const cls: any = this.constructor;
    const schema = new Map([[cls, this.schema]]);
    const bytes = borsh.serialize(schema, this);
    return Buffer.from(Uint8Array.of(this.tag, ...bytes));
  }

  /**
   * Borsh deserialize a buffer, setting its properties on this message.
   * @param {Buffer} data - The buffer to deserialize into this message.
   */
  public fromBuffer(data: Buffer): void {
    const Cls: any = this.constructor;
    const schema = new Map([[Cls, this.schema]]);
    const raw = new Cls(borsh.deserialize(schema, Cls, data));
    if (raw) {
      Object.keys(raw).map((k: string) => {
        this[k] = raw[k];
      });
    }
  }

  /**
   * Compute min balance required to store this object in its current state in a
   * rent-exempt account.
   * @return {number} - Minimum balance (in Lamports) required.
   */
  public async getMinimumBalanceForRentExemption(): Promise<number> {
    return await Solana.conn.getMinimumBalanceForRentExemption(this.measure());
  }
}
