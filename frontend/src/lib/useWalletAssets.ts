'use client';

import { useEffect, useState } from 'react';
import { horizon } from './stellar';
import { ASSETS } from './config';

export type WalletAsset = {
  code: string;
  issuer?: string;
  balance: number;
  authorized: boolean; // true for native + authorized trustlines
  kind: 'native' | 'tanur' | 'usdc' | 'other';
};

// Every asset held by the connected account (native XLM + all trustlines), read
// live from Horizon. Used to render the full Holdings table.
export function useWalletAssets(address?: string, refreshKey = 0) {
  const [assets, setAssets] = useState<WalletAsset[] | null>(null);

  useEffect(() => {
    if (!address) {
      setAssets(null);
      return;
    }
    let alive = true;
    (async () => {
      try {
        const acct = await horizon.loadAccount(address);
        const out: WalletAsset[] = [];
        for (const b of acct.balances) {
          if (b.asset_type === 'native') {
            out.push({ code: 'XLM', balance: Number(b.balance), authorized: true, kind: 'native' });
            continue;
          }
          const code = (b as { asset_code?: string }).asset_code ?? '?';
          const issuer = (b as { asset_issuer?: string }).asset_issuer;
          const authorized = (b as { is_authorized?: boolean }).is_authorized !== false;
          const kind: WalletAsset['kind'] =
            code === ASSETS.tanur.code && issuer === ASSETS.tanur.issuer
              ? 'tanur'
              : code === ASSETS.usdc.code && issuer === ASSETS.usdc.issuer
              ? 'usdc'
              : 'other';
          out.push({ code, issuer, balance: Number(b.balance), authorized, kind });
        }
        // TANUR first, then USDC, then XLM, then the rest — most relevant on top.
        const rank = (a: WalletAsset) =>
          a.kind === 'tanur' ? 0 : a.kind === 'usdc' ? 1 : a.kind === 'native' ? 2 : 3;
        out.sort((a, b) => rank(a) - rank(b));
        if (alive) setAssets(out);
      } catch {
        if (alive) setAssets([]); // account not funded yet
      }
    })();
    return () => {
      alive = false;
    };
  }, [address, refreshKey]);

  return assets;
}
