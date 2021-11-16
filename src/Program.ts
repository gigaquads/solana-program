import {
  AccountInfo,
  Connection,
  Keypair,
  PublicKey,
  sendAndConfirmTransaction,
  SystemProgram,
  Transaction,
} from '@solana/web3.js';

import Account from './Account';
import Instruction from './Instruction';
import Message from './Message';
import {
  airdropFundsForAccount,
  ensureSolanaProgramIsDeployed,
  establishConnection,
  getConfig,
  getPayer,
} from './util';

/**
 * Client for a Solana blockchain program.
 */
export default class Program {
  readonly programKeypairPath: string;

  readonly programSoPath: string;

  payer?: Keypair;

  _isConnected: boolean;

  _config?: any;

  _conn?: Connection;

  _programId?: PublicKey;

  /**
   * Was client.connect awaited?
   */
  get isConnected(): boolean {
    return this._isConnected;
  }

  /**
   * Loaded YAML config data.
   */
  get config(): any {
    return this._config;
  }

  /**
   * JSON RPC Connection object or undefined if client not initialized.
   */
  get conn(): Connection {
    return this._conn!;
  }

  /**
   * Solana program ID or undefined if client not initialized.
   */
  get programId(): PublicKey {
    return this._programId!;
  }

  /**
   *
   * @param {string} programKeypairPath - Path to program keypair file.
   * @param {string} programSoPath - Path to Solana .so program file.
   */
  constructor(programKeypairPath: string, programSoPath: string) {
    this.programSoPath = programSoPath;
    this.programKeypairPath = programKeypairPath;
    this._isConnected = false;
    this._config = {};
  }

  /**
   * Initialize the web3 connection for communicating with the Solana program,
   * ensuring that the program is deployed and its account is executable.
   */
  async connect(): Promise<Program> {
    if (this.isConnected) {
      throw Error('SolanaClient already connected.');
    }
    this._config = await getConfig();
    this._conn = await establishConnection(this._config);
    this._programId = await ensureSolanaProgramIsDeployed(
      this._conn,
      this.programSoPath,
      this.programKeypairPath,
    );
    this.payer = await getPayer(this._config!);
    this._isConnected = true;

    return this;
  }

  /**
   * Initialize a new Instruction. To execute the instruction on-chain (in a
   * transaction), use instr.execute().
   *
   * @param {Message?} data - Optional data to bind to instruction.
   * @return {Instruction<T>} - An initialized Instruction.
   */
  newInstruction<T extends Message>(data: T | null = null): Instruction<T> {
    const instruction = new Instruction<T>(this);
    instruction.data = data;
    return instruction;
  }

  /**
   *
   * @param {string} seed - Arbitrary cryptographic string to use when
   * generating new public key.
   * @return {PublicKey} - Generated PDA in form of a PublicKey.
   */
  async createProgramDerivedAddressWithSeed(seed: string): Promise<PublicKey> {
    return await PublicKey.createWithSeed(
      this.payer!.publicKey,
      seed,
      this.programId!,
    );
  }

  /**
   * Return account exists at the program-derived address, derived from
   * the given seed.
   *
   * @param {string} seed - Seed used to generate account's address.
   * @return {AccountInfo<Buffer> | null} - retrieved account info.
   */
  async getAccountInfo(seed: string): Promise<AccountInfo<Buffer> | null> {
    const pubKey = await this.createProgramDerivedAddressWithSeed(seed);
    return await this._conn!.getAccountInfo(pubKey);
  }

  /**
   * Return a new Account object, containing AccountInfo owned and fetched by
   * this program.
   *
   * @param {string} seed - Seed value used to generate prorgam-derived address
   * of account being fetched.
   * @return {Promise<Account>} - An Account object with fetched AccountInfo as
   * its `info` property.
   */
  async getAccount(seed: string): Promise<Account> {
    const key = await this.createProgramDerivedAddressWithSeed(seed);
    const info = await this._conn!.getAccountInfo(key);
    if (!info) {
      throw Error(`could not find account: ${key}`);
    }
    return new Account(this, key, info!);
  }

  /**
   * Gets (and create, if necessary) a program-derived account.
   *
   * @param {string} seed - Seed used to generate account's address.
   * @param {number} space - Size of new account in bytes. (Max: 10MB)
   * @return {Promise<Account>} - An Account object with fetched AccountInfo as
   * its `info` property.
   *
   */
  async getOrCreateAccount(seed: string, space: number = 0): Promise<Account> {
    const conn = this.conn!;
    const payer = this.payer!;
    const pubKey = await this.createProgramDerivedAddressWithSeed(seed);

    let accountInfo = await conn.getAccountInfo(pubKey);

    if (accountInfo === null) {
      // fund the program payer's account if we have insufficient funds
      // to pay for the new account.
      if (process.env.CLUSTER !== 'mainnet') {
        airdropFundsForAccount(this._conn!, this._config!, space);
      }
      // calc min lamports needed for new account to be rent-exempt.
      const minLamportsRequired = await conn.getMinimumBalanceForRentExemption(
        Math.ceil(space),
      );
      // pay for and create new account
      const transaction = new Transaction().add(
        SystemProgram.createAccountWithSeed({
          lamports: minLamportsRequired,
          fromPubkey: payer.publicKey,
          basePubkey: payer.publicKey,
          newAccountPubkey: pubKey,
          programId: this.programId!,
          seed,
          space,
        }),
      );
      await sendAndConfirmTransaction(conn, transaction, [payer]);
      accountInfo = await conn.getAccountInfo(pubKey);
    } else {
      console.warn(
        'using existing program account because an account already exists ' +
          'at the specified program-derived address.',
      );
    }
    return new Account(this, pubKey, accountInfo!);
  }
}
