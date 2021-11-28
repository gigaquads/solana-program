import 'reflect-metadata';
import { InstructionData, tag, field } from '../core/instruction';
import Solana from '../core/Solana';
import Program from '../core/Program';
import Account from '../core/Account';
import { CustomInstructionBuilder } from '../core/builders';
import { Keypair, PublicKey } from '@solana/web3.js';
import { loadKeypair } from '../cli';

/**
 * Data structure for "create lucky number" instruction.
 */
@tag(0)
class CreateLuckyNumber extends InstructionData {
  @field('u8')
  value?: number;
}

/**
 * Data structure for "update lucky number" instruction.
 */
@tag(1)
class UpdateLuckyNumber extends InstructionData {
  @field('u8')
  value?: number;
}

/**
 * Lucky number Solana program client.
 */
class LuckyNumberProgram extends Program {
  /**
   * Create an instruction that updates the program's lucky number.
   * @param {Account | PublicKey} account - Account or public key of account.
   * @param {CreateLuckyNumber} data - instruction data
   * @return {CustomInstructionBuilder} - and Instruction builder instance.
   */
  public initializeLuckyNumber(
    account: Account | PublicKey,
    data: CreateLuckyNumber,
  ): CustomInstructionBuilder {
    return this.newInstruction(data).withAccount(account, { isWritable: true });
  }

  /**
   * Create an instruction that updates the program's lucky number.
   * @param {Account | PublicKey} account - Account or public key of account.
   * @param {UpdateLuckyNumber} data - instruction data
   * @return {CustomInstructionBuilder} - and Instruction builder instance.
   */
  public updateLuckyNumber(
    account: Account | PublicKey,
    data: UpdateLuckyNumber,
  ): CustomInstructionBuilder {
    return this.newInstruction(data).withAccount(account, { isWritable: true });
  }
}

/**
 * Main function.
 */
async function main(payer: Keypair, program: LuckyNumberProgram) {
  // we're going to create an account to store the user's lucky number in, so we
  // need to derive an address for the account. we elect here to use the
  // transaction payer's public key.
  const key = await program.deriveAddress(payer, 'lucky_number');

  // new lucky number between 0 .. 100
  const value = Math.round(100 * Math.random());

  // init, build and execute transaction
  const tx = Solana.begin();

  if (await program.hasAccount(key)) {
    console.log('updating lucky number...');
    // if account exists, just update existing value,
    // no need to create new account
    tx.add(program.updateLuckyNumber(key, new UpdateLuckyNumber({ value })));
  } else {
    console.log('creating account and initializing lucky number...');
    // create a lucky_number account for the payer
    // and initialize a value.
    const payload = new CreateLuckyNumber({ value });
    tx.add(
      program.createAccountWithSeed(payer, 'lucky_number', key, payload),
      // program.initializeLuckyNumber(key, payload),
    );
  }
  // execute transaction
  const signature = await tx.sign(payer).execute();
  console.log('transaction signature:', signature);
}

/**
 * Entrypoint for `yarn run start`.
 */
async function start(): Promise<void> {
  // load keypair of target on-chain program
  const programKeypairPath = process.env.PROGRAM_KEYPAIR_PATH;
  if (!programKeypairPath) {
    throw Error('PROGRAM_KEYPAIR_PATH environment var required');
  }
  // load keypair of the fee payer
  const payerKeypairPath = process.env.PAYER_KEYPAIR_PATH;
  if (!payerKeypairPath) {
    throw Error('PAYER_KEYPAIR_PATH environment var required');
  }
  // load keypairs, intantiate program, init and run.
  const payer = await loadKeypair(payerKeypairPath);
  const programKeypair = await loadKeypair(programKeypairPath);
  const program = new LuckyNumberProgram(programKeypair.publicKey);

  await Solana.initialize();
  await main(payer, program);
}

// node process entrypoint:
start().then(
  () => process.exit(),
  (err) => {
    console.error(err);
    process.exit(-1);
  },
);
