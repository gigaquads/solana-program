# Solana Program
This library builds upon @solana/web3.js with slightly higher-level abstractions
and syntactic sugar for interacting with Solana programs. It strives to make it
easy to reason about what's actually going on by not inventing new names or
burying web3.js under multiple layers of framework code.

## Installing
Just run `yarn add solana-program` (or `npm install...`).

## Basic Example
This is a complete example of building a client for a Solana program that simply
initializes and sets a "lucky number" in an account.

```typescript
@variant(0)
class SetLuckyNumber extends InstructionData {
  @field('u8')
  value?: number;
}


class LuckyNumberProgram extends Program {
  public setLuckyNumber(
    account: Addressable, data: SetLuckyNumber,
  ): CustomInstructionBuilder {
    return this
      .newInstruction(data)
      .withAccount(account, {isWritable: true});
  }
}


async function main() {
  await Solana.initialize()

  const programKeypair = await loadKeypair(PROGRAM_KEYPAIR_PATH);
  const program = new LuckyNumberProgram(programKeypair.publicKey);
  const payer = await loadKeypair(PAYER_KEYPAIR_PATH);

  // compute public key address of program's "lucky number" account
  const key = await program.deriveAddress(payer.publicKey, 'lucky_number');

  // randomly select new lucky number between 0 .. 100
  const data = new SetLuckyNumber({value: Math.round(100 * Math.random())});

  // get existing account, if exists
  const account = await program.getAccount(key);

  // start building a new transaction
  const tx = Solana.begin();

  // create lucky number account if does not exist
  if (account === null) {
    console.log('creating "lucky number" account');
    tx.add(program.createAccount(payer, 'lucky_number', data));
  }
  // upsert new lucky number
  console.log('setting new "lucky number"');
  tx.add(program.setLuckyNumber(key, value));

  // sign & execute transaction
  const signature = await tx.sign(payer).execute();
  console.log('transaction signature:', signature);
}
```