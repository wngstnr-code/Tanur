'use client';

// Tanur — build the changeTrust op that opens a TANUR trustline. Because TANUR is
// AUTH_REQUIRED, adding the trustline is step one; the issuer then authorizes it
// after KYC (native Stellar compliance — no custom registry).
import * as StellarSdk from '@stellar/stellar-sdk';
import { ASSETS } from './config';
import { horizon, PASSPHRASE } from './stellar';

export async function buildTrustlineXdr(account: string): Promise<string> {
  const acct = await horizon.loadAccount(account);
  const tanur = new StellarSdk.Asset(ASSETS.tanur.code, ASSETS.tanur.issuer);
  const tx = new StellarSdk.TransactionBuilder(acct, {
    fee: StellarSdk.BASE_FEE,
    networkPassphrase: PASSPHRASE,
  })
    .addOperation(StellarSdk.Operation.changeTrust({ asset: tanur }))
    .setTimeout(120)
    .build();
  return tx.toXDR();
}
