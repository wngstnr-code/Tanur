'use client';

// Tanur — build the TanurYield.claim(holder, epoch, amount, proof) invocation.
// The entitlement amount is fixed by the Merkle snapshot committed at fund time,
// so the connected wallet must present the exact (amount, proof) for its leaf.
// The contract checks KYC via a cross-contract read to the Vault and verifies the
// proof against the epoch's committed root.
import * as StellarSdk from '@stellar/stellar-sdk';
import { Buffer } from 'buffer';
import { CONTRACTS } from './config';
import { buildInvoke } from './stellar';

export type ClaimEntry = { amount: number; proof: string[] };
export type EpochProofs = { root: string; claims: Record<string, ClaimEntry> };

/** Fetch the entitlement + proof for `holder` in `epoch` from the published snapshot. */
export async function fetchClaim(
  epoch: number,
  holder: string
): Promise<ClaimEntry | null> {
  try {
    const res = await fetch(`/proofs-epoch-${epoch}.json`, { cache: 'no-store' });
    if (!res.ok) return null;
    const data: EpochProofs = await res.json();
    return data.claims[holder] ?? null;
  } catch {
    return null;
  }
}

export async function buildClaimXdr(
  holder: string,
  epoch: number,
  amount: number | string,
  proof: string[]
): Promise<string> {
  const proofScv = StellarSdk.xdr.ScVal.scvVec(
    proof.map((h) =>
      StellarSdk.xdr.ScVal.scvBytes(Buffer.from(h, 'hex'))
    )
  );
  return buildInvoke(holder, CONTRACTS.yield, 'claim', [
    StellarSdk.Address.fromString(holder).toScVal(),
    StellarSdk.nativeToScVal(epoch, { type: 'u32' }),
    StellarSdk.nativeToScVal(BigInt(amount), { type: 'i128' }),
    proofScv,
  ]);
}
