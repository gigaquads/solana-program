# Solana Program

`solana-program` builds upon @solana/web3.js with the intent of reducing the
amount of boilerplate code and lower-level data wrangling necessary when
developing client-side Solana apps. Our goal is to provide a more intuitive,
object-oriented API.

## Installing

`yarn add solana-program` or `npm install solana-program`.

## Building & Executing Instructions

Custom instructions can be built using the `InstructionBuilder` API. For example:

```typescript
const instr = program
  .instruction()
  .account(user.publicKey, { isSigner: true, isWritable: true })
  .account(dataAccountPublicKey, { isWritable: true })
  .data(data);
```

You can add one or more `InstructionBuilder` objects to a transaction, using
`TransactionBuilder`, like so:

```typescript
const tx = Solana.begin().add(instr).sign(user);
const signature = await tx.execute();
```

## Querying Program Accounts

### Querying in `@solana/web3.js`

In order to retrieve a program's accounts using `@solana/web3.js`, you
normally have to use some form of `getProgramAccounts`. Queries can be filtered
according to two main criteria:

1. Total size of the target account's data.
2. Contents of specific slices of data.

It looks something like this:

```typescript
// assuming we have a type of account storing user "comments," here we are
// matching accounts against a "tag" int, signifying account "type", and a
// username string.
const results = await getProgramAccounts(programId, {
  encoding: 'jsonParsed',
  filters: [
    {
      memcmp: {
        offset: 0,
        bytes: b58.encode([1]),
      },
    },
    {
      memcmp: {
        offset: 2,
        bytes: b58.encode(Buffer.from('glorp420')),
      },
    },
    {
      dataSize: 1 + 1 + 256,
    },
  ],
});
```

### Querying in `solana-program`

In contrast, `solana-program` provides a more intuitive interface. The same
query would be written like this:

```typescript
// example data structure we're storing in account
class Comment extends ProgramObject {
  @field('u8')
  tag: number = 1;

  @field('u8')
  age?: number;

  @field('String', { space: 256 })
  username?: string;
}

// select all accounts with username glorp. note that the dataSize filter is
// automatically added; however, it can be set explicitly, via
// program.select(Comment).size(...)...
const accounts = await program
  .select(Comment)
  .match({ tag: 1, username: 'glorp420' })
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
  public async main(user: Keypair) {
    await Solana.initialize();

    const seed = 'lucky-number'
    const key = await this.deriveAddress(user.publicKey, seed);
    const account = await this.getAccount(LuckyNumber, luckNumberKey);
    const luckyNumber = Math.round(100 * Math.random());
    const tx = Solana.begin();

    if (account === null) {
      const space = 1;
      const instr = this.createAccountWithSeed(user, seed, key, space)
      console.log('creating "lucky number" account');
      tx.add(instr);
    }
    console.log('setting new "lucky number"');
    tx.add(this.setLuckyNumber(user, key, luckyNumber));

    const signature = await tx.sign(user).execute();
    console.log('transaction signature:', signature);
  }

  public setLuckyNumber(
    user: Address, key: Address, value: number,
  ): CustomInstructionBuilder {
    return this.instruction()
      .account(user, { isWritable: true, isSigner: true });
      .account(key, { isWritable: true, });
      .data(new LuckyNumber({ value }))
  }
}

```
