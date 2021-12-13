import { Keypair, PublicKey } from '@solana/web3.js';
import { PDA, Program, Solana, TransactionBuilder } from '..';

export default abstract class Action<T extends Program> {
  protected program: T;
  private isInitialized: boolean = false;

  public user: Keypair;
  public pdas: { [key: string]: PDA } = {};
  public keys: { [key: string]: PublicKey } = {};
  public signature: string | null = null;

  public abstract onInitialize(): Promise<void>;
  // eslint-disable-next-line no-unused-vars
  public abstract onPerform(tx: TransactionBuilder): Promise<string>;

  constructor(program: T, user: Keypair) {
    this.program = program;
    this.user = user;
  }
  public async initialize(): Promise<void> {
    await this.onInitialize();
  }
  public async perform(): Promise<void> {
    if (!this.isInitialized) {
      await this.onInitialize();
      this.isInitialized = true;
    }
    const tx = Solana.begin();
    this.signature = await this.onPerform(tx);
  }
}
