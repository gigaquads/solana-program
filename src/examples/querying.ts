import 'reflect-metadata';
import { Keypair } from '@solana/web3.js';
import { field } from '../core/util';
import Program from '../core/Program';
import ProgramObject from '../core/ProgramObject';
import { run } from './util';

/**
 * Instruction data for use in creating a new UserProfile account.
 */
class UserProfile extends ProgramObject {
  static readonly TAG = 0;

  @field('u8')
  tag?: number;

  @field('u8')
  age?: number;

  @field('String', { space: 512 })
  email?: string;
}

/**
 * Example of querying via the Program's select method.
 */
class ExampleProgram extends Program {
  /**
   * Main function.
   * @param {Keypair} user - The (paying) user's keypair.
   */
  // eslint-disable-next-line no-unused-vars
  async main(user: Keypair) {
    const query = this.select(UserProfile).match({
      tag: UserProfile.TAG,
      email: 'example@example.com',
    });
    const accounts = await query.execute();
    accounts.forEach((account) => {
      console.log(account.data!.email);
    });
  }
}

// node process entrypoint:
run(ExampleProgram).then(
  () => process.exit(),
  (err) => {
    console.error(err);
    process.exit(-1);
  },
);
