# Solana Program
Solana Program is a high-level client for interacting with on-chain Solana
programs from typescript.

## Installing
Just run `yarn add solana-program` (or `npm install...`).

## Basic Example
Here's an example where we connect to an on-chain prorgam that simply stores a
"lucky number" in an account. If the account doesn't already exist, we create
it. Finally, we retreived the updated lucky number and log it.

```typescript
/**
 * Define instruction payload for setting lucky number.
 */
@variant(0)
class SetLuckyNumber extends Payload {
  @field('u8')
  value?: number;
}

/**
 * Define program client with method for "set lucky number" instruction.
 */
class LuckyNumberProgram extends Program {
  public setLuckyNumber(
    account: Addressable, data: CreateLuckyNumber,
  ): CustomInstructionBuilder {
    return this
      .newInstruction(data)
      .withAccount(account, {isWritable: true});
  }
}

/**
 * Create or update on-chain lucky number.
 */
async function main() {
  await Solana.initialize()

  const program = new LuckyNumberProgram(keypairPath, soPath);
  const payer = Solana.cli.keyPair;

  await program.connect();

  // compute user-space address for new account
  const key = await program.deriveAddress(payer.publicKey, 'lucky_number');

  // new lucky number between 0 .. 100
  const payload = new SetLuckyNumber({
    value: Math.round(100 * Math.random())
  })
  // init, build and execute transaction
  const tx = Solana.transaction();

  // create or update lucky number account on-chain
  if (!(await program.hasAccount(key))) {
    tx.add(program.createAccount(payer, 'lucky_number', payload));
  }
  tx.add(program.setLuckyNumber(key, value));

  // sign & execute transaction
  const signature = await tx.sign(payer).execute();
  console.log('executed transaction signature', signature);
}
```

## Background & Motivation
The first iteration of this library was based on the official "Hello, world!"
example. Unfortunately, at the time of writing, neither the official example nor
others out there on the web offered any insight into how real world programs
should be designed or structured. This library aims to be a middle ground
between raw web3 and anchor.
```