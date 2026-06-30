'use client';

import { useCallback, useEffect, useState } from 'react';
import { ASSETS, TANUR_DECIMALS } from './config';
import { horizon, viewContract } from './stellar';

export type Position = {
  tanur: number; // whole-token accounting units (display decimals 0)
  usdc: number; // 7-decimal USDC
  tanurTrustline: boolean; // TANUR trustline exists
  kycAuthorized: boolean; // issuer authorized the TANUR trustline (= native KYC)
};

/**
 * Reads the connected account's live position: TANUR balance via the SAC
 * (raw integer), USDC via Horizon, and whether the TANUR trustline is
 * issuer-authorized (the native KYC gate).
 */
export function useTanurBalance(address?: string) {
  const [pos, setPos] = useState<Position | null>(null);
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!address) {
      setPos(null);
      return;
    }
    setLoading(true);
    setErr(null);
    try {
      const { Address } = await import('@stellar/stellar-sdk');
      const tanurRaw = await viewContract<bigint>(ASSETS.tanur.sac, 'balance', [
        Address.fromString(address).toScVal(),
      ]).catch(() => BigInt(0));

      let usdc = 0;
      let tanurTrustline = false;
      let kycAuthorized = false;
      try {
        const acct = await horizon.loadAccount(address);
        for (const b of acct.balances) {
          if (b.asset_type === 'native') continue;
          const code = (b as { asset_code?: string }).asset_code;
          const issuer = (b as { asset_issuer?: string }).asset_issuer;
          if (code === ASSETS.usdc.code && issuer === ASSETS.usdc.issuer) {
            usdc = Number(b.balance);
          }
          if (code === ASSETS.tanur.code && issuer === ASSETS.tanur.issuer) {
            tanurTrustline = true;
            kycAuthorized = (b as { is_authorized?: boolean }).is_authorized === true;
          }
        }
      } catch {
        /* account not funded yet */
      }

      setPos({
        tanur: Number(tanurRaw) / 10 ** TANUR_DECIMALS,
        usdc,
        tanurTrustline,
        kycAuthorized,
      });
    } catch (e) {
      setErr(String(e));
      setPos(null);
    } finally {
      setLoading(false);
    }
  }, [address]);

  useEffect(() => {
    load();
  }, [load]);

  return { pos, loading, err, reload: load };
}
