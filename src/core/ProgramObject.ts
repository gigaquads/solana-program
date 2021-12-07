import 'reflect-metadata';
import * as borsh from 'borsh';
import Solana from './Solana';

/**
 * ProgramObject is a helpful base class for struct-like data structures that
 * exist on both client and server. Essentially, they are serializable and
 * analyzable. For example, you can measure their size in bytes when serialized
 * as a Borsh byte array for the sake of allocating space in accounts. You can
 * also calculate its min deposite size for rent exemption.
 */
export default class ProgramObject {
  // eslint-disable-next-line no-undef
  [key: string]: any;

  constructor(source: any) {
    if (source) {
      if (source instanceof Buffer) {
        this.load(source);
      } else {
        // assume `source` is a plain object
        Object.keys(source).forEach((k: string) => {
          this[k] = source[k];
        });
      }
    }
  }

  /**
   * @return {any} - The borsh schema object built up via `tag` and `field`
   * decorators.
   */
  public get schema(): any {
    return Reflect.getMetadata('schema', this.constructor);
  }

  /**
   * Return size (in bytes) of this object when serialized to buffer.
   * @return {number} - Num bytes.
   */
  public measure(): number {
    return this.toBuffer().length;
  }

  /**
   * Borsh serialize this object to a buffer.
   * @return {Buffer} - The buffer.
   */
  public toBuffer(): Buffer {
    const cls: any = this.constructor;
    const schema = new Map([[cls, this.schema]]);
    // serialize this ProgramObject to byte buffer via Borsh.
    let bytes;
    const adaptors = Reflect.getMetadata('adaptors', this.constructor);
    if (adaptors && Object.keys(adaptors).length > 0) {
      // apply any field value adaptors. an adaptor is a function that takes the
      // native JS property value and returns the data in a form Borsh can
      // understand, like converting a PublicKey object into a Uint8Array.
      const data: { [k: string]: any } = {};
      this.schema.fields.forEach((fieldArr: [string, any]) => {
        const k = fieldArr[0];
        const adapt = adaptors[k].onSerialize;
        data[k] = adapt ? adapt(this[k]) : this[k];
      });
      bytes = borsh.serialize(schema, data);
    } else {
      bytes = borsh.serialize(schema, this);
    }
    return Buffer.from(bytes);
  }

  /**
   * Borsh deserialize a buffer, setting its properties on this message.
   * @param {Buffer} data - The buffer to deserialize into this message.
   */
  public load(data: Buffer): void {
    const Cls: any = this.constructor;
    const schema = new Map([[Cls, this.schema]]);
    const raw: { [k: string]: any } = borsh.deserializeUnchecked(
      schema,
      Cls,
      data,
    );
    if (raw) {
      // get adaptors for custom post-processing of field data
      const adaptors =
        Reflect.getMetadata('adaptors', this.constructor) || null;
      Object.keys(raw).forEach((k: string) => {
        if (raw[k] !== undefined) {
          // apply adaptor to raw deserialized field data
          if (adaptors && adaptors[k]) {
            console.log(k, adaptors[k], raw[k]);
            this[k] = adaptors[k].onDeserialize(raw[k]);
          } else {
            this[k] = raw[k];
          }
        }
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
