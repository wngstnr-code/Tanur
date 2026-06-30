import { NETWORK } from './config';

export const txUrl = (hash: string) => `${NETWORK.explorer}/tx/${hash}`;
export const contractUrl = (id: string) =>
  `${NETWORK.explorer}/contract/${id}`;

// The full economic loop executed on Stellar Testnet (see README). Hashes are
// filled by deploy/run-loop.sh; '' renders as "pending" in OnChainProof.
export type LoopStep = {
  n: number;
  title: string;
  desc: string;
  method: string;
  tx: string;
};

export const LOOP_STEPS: LoopStep[] = [
  {
    n: 1,
    title: 'Record + mint',
    desc: 'AI oracle records a verified nickel epoch (LME+HPM+Antam); TanurVault mints TANUR atomically from it.',
    method: 'record_epoch',
    tx: 'aec624c8374726cea1b387e5dd31e2e0603421d69e3e9a71f014c966d5fe8735',
  },
  {
    n: 2,
    title: 'Fund yield',
    desc: 'Nickel revenue is funded into TanurYield as 100 USDC for the epoch — a 30-day claim window opens.',
    method: 'fund_epoch',
    tx: 'cde626b44895a37d850623ce792b16e3c75d3a13956dff86db0a4561f58a2c68',
  },
  {
    n: 3,
    title: 'Claim USDC',
    desc: 'A KYC-authorized holder claims 60 USDC (pro-rata), gated by a cross-contract KYC read to the Vault.',
    method: 'claim',
    tx: 'a2c23cd396d168d89082541f0da34f8f7fe5244abedff8d01ab7de4f7f4ef9f1',
  },
];
