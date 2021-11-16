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
 * LuckyNumber is the data structure serialized to and from the on-chain Rust
 * program. In this case, it's just a single short int representing a "lucky
 * number" that the Rust app stores in an account.
 */
@variant(0)
class LuckyNumber extends Message {
  @field('u8')
  value?: number;
}

async function main() {
  // establish client connection with blockchain
  const program = await new Program(
    './rust-program/dist/program/base-keypair.json',
    './rust-program/dist/program/base.so',
  ).connect();

  // create program-owned account for "lucky number" storage
  const accountSize = 1; // size in bytes
  const account = await program.getOrCreateAccount(
    'lucky_number', accountSize
  );

  // prepare instruction to execute...
  // 1) arbitrary message/payload to send to on-chain app
  // 2) metadata for accounts accessed by instruction
  const luckyNumber = new LuckyNumber({value: 69});
  const keys = [{
    pubkey: account.key,
    isWritable: true,
    isSigner: false
  }];

  // execute instruction in on-chain transaction
  await program.execute(keys, luckyNumber);

  // read updated lucky number from account stored on chain,
  // deserializing the account data buffer into a LuckyNumber.
  {
    const account = await program.getAccount('lucky_number');
    const luckyNumber = new LuckyNumber(account);

    console.log(`lucky number now set to ${luckyNumber.value}`);
  }
```

## Background & Motivation
The first iteration of this library was based on the official "Hello, world!"
example. Unfortunately, at the time of writing, neither the official example nor
others out there on the web offered any insight into how real world programs
should be designed or structured.

In particular, the official example walked through the creation of a program
that could only handle a single type of instruction. This would be like a web
framework whose apps only support a single endpoint. As a result, developers
have had to develop all sorts of hard-coded, idiosyncratic ways to represent and
route variable kinds of instruction data. Moreover, when they fail to accomplish
this, they jump prematurely to Anchor, a high-level framework, before having
an adequate grasp of the basic SDK.

The main technical reason for this limitation is Solana's chosen serialization
library: [Borsh](https://github.com/near/borsh). It does not currently support
clean or easy serialization of JavaScript objects to and from Rust enum
variants, which from a backend routing perspective would be ideal. With Rust's
strict memory management rules, using a single struct to represent many
different kinds of payloads isn't entirely feasible; nevertheless, this is
exactly what online examples out there leave you thinking you need to do.

To solve this problem, we implemented a few simple typescript decorators --
`@variant` and `@field` -- which you can see in the example below (based on the
[PR found here](https://github.com/near/borsh-js/pull/39)). These
decorators abstract out all of the boilerplate for generating
Borsh schemas, serialiizing and deserializing, while also reducing the amount  
of deserialization code in Rust to just...

```rust
impl Instruction {
    pub fn unpack(input: &[u8]) -> Result<Self, ProgramError> {
        Ok(Self::try_from_slice(input).unwrap())
    }
}
```