# Solana Program

This library builds upon @solana/web3.js with slightly higher-level yet shallow
abstractions and interacting with Solana programs that is more natural to read
than raw web3.js code.

## Installing

x`yarn add solana-program` or `npm install solana-program`.

## Building & Executing Instructions

Custom instructions can be built using the `InstructionBuilder` API. For example:

```typescript
const instr = program
  .instruction()
  .account(user.publicKey, { isSigner: true, isWritable: true })
  .account(dataAccountPublicKey, { isWritable: true })
  .data(data);
```

You can add one or more `InstructionBuilder` objects to a transaction, using the
`TransactionBuilder`, like so:

```typescript
const trans = Solana.begin().add(instr).sign(user);
const signature = trans.execute();
```

## Querying Program Accounts

### Querying in `@solana/web3.js`

In order to retrieve a program's accounts using just `@solana/web3.js`, you
normally use some form of `getProgramAccounts`. Queries can be filtered
according to (1) the total size of the target account's data and (2) the
contents of specific bytes contained therein. This often looks like:

```typescript
const results = await getProgramAccounts(programId, {
  encoding: 'jsonParsed',
  filters: [
    {
      dataSize: 165,
    },
    {
      memcmp: {
        offset: 0,
        bytes: b58.encode([1]),
      },
    },
    {
      memcmp: {
        offset: 2,
        bytes: b58.encode('example@email.com'),
      },
    },
  ],
});
```

### Querying in `solana-program`

In contrast, `solana-program` provides a more intuitive interface. The same
query would be written as follows:

```typescript
// example data structure we're storing in account
class UserAccountData extends ProgramObject {
  @field('u8')
  tag: number = 1;

  @field('u8')
  age?: number;

  @field('String', { space: 256 })
  username?: number;
}

// select all user accounts with username "glorp" note that the dataSize filter
// is automatically added; however, it could be set explicitly via
// program.select(Person).size(...)...
const accounts = await program
  .select(Person)
  .match({ tag: 1, username: 'glorp' })
  .execute();
```

## Basic Example

This is a complete example of building a client for a Solana program that simply
initializes and sets a "lucky number" in an account.

```typescript
class LuckyNumber extends ProgramObject {
  @field('u8')
  value?: number;
}

class LuckyNumberProgram extends Program {
  public setLuckyNumber(
    luckyNumberAddress: Address,
    value: number,
  ): CustomInstructionBuilder {
    return this
      .instruction(new LuckyNumber({ value })
      .account(luckyNumberAddress, { isWritable: true, });
  }
}

async function main(user: Keypair, program: LuckyNumberProgram) {
  await Solana.initialize();

  // compute public key address of program's "lucky number" account
  const luckyNumberKey = await program.deriveAddress(
    user.publicKey, 'lucky-number'
  );
  // randomly select new lucky number between 0 .. 100
  const luckyNumber = Math.round(100 * Math.random());

  // get existing account, if exists
  const account = await program.getAccount(LuckyNumber, luckNumberKey);

  // start building a new transaction
  const tx = Solana.begin();

  // create lucky number account if does not exist
  if (account === null) {
    const space = 1;
    console.log('creating "lucky number" account');
    tx.add(
      program.createAccountWithSeed(
        user, 'lucky-number', luckyNumberKey, space
      )
    );
  }
  // upsert new lucky number
  console.log('setting new "lucky number"');
  tx.add(program.setLuckyNumber(luckyNumberKey, luckyNumber));

  // sign & execute transaction
  const signature = await tx.sign(user).execute();
  console.log('transaction signature:', signature);
}
```
