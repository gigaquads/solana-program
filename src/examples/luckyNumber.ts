import 'reflect-metadata';
import { Keypair } from '@solana/web3.js';
import { field } from '../core/util';
import { CustomInstructionBuilder } from '../core/builders';
import { Address } from '../core/types';
import Solana from '../core/Solana';
import Program from '../core/Program';
import ProgramObject from '../core/ProgramObject';
import { run } from './util';

const TAG_INITIALIZE_LUCKY_NUMBER = 0;
const TAG_UPDATE_LUCKY_NUMBER = 1;

/**
 * Data structure for "create" and "update" lucky number instructions.
 */
class LuckyNumber extends ProgramObject {
  @field('u8')
  value?: number;
}

/**
 * Lucky number Solana program client.
 */
class LuckyNumberProgram extends Program {
  /**
   * Main function.
   */
  async main(payer: Keypair) {
    // we're going to create an account to store the user's lucky number in, so we
    // need to derive an address for the account. we elect here to use the
    // transaction payer's public key.
    const key = await this.deriveAddress(payer, 'lucky_number');

    // new lucky number between 0 .. 100
    const value = Math.round(100 * Math.random());

    // init, build and execute transaction
    const tx = Solana.begin();

    if (await this.hasAccount(key)) {
      console.log('updating lucky number...');
      // if account exists, just update existing value,
      // no need to create new account
      tx.add(this.updateLuckyNumber(key, new LuckyNumber({ value })));
    } else {
      console.log('creating account and initializing lucky number...');
      // create a lucky_number account for the payer
      // and initialize a value.
      const payload = new LuckyNumber({ value });
      tx.add(
        this.createAccountWithSeed(payer, 'lucky_number', key, payload),
        // program.initializeLuckyNumber(key, payload),
      );
    }
    // execute transaction
    const signature = await tx.sign(payer).execute();
    console.log('transaction signature:', signature);
  }

  /**
   * Create an instruction that updates the program's lucky number.
   * @param {Address} account - Account or public key of account.
   * @param {LuckyNumber} luckyNumber - instruction data
   * @return {CustomInstructionBuilder} - and Instruction builder instance.
   */
  public initializeLuckyNumber(
    luckyNumberAddress: Address,
    luckyNumber: LuckyNumber,
  ): CustomInstructionBuilder {
    return this.instruction(luckyNumber)
      .tag(TAG_INITIALIZE_LUCKY_NUMBER)
      .account(luckyNumberAddress, { isWritable: true });
  }

  /**
   * Create an instruction that updates the program's lucky number.
   * @param {Address} account - Account or public key of account.
   * @param {LuckyNumber} luckyNumber - instruction data
   * @return {CustomInstructionBuilder} - and Instruction builder instance.
   */
  public updateLuckyNumber(
    luckyNumberAddress: Address,
    luckyNumber: LuckyNumber,
  ): CustomInstructionBuilder {
    return this.instruction(luckyNumber)
      .tag(TAG_UPDATE_LUCKY_NUMBER)
      .account(luckyNumberAddress, { isWritable: true });
  }
}

// node process entrypoint:
run(LuckyNumberProgram).then(
  () => process.exit(),
  (err) => {
    console.error(err);
    process.exit(-1);
  },
);
