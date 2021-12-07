# Solana Program
This library builds upon @solana/web3.js with slightly higher-level yet shallow
abstractions and interacting with Solana programs that is more natural to read
than raw web3.js code.

## Installing
Just run `yarn add solana-program` or `npm install solana-program`.

## Basic Example
This is a complete example of building a client for a Solana program that simply
initializes and sets a "lucky number" in an account.

```typescript
@tag(0)
class SetLuckyNumber extends InstructionData {
  @field('u8')
  value?: number;
}


class LuckyNumberProgram extends Program {
  public setLuckyNumber(
    account: PublicKey | Account, data: SetLuckyNumber,
  ): CustomInstructionBuilder {
    return this
      .newInstruction(data)
      .withAccount(account, {isWritable: true});
  }
}


async function main(user: Keypair, program: LuckyNumberProgram) {
  await Solana.initialize()

  // compute public key address of program's "lucky number" account
  const key = await program.deriveAddress(user.publicKey, 'lucky_number');

  // randomly select new lucky number between 0 .. 100
  const data = new SetLuckyNumber({value: Math.round(100 * Math.random())});

  // get existing account, if exists
  const account = await program.getAccount(key);

  // start building a new transaction
  const tx = Solana.begin();

  // create lucky number account if does not exist
  if (account === null) {
    console.log('creating "lucky number" account');
    tx.add(program.createAccountWithSeed(user, 'lucky_number', key, data));
  }
  // upsert new lucky number
  console.log('setting new "lucky number"');
  tx.add(program.setLuckyNumber(key, data));

  // sign & execute transaction
  const signature = await tx.sign(user).execute();
  console.log('transaction signature:', signature);
}
```