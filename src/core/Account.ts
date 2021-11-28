import { AccountInfo, PublicKey } from '@solana/web3.js';
import { InstructionData } from './instruction';
import Program from './Program';

/**
 * High-level abstraction that encapsulates an AccountInfo as well as its public
 * key address and the owner Program object through that owns the account.
 */
export default class Account {
  readonly key: PublicKey;

  readonly info: AccountInfo<Buffer>;

  owner: Program;

  /**
   * Return a new Account. Accounts are normally only instantiated within a
   * Program object's instance methods.
   *
   * @param {Program} owner - Program that owns the account.
   * @param {PublicKey} key  - Public key of the account (AKA its address).
   * @param {AccountInfo<Buffer>} info - Solana SDK AccountInfo object,
   * containing account data, etc.
   */
  constructor(owner: Program, key: PublicKey, info: AccountInfo<Buffer>) {
    this.key = key;
    this.owner = owner;
    this.info = info;
  }

  /**
   * Deserialize the account's data into the given InstructionData object, returning it.
   *
   * @param {T} message - A InstructionData subclass.
   * @return {T} - A InstructionData instance containing the deserialized account data.
   */
  public deserializeTo<T extends InstructionData>(message: T): T {
    message.fromBuffer(this.info.data);
    return message;
  }
}