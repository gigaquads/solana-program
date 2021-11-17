import {
  Keypair,
  PublicKey,
  sendAndConfirmTransaction,
  Transaction,
  TransactionInstruction,
} from '@solana/web3.js';

import {Account, Message, Program} from '.';

/**
 * Instruction Interface
 */
interface InstructionInterface {
  readonly program: Program;
  build(): TransactionInstruction;
  execute(tx: Transaction | null): Promise<string>;
}

/**
 * A Solana program instruction.
 */
export default class Instruction<T extends Message>
implements InstructionInterface {
  readonly program: Program;
  accounts: Array<AccountMetadata> = [];
  data?: T | null;

  /**
   * @param {Program} program - Program that owns the instruction.
   */
  constructor(program: Program) {
    this.program = program;
  }

  /**
   * @return {PublicKey} - Public key address of owner program.
   */
  get programId(): PublicKey {
    return this.program.key;
  }

  /**
   * This method is used to register an account with the instruction, indicating
   * that the instruction reads or writes to it.
   * @param {Account} account - Account targeted by instruction.
   * @param {any} options - Account metadata fields.
   * @return {Instruction} - returns this instruction.
   */
  withAccount(
    account: Account,
    options: any = {isSigner: false, isWritable: false},
  ): Instruction<T> {
    // just add the account metadata to array
    this.accounts.push(
      new AccountMetadata(
        account.key,
        options.isSigner || false,
        options.isWritable || false,
      ),
    );
    return this;
  }

  /**
   * Generate a web3 TransactionInstruction using this solana-program
   * Instruction. Multiple built instructions can be executed in a single
   * transaction via `Instruction.executeMany(instructions)`.
   * @return {TransactionInstruction} - The generated TransactionInstruction.
   */
  build(): TransactionInstruction {
    const prog = this.program;

    // serialize Message to buffer as instruction data
    const data = this.data !== null ? this.data!.toBuffer() : Buffer.alloc(0);

    // build up account metadata needed by solana SDK
    const keys = this.accounts.map((meta: AccountMetadata) => {
      return {
        pubkey: meta.key,
        isSigner: meta.isSigner,
        isWritable: meta.isWritable,
      };
    });

    // init new transaction containing instruction and send
    return new TransactionInstruction({
      programId: prog.key,
      keys,
      data,
    });
  }

  /**
   * Execute the instruction in a transaction.
   * @param {Transaction | null} tx: An existing transaction to which we add the
   * internally-generated instruction.
   * @return {Promise<string>} Solana SDK Result string returned by executing a
   * transaction.
   */
  async execute(tx: Transaction | null = null): Promise<string> {
    const prog = this.program;
    const txInstruction = this.build();

    tx = tx !== null ? tx : new Transaction();
    tx.add(txInstruction);

    return await sendAndConfirmTransaction(prog.conn, tx, [prog.payer!]);
  }

  /**
   * Execute multiple instructions in a transaction.
   * @param {Keypair} payer - Public key of sending account.
   * @param {Array<Instruction>} instructions - Instructions to execute.
   * @param {Transaction | null} tx - Pending transaction to use, if any.
   * @return {Promise<string>} - String returned by web3 as a result of
   * executing transaction.
   */
  static async executeMany(
    payer: Keypair,
    instructions: Array<InstructionInterface>,
    tx: Transaction | null = null,
  ) {
    // create or reuse transaction
    tx = tx !== null ? tx : new Transaction();
    instructions.forEach((instr) => {
      tx!.add(instr.build());
    });
    // perform transaction
    const conn = instructions[0].program.conn;
    return await sendAndConfirmTransaction(conn, tx, [payer!]);
  }
}

/**
 * Storage for account metadata used to construct Solana program Instructions.
 */
class AccountMetadata {
  readonly key: PublicKey;
  isSigner: boolean;
  isWritable: boolean;

  /**
   * @param {PublicKey} key - Public key (address) of the account.
   * @param {boolean} isSigner - Is being used to sign transaction?
   * @param {boolean} isWritable - Is our intent to modify account data?
   */
  constructor(
    key: PublicKey,
    isSigner: boolean = false,
    isWritable: boolean = false,
  ) {
    this.key = key;
    this.isSigner = isSigner;
    this.isWritable = isWritable;
  }
}
