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
    tx: '09e368743d675ad3f34ce9044f120b07fc721a253cce754ca1c6256e3a67d989',
  },
  {
    n: 2,
    title: 'Fund yield',
    desc: 'Nickel revenue is funded into TanurYield as 100 USDC for the epoch — a 30-day claim window opens.',
    method: 'fund_epoch',
    tx: '907f895e7a5b5bb9abb86481151d15776301ac067fabfcc0c4adbd7a8d7b9044',
  },
  {
    n: 3,
    title: 'Claim USDC',
    desc: 'A KYC-authorized holder claims 60 USDC (pro-rata), gated by a cross-contract KYC read to the Vault.',
    method: 'claim',
    tx: '2b86c229a4bc6700303e60a5576da81ef5308654433c4e02edcb8060aa141986',
  },
];
