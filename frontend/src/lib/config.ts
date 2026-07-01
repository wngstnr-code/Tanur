// Tanur — deployed Stellar Testnet contracts/assets + network.
// Public values, safe to expose to the browser. Mirror of deploy/addresses.json
// (regenerate these IDs if you redeploy).

export const NETWORK = {
  name: 'testnet',
  passphrase: 'Test SDF Network ; September 2015',
  rpcUrl: 'https://soroban-testnet.stellar.org',
  horizonUrl: 'https://horizon-testnet.stellar.org',
  explorer: 'https://stellar.expert/explorer/testnet',
} as const;

export const CONTRACTS = {
  vault: 'CAAQKZFA6SLEGO6NIEFTATWSCS4VP464NA4BJJZFX53LQVUKDANMG2L7',
  yield: 'CCDEL4BVX552UN6C2PO4ZRR54VYJFGARO5ZM7EW6CVA537JR5FVOOHYX',
} as const;

export const ASSETS = {
  tanur: {
    code: 'TANUR',
    issuer: 'GBB76AY5YQA47MTQTIOI6R4FLYBJ7OVV6WSRUIAE6KJIYOLVJKSGQPSL',
    sac: 'CCKIUVK3NDBEIMGYR7HMHQCDIN3ZQ63ALWYDHWNWXVPHXJWVTWUDEEB3',
  },
  usdc: {
    code: 'USDC',
    issuer: 'GBBD47IF6LWK7P7MDEVSCWR7DPUWV3NY3DTQEVFL4NAT4AQH3ZLLFLA5',
    sac: 'CBIELTK6YBZJU5UP2WWQEUCYKLPU6AUNZ2BQ4WWFEIE3USCIHMXQDAMA',
  },
} as const;

// Both TANUR and USDC are 7-decimal Stellar assets. The vault scales its
// whole-token mint by 10^7 so wallets/SDEX/Horizon display TANUR naturally.
export const TANUR_DECIMALS = 7;
export const USDC_DECIMALS = 7;

// Investor onboarding contact for KYC (permissioned RWA — issuer authorizes the
// TANUR trustline). Override with NEXT_PUBLIC_ACCESS_EMAIL.
export const ACCESS_EMAIL =
  process.env.NEXT_PUBLIC_ACCESS_EMAIL || 'wangsitsada1234@gmail.com';

export type ContractState = {
  oracle_reputation: number;
  oracle_submission_count: number;
  total_minted: number;
  total_tonnes: number;
  epoch_count: number;
  latest_epoch: number;
  gorr_bps: number;
  token_rate: number;
  latest_label: string;
  latest_tonnes: number;
  latest_lme_price_cents: number;
  latest_hpm_price_cents: number;
  latest_score: number;
};
