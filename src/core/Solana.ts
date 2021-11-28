import { Connection, Keypair, PublicKey } from '@solana/web3.js';
import { TransactionBuilder } from './builders';
import { merge } from 'merge-anything';

/**
 * Top-level configuration options.
 */
export type SolanaConfiguration = {
  jsonRpcUrl: string;
  websocketUrl: string;
  commitment: string;
  addressLabels: any;
};

/**
 * Solana global client application state.
 */
export default class Solana {
  // web3.js JSON-RPC connection object
  private static connection: Connection | null = null;

  // Solana configuration options
  private static configuration: SolanaConfiguration = {
    jsonRpcUrl: 'http://localhost:8899',
    websocketUrl: '',
    commitment: 'confirmed',
    addressLabels: {
      '11111111111111111111111111111111': 'System Program',
    },
  };

  /**
   * Loaded YAML config data.
   */
  public static get config(): SolanaConfiguration {
    return this.configuration;
  }

  /**
   * JSON RPC Connection object or undefined if client not initialized.
   */
  public static get conn(): Connection {
    return this.connection!;
  }

  /**
   * Was client.connect awaited?
   */
  public static get isInitialized(): boolean {
    return this.connection !== null;
  }

  /**
   * Configure and initialize web3.js connection.
   * @param {SolanaConfiguration} config - Solana config options.
   * @return {Solana} - This instance, now connected.
   */
  public static async initialize(
    config: SolanaConfiguration | null = null,
  ): Promise<void> {
    // establish connection object for web3 JSON RPC client.
    if (this.connection === null) {
      // merge config options into existing config object.
      if (config !== null) {
        this.configuration = merge(this.configuration, config);
        console.log('Solana configuration options:', this.configuration);
      }
      const rpcUrl = this.configuration.jsonRpcUrl;
      this.connection = await this.establishConnection(rpcUrl);
    } else {
      console.warn('Solana already initialized');
    }
  }

  /**
   * Establish a connection to the cluster
   *
   * @param {string} rpcUrl - URL for web3 JSON RPC endpoint.
   */
  private static async establishConnection(
    rpcUrl: string,
  ): Promise<Connection> {
    const connection = new Connection(rpcUrl, 'confirmed');
    const version = await connection.getVersion();
    console.log('connection to cluster established:', { rpcUrl, version });
    return connection;
  }

  /**
   * Start constructing a new transaction.
   * @return {TransactionBuilder} - A new transaction builder.
   */
  public static begin(): TransactionBuilder {
    return new TransactionBuilder();
  }

  /**
   * Return the cost of a transaction in terms of Lamports per signature.
   * @return {number} - cost in lamports for transaction with the given number
   * of signers.
   */
  public static async estimateTransactionFee(
    signatureCount: number = 1,
  ): Promise<number> {
    const { feeCalculator } = await this.conn.getRecentBlockhash();
    return feeCalculator.lamportsPerSignature * signatureCount;
  }

  /**
   * Airdrop Lamports into a specified account.
   * @param {Keypair | PublicKey} receiver - Target account for airdrop.
   * @param {number} lamports - Number of lamports to airdrop.
   */
  public static async airdrop(
    receiver: Keypair | PublicKey,
    lamports: number,
  ): Promise<void> {
    const key = receiver instanceof Keypair ? receiver.publicKey : receiver;
    const sig = await this.conn.requestAirdrop(key, lamports);
    await this.conn.confirmTransaction(sig);
  }

  /**
   * Return the number of Lamports in a given account.
   * @param {Keypair | PublicKey} account - Account to query.
   * @return {number} Number of Lamports in account.
   */
  public static async getBalance(
    account: Keypair | PublicKey,
  ): Promise<number> {
    const key = account instanceof Keypair ? account.publicKey : account;
    return await this.conn.getBalance(key);
  }
}
