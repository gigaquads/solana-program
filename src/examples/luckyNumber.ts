import 'reflect-metadata';
import Message from '../Message';
import {variant, field} from '../decorators';
import Program from '../Program';

const PROJECT_PATH = (
  process.env.PROJECT_PATH || process.env.HOME + '/projects/rust/solana/base/'
);

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
  // initialize client interface to deployed on-chain Solana program.
  const program = await new Program(
    PROJECT_PATH + '/dist/program/base-keypair.json',
    PROJECT_PATH + '/dist/program/base.so',
  ).connect();

  // create account to store lucky number in. (background: accounts hold a SOL
  // balance as well as optional storage space used by owner program.)
  const accountSize = 1; // in bytes
  const account = await program.getOrCreateAccount('lucky_number', accountSize);

  // prepare list of account keys needed to execute instruction. In this case,
  // only the account that stores the lucky number.
  const keys = [
    {
      pubkey: account.key,
      isWritable: true,
      isSigner: false,
    },
  ];

  // execute instruction on chain
  await program.execute(
    keys,
    new LuckyNumber({value: Math.round(Math.random() * 100)}),
  );

  // read updated lucky number from block chain.
  {
    const account = await program.getAccount('lucky_number');
    const luckyNumber = account.deserializeTo<LuckyNumber>(new LuckyNumber());

    console.log(`lucky number now set to ${luckyNumber.value}`);
  }
}

// program point of entry:
main().then(
  () => process.exit(),
  err => {
    console.error(err);
    process.exit(-1);
  },
);
