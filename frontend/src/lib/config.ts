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
  vault: 'CBORXURFYF5RZVFW423IE4VWAVU5AD32ZPYTKVVCCOU3LX7ZPY7OGVMJ',
  yield: 'CCTXME7WDWRP7G65SYYTFO2YZ5IKVNERMRF6Q6MAWXSURF66FBD6JUWJ',
} as const;

export const ASSETS = {
  tanur: {
    code: 'TANUR',
    issuer: 'GCSUJWSUHWHNZYN33UC43TKKJEQNOKXEGY6B5H5TBVYOCFYVF7PONKNP',
    sac: 'CDXYMTWV32PKGEOYJT4AMOSPO72RLADKLZ2CDWP7YWKTBXATHNAT3M4D',
  },
  usdc: {
    code: 'USDC',
    issuer: 'GBBD47IF6LWK7P7MDEVSCWR7DPUWV3NY3DTQEVFL4NAT4AQH3ZLLFLA5',
    sac: 'CBIELTK6YBZJU5UP2WWQEUCYKLPU6AUNZ2BQ4WWFEIE3USCIHMXQDAMA',
  },
} as const;

// TANUR is minted as whole-token accounting units on-chain (the vault's mint
// formula tonnes×rate×gorr/10_000 is NOT scaled by 10^decimals), so we display
// the raw integer balance as-is. USDC is a genuine 7-decimal asset.
export const TANUR_DECIMALS = 0;
export const USDC_DECIMALS = 7;

// Investor onboarding contact for KYC (permissioned RWA — issuer authorizes the
// TANUR trustline). Override with NEXT_PUBLIC_ACCESS_EMAIL.
export const ACCESS_EMAIL =
  process.env.NEXT_PUBLIC_ACCESS_EMAIL || 'wangsitsada1234@gmail.com';

export type ContractState = {
  oracle_reputation: number;
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
