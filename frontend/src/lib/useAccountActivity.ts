'use client';

import { useEffect, useState } from 'react';
import { horizon } from './stellar';
import { ASSETS } from './config';

export type ActivityKind = 'buy' | 'claim' | 'trustline' | 'payment' | 'other';

export type Activity = {
  id: string;
  kind: ActivityKind;
  label: string;
  detail?: string;
  when: string; // ISO timestamp
  tx: string;
};

// The connected wallet's own recent on-chain history, read live from Horizon.
// (Not the protocol's demo loop — that lives on the landing page as proof.)
function mapOp(op: Record<string, unknown>): Activity | null {
  const id = String(op.id ?? '');
  const tx = String(op.transaction_hash ?? '');
  const when = String(op.created_at ?? '');
  const type = String(op.type ?? '');
  const amount = op.amount ? Number(op.amount) : undefined;
  const code = (op.asset_code as string) ?? 'XLM';

  switch (type) {
    case 'change_trust':
      return {
        id,
        tx,
        when,
        kind: 'trustline',
        label: `Trustline · ${(op.asset_code as string) ?? '—'}`,
        detail: (op.asset_code as string) === ASSETS.tanur.code ? 'TANUR opt-in' : undefined,
      };
    case 'path_payment_strict_send':
    case 'path_payment_strict_receive': {
      const dest = (op.asset_code as string) ?? 'XLM';
      const src = (op.source_asset_code as string) ?? 'XLM';
      return {
        id,
        tx,
        when,
        kind: dest === ASSETS.tanur.code ? 'buy' : 'payment',
        label: dest === ASSETS.tanur.code ? 'Bought TANUR' : `Swap ${src} → ${dest}`,
        detail: amount ? `${amount.toLocaleString('en-US')} ${dest}` : undefined,
      };
    }
    case 'payment':
      return {
        id,
        tx,
        when,
        kind: 'payment',
        label: `Payment · ${code}`,
        detail: amount ? `${amount.toLocaleString('en-US')} ${code}` : undefined,
      };
    case 'invoke_host_function':
      return {
        id,
        tx,
        when,
        kind: 'claim',
        label: 'Contract call',
        detail: 'Yield claim / mint',
      };
    default:
      return null;
  }
}

export function useAccountActivity(address?: string) {
  const [items, setItems] = useState<Activity[] | null>(null);

  useEffect(() => {
    if (!address) {
      setItems(null);
      return;
    }
    let alive = true;
    (async () => {
      try {
        const res = await horizon
          .operations()
          .forAccount(address)
          .order('desc')
          .limit(15)
          .call();
        const acts = (res.records as unknown as Record<string, unknown>[])
          .map(mapOp)
          .filter((a): a is Activity => a !== null)
          .slice(0, 8);
        if (alive) setItems(acts);
      } catch {
        if (alive) setItems([]); // account not funded / no history yet
      }
    })();
    return () => {
      alive = false;
    };
  }, [address]);

  return items;
}
