import {
  Connection,
  Keypair,
  PublicKey,
  SystemProgram,
  Transaction,
  sendAndConfirmTransaction,
} from '@solana/web3.js';

import {
  establishConnection,
  getConfig
} from './util';

/**
 * Solana global client application state.
 */
export default class Solana {
  private conn?: Connection | null = null;
  private config?: any | null = null;

  /**
   * Initialize web3 connection to solana blockchain.
   * @return {Solana} - This instance, now connected.
   */
  async connect(): Promise<Solana> {
    this.config = await getConfig();
    this.conn = await establishConnection(this.config);
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
}
