import os from 'os';
import fs from 'mz/fs';
import path from 'path';
import yaml from 'yaml';
import {Keypair, Connection, PublicKey} from '@solana/web3.js';

/**
 * Establish a connection to the cluster
 *
 * @param {any} config - Solana Configuration data object.
 */
export async function establishConnection(config: any): Promise<Connection> {
  const rpcUrl = await getRpcUrl(config);
  const connection = new Connection(rpcUrl, 'confirmed');
  const version = await connection.getVersion();
  console.log('Connection to cluster established:', rpcUrl, version);
  return connection;
}

/**
 * Check if the hello world BPF program has been deployed.
 *
 * @param {Connection} connection - Solana connection.
 * @param {string} programSoPath - Filepath to compiled solana .so file.
 * @param {string} programKeypairPath - Filepath to program's keypair.
 */
export async function ensureSolanaProgramIsDeployed(
  connection: Connection,
  programSoPath: string,
  programKeypairPath: string,
): Promise<PublicKey> {
  let programId: PublicKey;

  try {
    // Read program id from keypair file
    const programKeypair = await createKeypairFromFile(programKeypairPath);
    programId = programKeypair.publicKey;
  } catch (err) {
    const errMsg = (err as Error).message;
    throw new Error(
      `Failed to read program keypair at '${programKeypairPath}' due to
        error: ${errMsg}. Program may need to be deployed with \`solana program
        deploy $PROGRAM_SO_PATH\``,
    );
  }
  // Check if the program has been deployed
  const programInfo = await connection.getAccountInfo(programId);
  if (programInfo === null) {
    if (fs.existsSync(programSoPath)) {
      throw new Error(
        `Program needs to be deployed with \`solana program deploy
          $PROGRAM_SO_PATH\``,
      );
    } else {
      throw new Error('Program needs to be built and deployed');
    }
  } else if (!programInfo.executable) {
    throw new Error('Program is not executable');
  }
  console.log(`Using program ${programId.toBase58()}`);
  return programId;
}

/**
 * Load config yaml from $HOME/.config/solana/cli/config.yml.
 *
 * @return {Promise<any>} - Loaded config settings object.
 */
export async function getConfig(): Promise<any> {
  // Path to Solana CLI config file
  const configFilePath = path.resolve(
    os.homedir(),
    '.config',
    'solana',
    'cli',
    'config.yml',
  );
  const configYml = await fs.readFile(configFilePath, {encoding: 'utf8'});
  const config = yaml.parse(configYml);
  return config;
}

/**
 * Load and parse the Solana CLI config file to determine which RPC url to use
 *
 * @param {any} config - Solana config settings object.
 * @return {string} - The JSON RPC URL.
 */
export async function getRpcUrl(config: any): Promise<string> {
  try {
    if (!config.json_rpc_url) throw new Error('Missing RPC URL');
    return config.json_rpc_url;
  } catch (err) {
    console.warn(
      `Failed to read RPC url from CLI config file, 
        falling back to localhost`,
    );
    return 'http://localhost:8899';
  }
}

/**
 * Create a Keypair from a secret key, read from a keypair file.
 *
 * @param {string} filePath - Filepath to program keypair file.
 * @return {Keypair} - Loaded Keypair object.
 */
export async function createKeypairFromFile(
  filePath: string,
): Promise<Keypair> {
  const secretKeyString = await fs.readFile(filePath, {encoding: 'utf8'});
  const secretKey = Uint8Array.from(JSON.parse(secretKeyString));
  return Keypair.fromSecretKey(secretKey);
}

/**
 * If the payer specified in the CLI config file doesn't has insufficient funds
 * to create an account of the given size, request an airdrop to make up the
 * difference.
 *
 * @param {Connection} connection - Solana connection object.
 * @param {any} config - Solana config settings object.
 * @param {number} accountSize - Size of account in bytes.
 * @return {Promise<void>} - Empty promise.
 */
export async function airdropFundsForAccount(
  connection: Connection,
  config: any,
  accountSize: number,
): Promise<void> {
  const {feeCalculator} = await connection.getRecentBlockhash();

  let fees = 0;

  // Calculate the cost to fund the greeter account
  fees += await connection.getMinimumBalanceForRentExemption(accountSize);

  // Calculate the cost of sending transactions
  fees += feeCalculator.lamportsPerSignature * 100; // wag

  const payer = await getPayer(config);

  let lamports = await connection.getBalance(payer.publicKey);
  if (lamports < fees) {
    // If current balance is not enough to pay for fees, request an airdrop
    const sig = await connection.requestAirdrop(
      payer.publicKey,
      fees - lamports,
    );
    await connection.confirmTransaction(sig);
    lamports = await connection.getBalance(payer.publicKey);
  }
}

/**
 * Load and parse the Solana CLI config file to determine which payer to use.
 *
 * @param {any} config - Solana config settings object.
 * @return {Promise<Keypair>} - payer Keypair.
 */
export async function getPayer(config: any): Promise<Keypair> {
  try {
    return await createKeypairFromFile(config.keypair_path);
  } catch (err) {
    console.warn(
      `Failed to create keypair from CLI config file, 
        falling back to new random keypair`,
    );
    return Keypair.generate();
  }
}
