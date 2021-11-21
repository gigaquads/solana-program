import {
  AccountInfo,
  Connection,
  Keypair,
  PublicKey,
  sendAndConfirmTransaction,
  SystemProgram,
  Transaction,
  TransactionInstruction,
} from '@solana/web3.js';

import Account from './Account';
import Instruction from './Instruction';
import Message from './Message';
import Solana from './Solana';
import {
  airdropFundsForAccount,
  ensureSolanaProgramIsDeployed,
} from './util';

/**
 * Client for a Solana blockchain program.
 */
export default class Program {
  readonly programKeypairPath: string;

  readonly programSoPath: string;

  private _config: any = {};

  private _payer: Keypair | null = null;

  private _conn: Connection| null = null;

  private _keyPair: Keypair | null = null;

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
   * Keypair of program creator, who paid for the program's account.
   */
  get payer(): Keypair {
    return this._payer!;
  }

  /**
   * Solana program ID or undefined if client not initialized.
   */
  get keyPair(): Keypair {
    return this._keyPair!;
  }

  /**
   * Solana program ID or undefined if client not initialized.
   */
  get key(): PublicKey {
    return this._keyPair!.publicKey;
  }

  /**
   *
   * @param {string} programKeypairPath - Path to program keypair file.
   * @param {string} programSoPath - Path to Solana .so program file.
   */
  constructor(programKeypairPath: string, programSoPath: string) {
    this.programSoPath = programSoPath;
    this.programKeypairPath = programKeypairPath;
    this._config = {};
  }

  /**
   * Initialize the web3 connection for communicating with the Solana program,
   * ensuring that the program is deployed and its account is executable.
   * @param {Solana} solana - Solana application object.
   * @return {Promise<Program>} - This program.
   */
  async connect(): Promise<Program> {
    this._config = Solana.config;
    this._conn = Solana.conn;
    this._payer = Solana.payer;
    this._keyPair = await ensureSolanaProgramIsDeployed(
      this._conn,
      this.programSoPath,
      this.programKeypairPath,
    );
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
      this.key,
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
   * Gets (and create, if necessary) a program-derived account in a transaction.
   *
   * @param {string} seed - Seed used to generate account's address.
   * @param {number} space - Size of new account in bytes. (Max: 10MB)
   * @param {Keypair} payer - Keypair of payer. Defaults to program.payer.
   * @return {Promise<Account | TransactionInstruction>} - An Account object
   * with fetched AccountInfo as or the un-executed instruction object.
   * its `info` property.
   *
   */
  async getOrCreateAccount(
    seed: string,
    space: number = 0,
    payer: Keypair | null = null,
  ): Promise<Account> {
    const conn = this.conn!;
    const pubKey = await this.createProgramDerivedAddressWithSeed(seed);

    payer = (payer !== null ? payer : this.payer)!;

    let accountInfo = await conn.getAccountInfo(pubKey);

    if (accountInfo === null) {
      // fund the program payer's account if we have insufficient funds
      // to pay for the new account.
      if (process.env.CLUSTER !== 'mainnet') {
        await airdropFundsForAccount(this._conn!, payer, space);
      }
      // calc min lamports needed for new account to be rent-exempt.
      const minLamportsRequired = await conn.getMinimumBalanceForRentExemption(
        Math.ceil(space),
      );
      console.log('creating account', {
        key: pubKey,
        programId: this.key,
        lamports: minLamportsRequired,
        seed,
        space,
      });
      // pay for and create new account
      const transaction = new Transaction().add(
        SystemProgram.createAccountWithSeed({
          lamports: minLamportsRequired,
          fromPubkey: payer.publicKey,
          basePubkey: payer.publicKey,
          newAccountPubkey: pubKey,
          programId: this.key,
          seed,
          space,
        }),
      );
      await sendAndConfirmTransaction(conn, transaction, [payer]);
      accountInfo = await conn.getAccountInfo(pubKey);
    }
    return new Account(this, pubKey, accountInfo!);
  }

  /**
   * Reassign program ownership to a different account in a transaction.
   * @param {Account} account - Existing account to which ownership of program
   * is transferred.
   * @param {Keypair} payer - Keypair of payer. Defaults to program.payer.
   */
  async reassignTo(
    account: Account,
    payer: Keypair | null = null,
  ): Promise<void> {
    payer = (payer !== null ? payer : this.payer)!;
    const tx = new Transaction();
    tx.add(
      SystemProgram.assign({
        accountPubkey: account.key,
        programId: this.key,
      }),
    );
    await sendAndConfirmTransaction(this.conn, tx, [payer, this.keyPair]);
  }
}
