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
    tx: '76fac31e5b83312926fc1e1ed8150e90e789525e4bae79febc3481aedf11da02',
  },
  {
    n: 2,
    title: 'Fund yield',
    desc: 'Nickel revenue is funded into TanurYield as 100 USDC for the epoch — a 30-day claim window opens.',
    method: 'fund_epoch',
    tx: '38bb4aa3c97b8c46f37a69eceaf8989816e346d6feee315a51a31f2dc9c054b4',
  },
  {
    n: 3,
    title: 'Claim USDC',
    desc: 'A KYC-authorized holder claims 60 USDC (pro-rata), gated by a cross-contract KYC read to the Vault.',
    method: 'claim',
    tx: 'c22b7b5a71b7f34844ab1f57c9cd31a09b0f4ca45951ea98f88b57b2ab2cd409',
  },
];
