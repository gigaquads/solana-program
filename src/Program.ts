import {Keypair, PublicKey} from '@solana/web3.js';

import Account from './Account';
import {
  CustomInstructionBuilder,
  SystemInstructionBuilder,
} from './InstructionBuilder';
import {Payload} from './payload';
import Solana from './Solana';
import {
  // airdropFundsForAccount,
  ensureSolanaProgramIsDeployed,
} from './util';

/**
 * Client for a Solana blockchain program.
 */
export default class Program {
  public readonly programKeypairPath: string;
  public readonly programSoPath: string;
  private programKeyPair: Keypair | null = null;

  /**
   * Solana program ID or undefined if client not initialized.
   */
  get keyPair(): Keypair {
    return this.programKeyPair!;
  }

  /**
   * Solana program ID or undefined if client not initialized.
   */
  get key(): PublicKey {
    return this.programKeyPair!.publicKey;
  }

  /**
   *
   * @param {string} programKeypairPath - Path to program keypair file.
   * @param {string} programSoPath - Path to Solana .so program file.
   */
  constructor(programKeypairPath: string, programSoPath: string) {
    this.programSoPath = programSoPath;
    this.programKeypairPath = programKeypairPath;
  }

  /**
   * Initialize the web3 connection for communicating with the Solana program,
   * ensuring that the program is deployed and its account is executable.
   * @param {Solana} solana - Solana application object.
   * @return {Promise<Program>} - This program.
   */
  async connect(): Promise<Program> {
    this.programKeyPair = await ensureSolanaProgramIsDeployed(
      Solana.conn,
      this.programSoPath,
      this.programKeypairPath,
    );
    return this;
  }

  /**
   * Initialize a new Instruction. To execute the instruction on-chain (in a
   * transaction), use instr.execute().
   *
   * @param {Payload?} data - Optional data to bind to instruction.
   * @return {InstructionBuilder} - An initialized Instruction.
   */
  newInstruction(data: Payload | null = null): CustomInstructionBuilder {
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
  async deriveAddress(fromKey: PublicKey, seed: string): Promise<PublicKey> {
    return await PublicKey.createWithSeed(fromKey, seed, this.key);
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
  async deriveProgramAddress(
    seeds: string | Buffer | Array<string | Buffer>,
  ): Promise<[PublicKey, number]> {
    // convert seeds arg to list of buffers
    seeds = seeds instanceof Array ? seeds : [seeds];
    const seedBuffers = seeds.map((x) =>
      x instanceof Buffer ? x : Buffer.from(x),
    );
    // generate PDA (public key, nonce)
    return await PublicKey.findProgramAddress(seedBuffers, this.key);
  }

  /**
   * Return a new Account object, containing AccountInfo owned and fetched by
   * this program.
   *
   * @param {string} key - prorgam-derived address
   * of account being fetched.
   * @return {Promise<Account>} - An Account object with fetched AccountInfo as
   * its `info` property.
   */
  async getAccount(key: PublicKey): Promise<Account> {
    const info = await Solana.conn.getAccountInfo(key);
    if (!info) {
      throw Error(`could not find account: ${key}`);
    }
    return new Account(this, key, info!);
  }

  /**
   * Return true if an account exists and is owned by this program.
   * @param {PublicKey} key - program-derived account address.
   * @return {boolean} True, if account is found.
   */
  async hasAccount(key: PublicKey): Promise<boolean> {
    return (await Solana.conn.getAccountInfo(key)) !== null;
  }

  /**
   * Create a new program-owned account, using a program-derived address (PDA)
   * derived from the payer's public key.
   * @param {Keypair} payer - keypair of transaction fee payer.
   * @param {string} seed - seed for program-derived address.
   * @param {number} space - number of bytes to allocate.
   * @param {number | null} lamports - amount of funds to allocate.
   * @return {SystemInstructionBuilder} - an instruction builder.
   */
  createUserSpaceAccount(
    payer: Keypair,
    seed: string,
    space: number | Payload,
    lamports: number | null = null,
  ): SystemInstructionBuilder {
    space = space instanceof Payload ? space.size : space;
    const builder = new SystemInstructionBuilder();
    const key = async () => await this.deriveAddress(payer.publicKey, seed);
    builder.createUserSpaceAccount(this, payer, seed, key, space, lamports);
    return builder;
  }

  /**
   * Create a new program-owned account, using a program-derived address (PDA)
   * derived from the payer's public key.
   * @param {Keypair} payer - keypair of transaction fee payer.
   * @param {PublicKey} key - program-derived address.
   * @param {number} space - number of bytes to allocate.
   * @param {number | null} lamports - amount of funds to allocate.
   * @return {SystemInstructionBuilder} - an instruction builder.
   */
  createProgramSpaceAccount(
    payer: Keypair,
    key: PublicKey,
    space: number | Payload,
    lamports: number | null = null,
  ): SystemInstructionBuilder {
    space = space instanceof Payload ? space.size : space;
    const builder = new SystemInstructionBuilder();
    builder.createProgramSpaceAccount(this, payer, key, space, lamports);
    return builder;
  }
}
