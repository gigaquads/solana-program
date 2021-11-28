import { Keypair } from '@solana/web3.js';
import fs from 'mz/fs';

/**
 * Load a Keypair from file.
 * @param {string} path - path to keypair file.
 * @return {Promise<Keypair>} - Keypair
 */
export async function loadKeypair(path: string): Promise<Keypair> {
  const secretKeyString = await fs.readFile(path, { encoding: 'utf8' });
  const secretKey = Uint8Array.from(JSON.parse(secretKeyString));
  return Keypair.fromSecretKey(secretKey);
}
