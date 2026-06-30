// Tanur — Stellar SDK setup (Horizon + Soroban RPC) and a contract-view helper.
import * as StellarSdk from '@stellar/stellar-sdk';
import { NETWORK } from './config';

export const horizon = new StellarSdk.Horizon.Server(NETWORK.horizonUrl);
export const rpc = new StellarSdk.rpc.Server(NETWORK.rpcUrl);
export const PASSPHRASE = NETWORK.passphrase;

export const txUrl = (hash: string) => `${NETWORK.explorer}/tx/${hash}`;
export const contractUrl = (id: string) => `${NETWORK.explorer}/contract/${id}`;

// Read-only contract call: simulate a getter and return its native value.
// Uses a throwaway funded-account stand-in for the source (simulation never
// submits, so the source just needs to exist on-chain).
export async function viewContract<T = unknown>(
  contractId: string,
  method: string,
  args: StellarSdk.xdr.ScVal[] = [],
  sourceAddress = 'GBZGYR2VIVJEB4HHUQNXYST4KY4GSACXYCDQITDUEDFKDDSZFIJADLN3'
): Promise<T> {
  const account = await rpc.getAccount(sourceAddress);
  const contract = new StellarSdk.Contract(contractId);
  const tx = new StellarSdk.TransactionBuilder(account, {
    fee: StellarSdk.BASE_FEE,
    networkPassphrase: PASSPHRASE,
  })
    .addOperation(contract.call(method, ...args))
    .setTimeout(30)
    .build();

  const sim = await rpc.simulateTransaction(tx);
  if (StellarSdk.rpc.Api.isSimulationError(sim) || !sim.result) {
    throw new Error(`view ${method} failed`);
  }
  return StellarSdk.scValToNative(sim.result.retval) as T;
}

// Build → simulate → assemble an invoke tx, returning XDR ready for the wallet
// to sign. Caller submits the signed XDR with submitSigned().
export async function buildInvoke(
  sourceAddress: string,
  contractId: string,
  method: string,
  args: StellarSdk.xdr.ScVal[]
): Promise<string> {
  const account = await rpc.getAccount(sourceAddress);
  const contract = new StellarSdk.Contract(contractId);
  let tx = new StellarSdk.TransactionBuilder(account, {
    fee: StellarSdk.BASE_FEE,
    networkPassphrase: PASSPHRASE,
  })
    .addOperation(contract.call(method, ...args))
    .setTimeout(120)
    .build();

  const sim = await rpc.simulateTransaction(tx);
  if (StellarSdk.rpc.Api.isSimulationError(sim)) {
    throw new Error(`Simulation failed: ${sim.error}`);
  }
  tx = StellarSdk.rpc.assembleTransaction(tx, sim).build();
  return tx.toXDR();
}

// Submit a wallet-signed classic (Horizon) transaction.
export async function submitSignedClassic(signedXdr: string): Promise<string> {
  const tx = StellarSdk.TransactionBuilder.fromXDR(
    signedXdr,
    PASSPHRASE
  ) as StellarSdk.Transaction;
  const res = await horizon.submitTransaction(tx);
  return res.hash;
}

// Submit a wallet-signed XDR over RPC and wait for confirmation.
export async function submitSigned(signedXdr: string): Promise<string> {
  const tx = StellarSdk.TransactionBuilder.fromXDR(
    signedXdr,
    PASSPHRASE
  ) as StellarSdk.Transaction;
  const sent = await rpc.sendTransaction(tx);
  if (sent.status === 'ERROR') {
    throw new Error(`Submit failed: ${JSON.stringify(sent.errorResult)}`);
  }
  let got = await rpc.getTransaction(sent.hash);
  for (let i = 0; got.status === 'NOT_FOUND' && i < 30; i++) {
    await new Promise((r) => setTimeout(r, 1500));
    got = await rpc.getTransaction(sent.hash);
  }
  if (got.status !== 'SUCCESS') {
    throw new Error(`Transaction ${got.status}`);
  }
  return sent.hash;
}
