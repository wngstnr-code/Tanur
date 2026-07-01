'use client';

// Tanur — add the TANUR trustline (classic changeTrust). This is the first half
// of the native-KYC flow: the holder opts in to the asset, then the issuer
// authorizes the line off-chain (AUTH_REQUIRED). Mirrors the tx-building pattern
// in buy.ts.
import * as StellarSdk from '@stellar/stellar-sdk';
import { ASSETS } from './config';
import { horizon, PASSPHRASE } from './stellar';

export async function buildTrustlineXdr(account: string): Promise<string> {
  const src = await horizon.loadAccount(account);
  const tx = new StellarSdk.TransactionBuilder(src, {
    fee: StellarSdk.BASE_FEE,
    networkPassphrase: PASSPHRASE,
  })
    .addOperation(
      StellarSdk.Operation.changeTrust({
        asset: new StellarSdk.Asset(ASSETS.tanur.code, ASSETS.tanur.issuer),
      })
    )
    .setTimeout(120)
    .build();
  return tx.toXDR();
}
