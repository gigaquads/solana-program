import {
  Keypair,
  sendAndConfirmTransaction,
  Transaction,
  TransactionSignature,
} from '@solana/web3.js';
import InstructionBuilder from './InstructionBuilder';
import Solana from '../Solana';

/**
 * State enum for TransactionBuilder.
 */
// eslint-disable-next-line no-unused-vars
export enum TransactionState {
  // eslint-disable-next-line no-unused-vars
  Created = 1,
  // eslint-disable-next-line no-unused-vars
  Executed,
  // eslint-disable-next-line no-unused-vars
  Failed,
}

/**
 * Helper class returned by Solana.transaction(), used to stage all data
 * required to construct an execute a solana Transaction.
 */
export default class TransactionBuilder {
  public transaction: Transaction = new Transaction();
  private state: TransactionState = TransactionState.Created;
  private signers: Set<Keypair> = new Set<Keypair>();
  private instructionBuilders: Array<InstructionBuilder> = [];
  private payer: Keypair | null = null;

  /**
   * Have we already executed the managed transaction.
   * @return {boolean} - has this.execute already been called?
   */
  public hasExecuted(): boolean {
    return this.state == TransactionState.Executed;
  }

  /**
   * Add one of more instruction builders (or arrays thereof).
   * @param {Array<InstructionBuilder | Array<InstructionBuilder>} builders -
   * one or more InstructionBuilders.
   * @return {TransactionBuilder} - This builder.
   */
  public add(
    ...builders: Array<InstructionBuilder | Array<InstructionBuilder>>
  ): TransactionBuilder {
    // builders array consists of both individual InstructionBuilders and arrays
    // thereof. Therefore, we effectively flatten the array below, adding each
    // builder and nested builder.
    builders.forEach((obj) => {
      if (obj instanceof InstructionBuilder) {
        this.instructionBuilders.push(obj);
      } else {
        // assume it's an array of builders
        obj.forEach((b) => this.instructionBuilders.push(b));
      }
    });
    return this;
  }

  /**
   * Add one of more keypairs as signers of the transaction.
   * @param {Array<Keypair>} signers - one or more keypairs that sign the
   * transaction.
   * @return {TransactionBuilder} - This builder.
   */
  public sign(...signers: Array<Keypair>): TransactionBuilder {
    // add each signer to signers set
    signers.forEach((s) => this.signers.add(s));
    // if no payer set for transaction, default to first signer.
    if (this.payer === null) {
      this.payer = signers[0];
    }
    return this;
  }

  /**
   * Return an error message if the conditions and parameters necessary for
   * executing the transaction are not satisfied.
   * @return {string | null} - If invalid, a string message is returned stating
   * why; otherwise, null.
   */
  public validate(): string | null {
    if (this.payer === null) {
      return 'a payer must be specified for transaction';
    }
    if (!this.signers.size) {
      return 'transaction must be signed by at least one party';
    }
    if (!this.instructionBuilders.length) {
      return 'cannot execute transaction with no instructions';
    }
    return null;
  }

  /**
   * Build and execute the transaction.
   * @param {boolean} validate - perform this.validate before executing.
   * @return {TransactionSignature} - A string containing the executed
   * transaction signature.
   */
  public async execute(
    validate: boolean = true,
  ): Promise<TransactionSignature> {
    // validate conditions necessary for transaction execution
    if (validate) {
      const errMessage = this.validate();
      if (errMessage !== null) {
        throw Error(errMessage);
      }
    }

    const tx = this.transaction;
    const payer = this.payer!;
    const signers = Array.from(this.signers);

    // add payer keypair to signers if not already present
    if (!this.signers.has(payer)) {
      signers.unshift(payer);
    }
    // build and add TransactionInstructions to transaction
    for (const b of this.instructionBuilders) {
      const instr = await b.build();
      tx.add(instr);
    }
    // try to execute and confirm transaction,
    // updating TransactionState accordingly.
    try {
      const sig = await sendAndConfirmTransaction(Solana.conn, tx, signers);
      this.state = TransactionState.Executed;
      return sig;
    } catch (err) {
      console.error(`transaction execution failed: ${err}`);
      this.state = TransactionState.Failed;
      throw err;
    }
  }
}
