import 'reflect-metadata';
import { Keypair } from '@solana/web3.js';
import { field } from '../core/util';
import Solana from '../core/Solana';
import Program from '../core/Program';
import ProgramObject from '../core/ProgramObject';
import { ExampleProgramInterface, run } from './util';

/**
 * u8 opcode, written to the first byte of instruction data, used on the backend
 * to route the instruction to appropriate handler.
 */
enum OpCode {
  CreateUserProfile = 0,
}

/**
 * Instruction data for use in creating a new UserProfile account.
 */
class NewUserProfile extends ProgramObject {
  @field('String')
  email?: string;

  @field('u8')
  age?: number;

  @field('u8')
  nonce?: number;
}

/**
 * Example program, demoing the API for building a custom "create user profile
 * account" instruction.
 */
class ExampleProgram extends Program implements ExampleProgramInterface {
  /**
   * Main function.
   * @param {Keypair} user - The (paying) user's keypair.
   */
  async main(user: Keypair) {
    // generate a program-derived address for new user profile data
    const pda = await this.findAddress([user.publicKey, 'profile']);
    const profile = new NewUserProfile({
      nonce: pda.nonce,
      email: 'example@example.com',
      age: 69,
    });
    // Create a custom instruction. Recall that an instruction has 3 main
    // segments: Program ID, Account address array, and data. Below, the "opcode"
    // is serialized as the first byte of instruction data. The on-chain program
    // is responsible for routing the instruction based on this value. Each
    // account address is specified, using a PDA, Keypair and PublicKey. See the
    // `Address` type for all recognized argument types.
    const ixCreateUserProfile = this.instruction(OpCode.CreateUserProfile)
      .account(user, { isSigner: true, isWritable: true })
      .account(pda, { isWritable: true })
      .account(Program.systemProgramPublicKey)
      .data(profile);

    // Add "create account instruction to transaction, sign and execute
    await Solana.begin().add(ixCreateUserProfile).sign(user).execute();
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
