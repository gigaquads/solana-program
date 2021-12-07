import { AccountInfo, PublicKey } from '@solana/web3.js';
import ProgramObject from './ProgramObject';

export interface AccountInterface {
  key: PublicKey | null;
}
/**
 * High-level abstraction that encapsulates an AccountInfo as well as its public
 * key address and the owner Program object through that owns the account.
 */

export default class Account<T extends ProgramObject>
  implements AccountInterface
{
  public key: PublicKey | null = null;
  public info: AccountInfo<Buffer> | null = null;
  public data: T | null = null;

  /**
   * Return a new Account. Accounts are normally only instantiated within a
   * Program object's instance methods.
   *
   */
  constructor(
    key: PublicKey,
    info: AccountInfo<Buffer>,
    data: T | null = null,
  ) {
    this.key = key;
    this.info = info;
    this.data = data;
  }
}
