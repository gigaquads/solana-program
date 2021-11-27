import 'reflect-metadata';
import InstructionData from '../core/InstructionData';
import {variant, field} from '../decorators';
import Solana from '../core/Solana';
import Program from '../core/Program';
import {CustomInstructionBuilder} from '../core/builders';

const PROJECT_PATH =
  process.env.PROJECT_PATH || `${process.env.HOME}/projects/rust/solana/base/`;

/**
 * Data to store in account @ our program-derived address (PDA).
 */
@variant(0)
class FirstValue extends InstructionData {
  @field('u8')
  value?: number;
}

@variant(1)
class NewValue extends InstructionData {
  @field('u8')
  value?: number;
}

/**
 * Lucky number program.
 */
class PdaProgram extends Program {
  /**
   * Initialize the on-chain value stored @ our PDA.
   * @param {FirstValue} data - instruction data
   * @return {CustomInstructionBuilder} - and Instruction builder instance.
   */
  public initializeValue(payload: FirstValue): CustomInstructionBuilder {
    return this.newInstruction(payload);
  }

  /**
   * Replace on-chain value with a new value.
   * @param {UpdateLuckyNumber} data - instruction data
   * @return {CustomInstructionBuilder} - and Instruction builder instance.
   */
  public updateValue(data: NewValue): CustomInstructionBuilder {
    return this.newInstruction(data);
  }
}

/**
 * Client main function.
 */
async function main() {
  const program = new PdaProgram(
    `${PROJECT_PATH}/dist/program/base-keypair.json`,
    `${PROJECT_PATH}/dist/program/base.so`,
  );

  await program.load();

  // just who's gonna pay for the transaction?
  const payer = Solana.cli.keyPair;

  // we're going to create an account to store the user's lucky number in, so we
  // need to derive an address for the account. we elect here to use the
  // transaction payer's public key.
  // const key = await program.deriveAddress(payer.publicKey, 'lucky_number');
  // eslint-disable-next-line no-unused-vars
  const [key, _nonce] = await program.deriveProgramAddress(['lucky_number']);

  // new lucky number between 0 .. 100
  const value = Math.round(100 * Math.random());

  // init, build and execute transaction
  const tx = Solana.transaction();

  if (await program.hasAccount(key)) {
    console.log('updating on-chain value...');
    tx.add(program.updateValue(new NewValue({value})));
  } else {
    console.log('initializing PDA account and setting initial value...');
    tx.add(program.initializeValue(new FirstValue({value})));
  }
  // execute transaction
  const signature = await tx.sign(payer).execute();
  console.log('executed transaction signature', signature);
}

/**
 * Entrypoint for `yarn run start`.
 */
async function start(): Promise<void> {
  // initialize must be called before anything
  await Solana.initialize();
  await main();
}

start().then(
  () => process.exit(),
  (err) => {
    console.error(err);
    process.exit(-1);
  },
);
