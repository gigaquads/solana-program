import {
  PublicKey,
  sendAndConfirmTransaction,
  Transaction,
  TransactionInstruction,
} from '@solana/web3.js';

import {Account, Message, Program} from '.';

/**
 * A Solana program instruction.
 */
export default class Instruction<T extends Message> {
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
    return this.program.programId;
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
   * Execute the instruction in a transaction.
   * @return {Promise<string>} Solana SDK Result string returned by executing a
   * transaction.
   */
  async execute(): Promise<string> {
    const prog = this.program;

    if (!prog.isConnected) {
      throw Error(
        'program not connected. use `await program.connect()` ' +
          'before trying to execute instructions.',
      );
    }
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
    const instruction = new TransactionInstruction({
      programId: prog.programId,
      keys,
      data,
    });

    const tx = new Transaction().add(instruction);
    return await sendAndConfirmTransaction(prog.conn, tx, [prog.payer!]);
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
