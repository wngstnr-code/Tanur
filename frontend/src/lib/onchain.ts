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
    tx: 'd782b72aa9e929b074b86785a21e7c29a63579614c5d3ded82a9fa3c7e036522',
  },
  {
    n: 2,
    title: 'Fund yield',
    desc: 'Nickel revenue is funded into TanurYield as 100 USDC for the epoch — a 30-day claim window opens.',
    method: 'fund_epoch',
    tx: 'de14f90c0ade1ceaed33d26db4ab1d9edecf29b0864e35767a3d81e9640f5be8',
  },
  {
    n: 3,
    title: 'Claim USDC',
    desc: 'A KYC-authorized holder claims 60 USDC (pro-rata), gated by a cross-contract KYC read to the Vault.',
    method: 'claim',
    tx: 'c56180c3deeb62389a32526d97ab6b2335fc0bc2aec7845eec2052ee7c344067',
  },
];
