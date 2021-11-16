# Solana Program
This is a high-level client interface for programs on the Solana blockchain. The
first iteration of this library was based on the "hello, world" example provided
by Solana. Unfortunately, their example left a lot to be desired in terms of
clarity, code organization, and general best practices -- misuse of global
variables, large & ambiguous functions, etc.

## Basic Use
Here's an example, showing how to use this library to connect with a deployed
Solana prorgam that simply stores a "lucky number" in an account.

```typescript
@variant(0)
class LuckyNumber extends Message {
  @field('u8')
  value?: number;
}

async function main() {
  const program = await new Program(
    './rust-program/dist/program/base-keypair.json',
    './rust-program/dist/program/base.so',
  ).connect();

  const accountSize = 1; // in bytes
  const account = await program.getOrCreateAccount(
    'lucky_number', accountSize
  );

  // prepare instruction arguments
  const keys = [{pubkey: account.key, isWritable: true, isSigner: false}];
  const data = new LuckyNumber({value: 69});

  await program.execute(keys, data);
```