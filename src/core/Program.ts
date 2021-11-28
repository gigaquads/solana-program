import { Keypair, PublicKey } from '@solana/web3.js';

import Account from './Account';
import { CustomInstructionBuilder, SystemInstructionBuilder } from './builders';
import { InstructionData } from './instruction';
import Solana from './Solana';

/**
 * Client for a Solana blockchain program.
 */
export default class Program {
  private programId: PublicKey | null = null;

  /**
   * Solana program ID or undefined if client not initialized.
   */
  get id(): PublicKey {
    return this.programId!;
  }

  /**
   * @param {string | PublicKey} id - Program ID (its account's public).
   */
  constructor(id: string | PublicKey) {
    if (id instanceof PublicKey) {
      this.programId = id;
    } else {
      this.programId = new PublicKey(id);
    }
  }

  /**
   * Return true if this program is deployed to Solana (using its program ID).
   * @return {boolean} - True, if on-chain program is deployed.
   */
  public async isDeployed(): Promise<boolean> {
    const programInfo = await Solana.conn.getAccountInfo(this.id);
    return programInfo !== null;
  }

  /**
   * Initialize a new Instruction. To execute the instruction on-chain (in a
   * transaction), use instr.execute().
   *
   * @param {InstructionData?} data - Optional data to bind to instruction.
   * @return {InstructionBuilder} - An initialized Instruction.
   */
  public newInstruction(
    data: InstructionData | null = null,
  ): CustomInstructionBuilder {
    const builder = new CustomInstructionBuilder(this);
    builder.data = data;
    return builder;
  }

  /**
   * Derive a new address from a base public key (most likely a user's public
   * key). This should be used when you want a user and the program to be
   * "co-signers" of an account. In other words, any account created through
   * this method will be unique per user.
   * @param {PublicKey} fromKey - Base key from which to derive the new one.
   * @param {string} seed - Arbitrary cryptographic string to use when
   * generating new public key.
   * @return {PublicKey} - Generated public key.
   */
  public async deriveAddress(
    fromKey: PublicKey | Keypair,
    seed: string,
  ): Promise<PublicKey> {
    fromKey = fromKey instanceof PublicKey ? fromKey : fromKey.publicKey;
    return await PublicKey.createWithSeed(fromKey, seed, this.id);
  }

  /**
   * Generate a program-derived address, using a list of given seeds. This
   * method should be used if *only the program* should be a legal signer for
   * the account. The data stored at a PDA is global to the program; whereas,
   * addresses generated with `deriveAddress` are unique per user,
   * where the user and the program are effectively "co-signers" of the account.
   * The resulting public key is not actually a public key, as there is no
   * corresponding private key.
   * @param {string | Buffer | Array<string | Buffer>} seeds - seed values, used
   * to derive new address.
   * @return {Promise<[PublicKey, number]>} - Derived address & nonce.
   */
  public async findProgramAddress(
    seeds: string | Buffer | Array<string | Buffer>,
  ): Promise<[PublicKey, number]> {
    // convert seeds arg to list of buffers
    seeds = seeds instanceof Array ? seeds : [seeds];
    const seedBuffers = seeds.map((x) =>
      x instanceof Buffer ? x : Buffer.from(x),
    );
    // generate PDA (public key, nonce)
    return await PublicKey.findProgramAddress(seedBuffers, this.id);
  }

  /**
   * Return a new Account, containing AccountInfo in this.info.
   * @param {string | PublicKey} key - Address of account info to fetch.
   * @return {Promise<Account>} - Fetched Account.
   */
  public async getAccount(key: PublicKey): Promise<Account | null> {
    const info = await Solana.conn.getAccountInfo(key);
    return info ? new Account(this, key, info!) : null;
  }

  /**
   * Return true if an account exists and is owned by this program.
   * @param {PublicKey} key - program-derived account address.
   * @return {boolean} True, if account is found.
   */
  public async hasAccount(key: PublicKey): Promise<boolean> {
    return (await Solana.conn.getAccountInfo(key)) !== null;
  }

  /**
   * Create a new program-owned account.
   * @param {Keypair} payer - keypair of transaction fee payer.
   * @param {string} seed - seed for program-derived address.
   * @param {PublicKey} key - public key "address" of new account.
   * @param {number} space - number of bytes to allocate.
   * @param {number | null} lamports - amount of funds to allocate.
   * @return {SystemInstructionBuilder} - an instruction builder.
   */
  public createAccountWithSeed(
    payer: Keypair,
    seed: string | Function,
    key: PublicKey | Function,
    space: number | InstructionData,
    lamports: number | null | Function = null,
  ): SystemInstructionBuilder {
    const resolvedSpace: number =
      space instanceof InstructionData ? space.measure() : space;
    const builder = new SystemInstructionBuilder();
    builder.createAccountWithSeed(
      this,
      payer,
      seed,
      key,
      resolvedSpace,
      lamports,
    );
    return builder;
  }

  /**
   * Create a new program-owned account,
   * @param {Keypair} payer - keypair of transaction fee payer.
   * @param {PublicKey} key - public key "address" of new account.
   * @param {number} space - number of bytes to allocate.
   * @param {number | null} lamports - amount of funds to allocate.
   * @return {SystemInstructionBuilder} - an instruction builder.
   */
  public createAccount(
    payer: Keypair,
    key: PublicKey | Function,
    space: number | InstructionData,
    lamports: number | null | Function = null,
  ): SystemInstructionBuilder {
    const resolvedSpace: number =
      space instanceof InstructionData ? space.measure() : space;
    const builder = new SystemInstructionBuilder();
    builder.createAccount(this, payer, key, resolvedSpace, lamports);
    return builder;
  }
}
