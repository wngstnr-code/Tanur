'use client';

// Tanur — build the TanurYield.claim(holder, epoch) invocation. The connected
// wallet signs the returned XDR; submission goes through submitSigned(). The
// contract checks KYC via a cross-contract read to the Vault and pays the
// holder's pro-rata USDC share, so the tx MUST originate from the holder.
import * as StellarSdk from '@stellar/stellar-sdk';
import { CONTRACTS } from './config';
import { buildInvoke } from './stellar';

export async function buildClaimXdr(holder: string, epoch: number): Promise<string> {
  return buildInvoke(holder, CONTRACTS.yield, 'claim', [
    StellarSdk.Address.fromString(holder).toScVal(),
    StellarSdk.nativeToScVal(epoch, { type: 'u32' }),
  ]);
}
