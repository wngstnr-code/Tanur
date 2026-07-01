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
    tx: '387ce473c4deadf4021c4895ecc5184893199885991305fdb0c1e3607328c07b',
  },
  {
    n: 2,
    title: 'Fund yield',
    desc: 'Nickel revenue is funded into TanurYield as 100 USDC for the epoch — a 30-day claim window opens.',
    method: 'fund_epoch',
    tx: '0ff5a4138b6bbdd41c126a43b4c9f971cdf92fd789199afe85119ec46d7c058b',
  },
  {
    n: 3,
    title: 'Claim USDC',
    desc: 'A KYC-authorized holder claims 60 USDC (pro-rata), gated by a cross-contract KYC read to the Vault.',
    method: 'claim',
    tx: '1a63254eb07561e9f4325a1328aa757784e645ece5217589cfc8f93654a8aace',
  },
];
