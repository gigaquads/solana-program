import 'reflect-metadata';
import {Payload, variant, field} from '../payload';
import Solana from '../Solana';
import Program from '../Program';
import {Addressable, CustomInstructionBuilder} from '../InstructionBuilder';

const PROJECT_PATH =
  process.env.PROJECT_PATH || `${process.env.HOME}/projects/rust/solana/base/`;

/**
 * Data structure received by Rust program containing a "lucky number". This
 * gets deserialized to a Rust enum variant.
 */
@variant(0)
class CreateLuckyNumber extends Payload {
  @field('u8')
  value?: number;

  @field('String')
  lucky_number_owner_key?: string;
}

/**
 * Update existing lucky number account.
 */
@variant(1)
class UpdateLuckyNumber extends Payload {
  @field('u8')
  value?: number;

  @field('String')
  lucky_number_owner_key?: string;
}

/**
 * Lucky number program.
 */
class LuckyNumberProgram extends Program {
  /**
   * Create an instruction that updates the program's lucky number.
   * @param {Addressable} account - Account or public key of account.
   * @param {CreateLuckyNumber} data - instruction data
   * @return {CustomInstructionBuilder} - and Instruction builder instance.
   */
  public initializeLuckyNumber(
    account: Addressable,
    data: CreateLuckyNumber,
  ): CustomInstructionBuilder {
    return this.newInstruction(data).withAccount(account, {isWritable: true});
  }

  /**
   * Create an instruction that updates the program's lucky number.
   * @param {Addressable} account - Account or public key of account.
   * @param {UpdateLuckyNumber} data - instruction data
   * @return {CustomInstructionBuilder} - and Instruction builder instance.
   */
  public updateLuckyNumber(
    account: Addressable,
    data: UpdateLuckyNumber,
  ): CustomInstructionBuilder {
    return this.newInstruction(data).withAccount(account, {isWritable: true});
  }
}

/**
 * Client main function.
 */
async function main() {
  const program = new LuckyNumberProgram(
    `${PROJECT_PATH}/dist/program/base-keypair.json`,
    `${PROJECT_PATH}/dist/program/base.so`,
  );

  await program.connect();

  // just who's gonna pay for the transaction?
  const payer = Solana.cli.keyPair;

  // we're going to create an account to store the user's lucky number in, so we
  // need to derive an address for the account. we elect here to use the
  // transaction payer's public key.
  const key = await program.deriveAddress(
    payer.publicKey,
    'lucky_number',
  );

  // new lucky number between 0 .. 100
  const newLuckyNumber = Math.round(100 * Math.random());

  // init, build and execute transaction
  const tx = Solana.transaction();

  if (await program.hasAccount(key)) {
    // if account exists, just update existing value,
    // no need to create new account
    console.log('updating lucky number...');
    tx.add(
      program.updateLuckyNumber(
        key,
        new UpdateLuckyNumber({
          value: newLuckyNumber,
          lucky_number_owner_key: payer.publicKey.toString(),
        }),
      ),
    );
  } else {
    // create a lucky_number account for the payer
    // and initialize a value.
    console.log('creating account and initializing lucky number...');
    const payload = new CreateLuckyNumber({
      value: newLuckyNumber,
      lucky_number_owner_key: payer.publicKey.toString(),
    });
    tx.add(
      program.createUserSpaceAccount(payer, 'lucky_number', payload),
      program.initializeLuckyNumber(key, payload)
    );
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
