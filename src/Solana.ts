import {
  Connection,
  Keypair,
  PublicKey,
  SystemProgram,
  Transaction,
  sendAndConfirmTransaction,
} from '@solana/web3.js';

import Program from './Program';
import {
  establishConnection,
  getConfig,
  getPayer,
} from './util';

/**
 * Solana global client application state.
 */
export default class Solana {
  private static _instance: Solana | undefined = undefined;
  private _isConnected: boolean = false;
  private _conn: Connection | null = null;
  private _config: any | null = null;
  private _payer: Keypair | null = null;
  private _programs: any = {};

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
   * Payer keypair, as defined in Solana CLI config.
   */
  get payer(): Keypair {
    return this._payer!;
  }

  /**
   * JSON RPC Connection object or undefined if client not initialized.
   */
  get conn(): Connection {
    return this._conn!;
  }

  /**
   * Lazy create, memoize and return a global Solana singleton instance.
   * @return {Solana} - global solana singleton.
   */
  static getInstance(): Solana {
    if (this._instance === undefined) {
      this._instance = new Solana();
    }
    return this._instance;
  }

  /**
   * Initialize web3 connection to solana blockchain.
   * @return {Solana} - This instance, now connected.
   */
  async connect(): Promise<Solana> {
    if (!this._isConnected) {
      this._config = await getConfig();
      this._conn = await establishConnection(this._config!);
      this._payer = await getPayer(this._config!);
      this._isConnected = true;
    }
    return this;
  }

  /**
   * Transfer lamports between accounts
   * @param {Keypair} payer - Public key of sending account.
   * @param {PublicKey} receiver - Public key of receiving account.
   * @param {number} lamports - Number of lamports to transfer.
   * @param {Transaction | null} tx - Existing transaction to which to add
   * @param {boolean} execute - Execute transaction if True. Transfer
   * instruction. If left null, a new transaction is created.
   * @return {Transaction} - The Transaction used or created.
   */
  async transfer(
    payer: Keypair,
    receiver: PublicKey,
    lamports: number,
    tx: Transaction | null = null,
    execute: boolean = true,
  ): Promise<Transaction> {
    // create or use existing transaction
    // and add transfer instruction to transaction
    tx = tx === null ? new Transaction() : tx;
    tx.add(
      SystemProgram.transfer({
        fromPubkey: payer.publicKey,
        toPubkey: receiver,
        lamports: Math.max(0, Math.ceil(lamports)),
      }),
    );
    // execute the transaction if desired
    if (execute) {
      await sendAndConfirmTransaction(this.conn!, tx, [payer]);
    }
    return tx;
  }

  /**
   * Get (and memoize) a Program instance.
   * @param {string} keypairPath - Filepath to program keypair.
   * @param {string} soPath - Filepath to program .so file.
   * @return {Program} - The loaded program.
   */
  async getProgram(keypairPath: string, soPath: string): Promise<Program> {
    let program: Program = this._programs[soPath];
    if (!program) {
      program = new Program(keypairPath, soPath);
      await program.connect(this);
      this._programs[soPath] = program;
    }
    return program;
  }
}
