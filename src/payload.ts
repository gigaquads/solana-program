import * as borsh from 'borsh';
import {Account} from '.';

/**
 * A decorator that registers a class as a Rust enum variant.
 *
 * @param {number} index - Integer offset of the variant in the Rust enum to
 * which the variant belows.
 * @return {Function} - Constructor that stores variant index in class metadata.
 */
export function variant(index: number): Function {
  return function (constructor: Function) {
    Reflect.defineMetadata('variant', index, constructor);
  };
}

/**
 * A decorator that registers a property declared on a class as a serializable
 * field, targeting a specific Rust datatype, like u64, etc.
 *
 * @param {string} type - Rust type, like u8, etc., that we want to
 * (de)serialize this field to/from.
 * @return {Function} - The modified property.
 */
export function field(type: string | Array<string>): Function {
  return function (target: {} | any, name: PropertyKey): any {
    let schema = Reflect.getMetadata('schema', target.constructor);
    if (!schema) {
      schema = {fields: [], kind: 'struct', dependencies: new Set()};
      Reflect.defineMetadata('schema', schema, target.constructor);
    }
    schema.fields.push([name, type]);
  };
}

/**
 * Payload objects are used for sending and receiving Instruction data via their
 * `fromBuffer` and `toBuffer` methods.
 */
export class Payload {
  // eslint-disable-next-line no-undef
  [key: string]: any;

  /**
   * Return a new Payload isntance.
   *
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
  get variant(): number {
    return Reflect.getMetadata('variant', this.constructor);
  }

  /**
   * @return {any} - The borsh schema object built up via `variant` and `field`
   * decorators.
   */
  get schema(): any {
    return Reflect.getMetadata('schema', this.constructor);
  }

  /**
   * Return size of serialized object in bytes.
   * @return {number} - size of buffer upon serialization.
   */
  get space(): number {
    // NOTE: we subtract 1 because the first byte is a "tag", not part of the
    // instance object/struct to be serialized.
    return this.toBuffer().length - 1;
  }

  /**
   * Borsh serialize this message to a buffer. To serialize the object to
   * something we receive as an enum variant in Rust, we set the first byte of
   * the buffer to the index of the variant in the enum.
   *
   * @return {Buffer} - The serialized message as a buffer.
   */
  toBuffer(): Buffer {
    const cls: any = this.constructor;
    const schema = new Map([[cls, this.schema]]);
    const bytes = borsh.serialize(schema, this);
    return Buffer.from(Uint8Array.of(this.variant, ...bytes));
  }

  /**
   * Borsh deserialize a buffer, setting its properties on this message.
   *
   * @param {Buffer} data - The buffer to deserialize into this message.
   */
  fromBuffer(data: Buffer): void {
    const Cls: any = this.constructor;
    const schema = new Map([[Cls, this.schema]]);
    const raw = new Cls(borsh.deserialize(schema, Cls, data));
    if (raw) {
      Object.keys(raw).map((k: string) => {
        this[k] = raw[k];
      });
    }
  }
}
