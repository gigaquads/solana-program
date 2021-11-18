import 'reflect-metadata';
import Message from '../Message';
import {variant, field} from '../decorators';
import Solana from '../Solana';

const PROJECT_PATH =
  process.env.PROJECT_PATH || `${process.env.HOME}/projects/rust/solana/base/`;

/**
 * Data structure received by Rust program containing a "lucky number". This
 * gets deserialized to a Rust enum variant.
 */
@variant(0)
class LuckyNumber extends Message {
  @field('u8')
    value?: number;
}

/**
 * Client main function.
 */
async function main() {
  const program = await Solana.getProgram(
    `${PROJECT_PATH}/dist/program/base-keypair.json`,
    `${PROJECT_PATH}/dist/program/base.so`,
  );

  // create account to store lucky number in. (background: accounts hold a SOL
  // balance as well as optional storage space used by owner program.)
  const accountSize = 1; // in bytes
  const account = await program.getOrCreateAccount('lucky_number', accountSize);
  const value = Math.round(Math.random() * 255);
  const luckyNumber = new LuckyNumber({value});

  // create and execute transaction instruction
  const instr = program
    .newInstruction(luckyNumber)
    .withAccount(account, {isSigner: false, isWritable: true});

  await instr.execute();

  // read updated lucky number from account stored on chain.
  {
    const account = await program.getAccount('lucky_number');
    const luckyNumber = new LuckyNumber(account);

    console.log(`lucky number now set to ${luckyNumber.value}`);
  }
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
