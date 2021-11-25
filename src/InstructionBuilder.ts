import {
  CreateAccountParams,
  CreateAccountWithSeedParams,
  Keypair,
  PublicKey,
  SystemProgram,
  TransactionInstruction,
} from '@solana/web3.js';
import {isAsyncFunction} from './util';

import {Account, Program, Payload, Solana} from '.';

/**
 * An Addressable type is one from which an account public key can be extracted.
 */
export type Addressable = PublicKey | Account;

export type AccountMetadataOptions = {
  /** true if instruction requires transaction signature matching `pubkey` */
  isSigner?: boolean;
  /** true if the `pubkey` can be loaded as a read-write account. */
  isWritable?: boolean;
};

/**
 * Instruction Interface
 */
export default class InstructionBuilder {
  /**
   * Build and return TransactionInstruction.
   */
  async build(): Promise<TransactionInstruction> {
    throw Error('override in subclass');
  }
}

/**
 * Builder for SystemProgram instructions.
 */
export class SystemInstructionBuilder extends InstructionBuilder {
  private params: any = {};
  private systemInstructionFactory: Function | null = null;

  /**
   * Build and return a TransactionInstruction.
   * @return {TransactionInstruction} - Built TransactionInstruction.
   */
  public async build(): Promise<TransactionInstruction> {
    // build up computed params object
    const params: {[index: string]: any} = {};
    for (const [k, v] of Object.entries(this.params)) {
      if (typeof v === 'function') {
        // await the return value of the function
        // if is async function.
        const x = v();
        if (isAsyncFunction(x)) {
          params[k] = await x;
        } else {
          params[k] = x;
        }
      } else {
        params[k] = v;
      }
    }
    return this.systemInstructionFactory!(params);
  }

  /**
   * Create a new account in the program's userspace -- that is, an account that
   * is "co-signed" by the program and user. Accounts here are distinct for each
   * user.
   * @param {Program} program - Program to derive address from.
   * @param {Keypair} payer - Keypair of transaction payer.
   * @param {string} seed - Seed for program-derived address.
   * @param {PublicKey} key - public key of new account.
   * @param {number} space - Number of bytes to allocate.
   * @param {number | null} lamports - Amount of funding for account.
   */
  public createAccountWithSeed(
    program: Program,
    payer: Keypair,
    seed: string | Function,
    key: PublicKey | Function,
    space: number,
    lamports: number | null | Function = null,
  ) {
    // ensure space is a positive integer value.
    space = Math.max(0, Math.ceil(space));

    // if no lamports specified, default to min required
    // to qualify for rent-exemption.
    if (lamports === null) {
      lamports = async () => {
        return await Solana.conn.getMinimumBalanceForRentExemption(space);
      };
    }
    // set the factory method used as build time to contruct the
    // TransactionInstruction object appropriate for the createAccount
    // system call.
    this.systemInstructionFactory = (
      params: CreateAccountWithSeedParams,
    ): TransactionInstruction => {
      return SystemProgram.createAccountWithSeed(params);
    };
    // set params used by this system instruction
    this.params = {
      fromPubkey: payer.publicKey,
      basePubkey: payer.publicKey,
      programId: program.id,
      newAccountPubkey: key,
      lamports,
      seed,
      space,
    };
  }

  /**
   * Prepare an instruction to create a new account in program space, using a
   * program-derived address. These accounts are global to and shared by all
   * users.
   * @param {Program} program - Program to derive address from.
   * @param {Keypair} payer - Keypair of transaction payer.
   * @param {PublicKey} key - Program-derived address.
   * @param {number} space - Number of bytes to allocate.
   * @param {number | null} lamports - Amount of funding for account.
   */
  public createAccount(
    program: Program,
    payer: Keypair,
    key: PublicKey | Function,
    space: number,
    lamports: number | null | Function = null,
  ) {
    // ensure space is a positive integer value.
    space = Math.max(0, Math.ceil(space));

    // if no lamports specified, default to min required
    // to qualify for rent-exemption.
    if (lamports === null) {
      lamports = async () => {
        return await Solana.conn.getMinimumBalanceForRentExemption(space);
      };
    }
    // set the factory method used as build time to contruct the
    // TransactionInstruction object appropriate for the createAccount
    // system call.
    this.systemInstructionFactory = (
      params: CreateAccountParams,
    ): TransactionInstruction => SystemProgram.createAccount(params);
    // set params used by this system instruction
    this.params = {
      fromPubkey: payer.publicKey,
      newAccountPubkey: key,
      programId: program.id,
      lamports,
      space,
    };
  }
}

/**
 * A Solana program instruction.
 */
export class CustomInstructionBuilder extends InstructionBuilder {
  public readonly program: Program;
  public accounts: Array<AccountMetadata> = [];
  public data: Payload | null = null;

  /**
   * @param {Program} program - Program that owns the instruction.
   * @param {Payload | null} data - Instruction data payload.
   */
  constructor(program: Program, data: Payload | null = null) {
    super();
    this.program = program;
    this.data = data;
  }

  /**
   * This method is used to register an account with the instruction, indicating
   * that the instruction reads or writes to it.
   * @param {Account} account - Account targeted by instruction.
   * @param {any} options - Account metadata fields.
   * @return {InstructionBuilder} - returns this instruction.
   */
  public withAccount(
    account: Addressable,
    options: AccountMetadataOptions = {isSigner: false, isWritable: false},
  ): CustomInstructionBuilder {
    // just add the account metadata to array
    this.accounts.push(
      new AccountMetadata(
        account instanceof Account ? account.key : account,
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
  public async build(): Promise<TransactionInstruction> {
    // serialize Payload to buffer as instruction data
    const data = this.data ? this.data!.toBuffer() : Buffer.alloc(0);
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
      programId: this.program.id,
      keys,
      data,
    });
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
