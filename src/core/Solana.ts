import {Connection, Keypair} from '@solana/web3.js';
import {TransactionBuilder} from './builders';
import {
  createKeypairFromFile,
  establishConnection,
  getConfig,
  getConfigKeypair,
} from '../util';

/**
 * Solana CLI accessor helper class.
 */
class Cli {
  private readonly config: any;
  public _keyPair: Keypair | null = null;

  /**
   * @param {any} config - CLI config data.
   */
  constructor(config: any) {
    this.config = config;
  }

  /**
   * Load data from filesystem.
   */
  public async load() {
    this._keyPair = await getConfigKeypair(this.config);
  }

  /**
   * Return keypair specified in CLI config.
   */
  public get keyPair(): Keypair {
    return this._keyPair!;
  }
}

/**
 * Solana global client application state.
 */
export default class Solana {
  private static _isConnected: boolean = false;
  private static _conn: Connection | null = null;
  private static _config: any | null = null;
  private static _cli: Cli | null = null;

  /**
   * helper accessor for CLI config data
   */
  static get cli(): Cli {
    return this._cli!;
  }
  /**
   * Was client.connect awaited?
   */
  static get isConnected(): boolean {
    return this._isConnected;
  }

  /**
   * Loaded YAML config data.
   */
  static get config(): any {
    return this._config;
  }

  /**
   * JSON RPC Connection object or undefined if client not initialized.
   */
  static get conn(): Connection {
    return this._conn!;
  }

  /**
   * Initialize web3 connection to solana blockchain.
   * @return {Solana} - This instance, now connected.
   */
  static async initialize(): Promise<void> {
    if (!this._isConnected) {
      this._config = await getConfig();
      this._conn = await establishConnection(this._config!);
      this._isConnected = true;
      this._cli = new Cli(this._config);
      await this._cli.load();
    }
  }

  /**
   * Start constructing a new transaction.
   * @return {TransactionBuilder} - A new transaction builder.
   */
  public static transaction(): TransactionBuilder {
    return new TransactionBuilder();
  }

  // /**
  //  * Transfer lamports between accounts
  //  * @param {Keypair} payer - Public key of sending account.
  //  * @param {PublicKey} receiver - Public key of receiving account.
  //  * @param {number} lamports - Number of lamports to transfer.
  //  * @param {Transaction | null} tx - Existing transaction to which to add
  //  * @param {boolean} execute - Execute transaction if True. Transfer
  //  * instruction. If left null, a new transaction is created.
  //  * @return {Transaction} - The Transaction used or created.
  //  */
  // public static async transfer(
  //   payer: Keypair,
  //   receiver: PublicKey,
  //   lamports: number,
  //   tx: Transaction | null = null,
  //   execute: boolean = true,
  // ): Promise<Transaction> {
  //   // create or use existing transaction
  //   // and add transfer instruction to transaction
  //   tx = tx === null ? new Transaction() : tx;
  //   tx.add(
  //     SystemProgram.transfer({
  //       fromPubkey: payer.publicKey,
  //       toPubkey: receiver,
  //       lamports: Math.max(0, Math.ceil(lamports)),
  //     }),
  //   );
  //   // execute the transaction if desired
  //   if (execute) {
  //     await sendAndConfirmTransaction(this.conn!, tx, [payer]);
  //   }
  //   return tx;
  // }

  /**
   * Load a Keypair from file.
   * @param {string} path - path to keypair file.
   * @return {Promise<Keypair>} - Keypair
   */
  public static async loadKeypair(path: string): Promise<Keypair> {
    return await createKeypairFromFile(path);
  }
}
