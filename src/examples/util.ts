import { Keypair, PublicKey } from '@solana/web3.js';
import { loadKeypair } from '../cli';
import Program from '../core/Program';
import Solana from '../core/Solana';

export interface ExampleProgramInterface extends Program {
  /**
   * Main function.
   * @param {Keypair} user - The (paying) user's keypair.
   */
  main(user: Keypair): Promise<void>;
}

/**
 * Entrypoint for `yarn run start`.
 */
export async function run<T extends ExampleProgramInterface>(
  // eslint-disable-next-line no-unused-vars
  programClass: new (programId: PublicKey) => T,
): Promise<void> {
  // load keypair of target on-chain program
  const programKeypairPath = process.env.PROGRAM_KEYPAIR_PATH;
  if (!programKeypairPath) {
    throw Error('PROGRAM_KEYPAIR_PATH environment var required');
  }
  // load keypair of the fee payer
  const payerKeypairPath = process.env.PAYER_KEYPAIR_PATH;
  if (!payerKeypairPath) {
    throw Error('PAYER_KEYPAIR_PATH environment var required');
  }
  // load keypairs, intantiate program, init and run.
  const payer = await loadKeypair(payerKeypairPath);
  const programKeypair = await loadKeypair(programKeypairPath);
  const program = new programClass(programKeypair.publicKey);

  await Solana.initialize();
  await program.main(payer);
}
