import 'reflect-metadata';
import * as borsh from 'borsh';
import ProgramObject from './ProgramObject';

/**
 * InstructionData objects are used for sending and receiving Instruction data via their
 * `load` and `toBuffer` methods.
 */
export default class InstructionData extends ProgramObject {
  /**
   * @return {number} - The integer offset of this class in its corresponding
   * Rust enum. If this class corresponds to the second enum variant, for
   * example, then we'd expect index == 1.
   */
  public get tag(): number {
    return Reflect.getMetadata('tag', this.constructor);
  }

  /**
   * Return size (in bytes) of this InstructionData when serialized via Borsh as
   * a Rust struct.
   * @return {number} - Num bytes.
   */
  public measure(): number {
    // NOTE: we subtract 1 because the first byte is a "tag", not part of the
    // instance object/struct to be serialized.
    return super.measure() - 1;
  }

  /**
   * Borsh serialize this message to a buffer. To serialize the object to
   * something we receive as an enum variant "tag" in Rust, we set the first
   * byte of the buffer to the index of the variant in the enum.
   * @return {Buffer} - The serialized message as a buffer.
   */
  public toBuffer(): Buffer {
    const cls: any = this.constructor;
    const schema = new Map([[cls, this.schema]]);
    if (!(this.schema && this.schema.fields.length)) {
      return Buffer.from([this.tag]);
    } else {
      const bytes = borsh.serialize(schema, this);
      return Buffer.from(Uint8Array.of(this.tag, ...bytes));
    }
  }
}
