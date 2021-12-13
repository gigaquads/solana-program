import 'reflect-metadata';
import { AccountInfo, Keypair, PublicKey } from '@solana/web3.js';
import { CustomInstructionBuilder, SystemInstructionBuilder } from './builders';
import { SYSTEM_PROGRAM_PUBKEY } from './constants';
import ProgramObject from './ProgramObject';
import Account from './Account';
import Solana from './Solana';
import PDA from './PDA';
import Query from './Query';
import { resolvePublicKey } from './util';
import { Address, Seed } from './types';

/**
 * Client for a Solana blockchain program.
 */
export default class Program {
  public static systemProgramPublicKey = SYSTEM_PROGRAM_PUBKEY;
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

  // eslint-disable-next-line no-unused-vars
  public async main(user: Keypair) {
    // TODO: override in subclass
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
   * Return a Query object, used to fetch program owned accounts.
   * @param {new(any) => ProgramObject} dtype - ProgramObject subclass
   * @return {Query<T>} - Un-executed query object.
   */
  public select<T extends ProgramObject>(
    // eslint-disable-next-line no-unused-vars
    dtype: { new (data: any): T },
  ): Query<T> {
    return new Query(this, dtype);
  }

  /**
   * Initialize a new Instruction. To execute the instruction on-chain (in a
   * transaction), use instr.execute().
   *
   * @param {ProgramObject?} data - Optional data to bind to instruction.
   * @return {InstructionBuilder} - An initialized Instruction.
   */
  public instruction(
    data: ProgramObject | null = null,
  ): CustomInstructionBuilder {
    const builder = new CustomInstructionBuilder(this, data);
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
   * @param {string | Buffer | Uint8Array | Array<string | Buffer | Uint8Array>} seeds - seed values, used
   * to derive new address.
   * @return {Promise<[PublicKey, number]>} - Derived address & nonce.
   */
  public async findAddress(seeds: Seed | Array<Seed>): Promise<PDA> {
    // convert seeds arg to list of buffers
    seeds = seeds instanceof Array ? seeds : [seeds];
    const seedBuffers = seeds.map((x) => {
      if (x instanceof PublicKey) {
        return x.toBytes();
      } else {
        return x instanceof Buffer ? x : Buffer.from(x);
      }
    });
    // generate PDA (public key, nonce)
    const [key, nonce] = await PublicKey.findProgramAddress(
      seedBuffers,
      this.id,
    );
    return new PDA(key, nonce, seeds);
  }

  public async findAddresses(seeds: {
    [key: string]: Seed | Array<Seed>;
  }): Promise<{ [key: string]: PDA }> {
    let addresses: { [key: string]: PDA } = {};
    for (let [k, v] of Object.entries(seeds)) {
      addresses[k] = await this.findAddress(v);
    }
    return addresses;
  }

  /**
   * Return a new Account, containing AccountInfo in this.info.
   * @param {Address} key - Address of account info to fetch.
   * @return {Promise<Account>} - Fetched Account.
   */
  public async getAccount<T extends ProgramObject>(
    // eslint-disable-next-line no-unused-vars
    dtype: { new (data: any): T },
    key: Address,
  ): Promise<Account<T> | null> {
    key = resolvePublicKey(key);
    const info = await Solana.conn.getAccountInfo(key);

    if (info !== null) {
      const data = new dtype(info.data);
      return new Account<T>(key, info, data);
    }
    return null;
  }

  /**
   * Return true if an account exists and is owned by this program.
   * @param {Address} key - program-derived account address.
   * @return {boolean} True, if account is found.
   */
  public async hasAccount(key: Address): Promise<boolean> {
    return (await this.getAccountInfo(key)) !== null;
  }

  /**
   * Return an account info exists and is owned by this program.
   * @param {Address} key - program-derived account address.
   * @return {AccountInfo<Buffer>} The account info
   */
  public async getAccountInfo(
    key: Address,
  ): Promise<AccountInfo<Buffer> | null> {
    return await Solana.conn.getAccountInfo(resolvePublicKey(key));
  }

  /**
   * Create a new program-owned account.
   * @param {Keypair} payer - keypair of transaction fee payer.
   * @param {string} seed - seed for program-derived address.
   * @param {Address | Fucntion} key - public key "address" of new account.
   * @param {number} space - number of bytes to allocate.
   * @param {number | null} lamports - amount of funds to allocate.
   * @return {SystemInstructionBuilder} - an instruction builder.
   */
  public createAccountWithSeed(
    payer: Keypair,
    seed: string | Function,
    key: Address | Function,
    space: number | ProgramObject,
    lamports: number | null | Function = null,
  ): SystemInstructionBuilder {
    const resolvedSpace: number =
      space instanceof ProgramObject ? 1 + space.measure() : space;
    const builder = new SystemInstructionBuilder();
    if (typeof key !== 'function') {
      key = resolvePublicKey(key);
    }
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
   * @param {Address | Function} key - public key "address" of new account.
   * @param {number} space - number of bytes to allocate.
   * @param {number | null} lamports - amount of funds to allocate.
   * @return {SystemInstructionBuilder} - an instruction builder.
   */
  public createAccount(
    payer: Keypair,
    key: Address | Function,
    space: number | ProgramObject,
    lamports: number | null | Function = null,
  ): SystemInstructionBuilder {
    const resolvedSpace: number =
      space instanceof ProgramObject ? 1 + space.measure() : space;
    if (typeof key !== 'function') {
      key = resolvePublicKey(key);
    }
    const builder = new SystemInstructionBuilder();
    builder.createAccount(this, payer, key, resolvedSpace, lamports);
    return builder;
  }
}
