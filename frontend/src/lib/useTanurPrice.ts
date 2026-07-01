'use client';

import { useEffect, useState } from 'react';
import { ASSETS } from './config';
import { horizon } from './stellar';

// Live TANUR→USDC price from the SDEX orderbook (the same book buy.ts path-pays
// through). We take the best bid (what a holder could sell TANUR for) as an honest
// mark for portfolio valuation. Returns null when the book is empty — callers then
// fall back to a count-only display rather than fabricating a price.
export type TanurPrice = {
  bid: number | null; // USDC per TANUR (best bid)
  ask: number | null; // USDC per TANUR (best ask)
  mid: number | null;
};

let cache: TanurPrice | null = null;
let inflight: Promise<TanurPrice> | null = null;

async function load(): Promise<TanurPrice> {
  if (cache) return cache;
  if (inflight) return inflight;
  const { Asset } = await import('@stellar/stellar-sdk');
  inflight = horizon
    .orderbook(
      new Asset(ASSETS.tanur.code, ASSETS.tanur.issuer),
      new Asset(ASSETS.usdc.code, ASSETS.usdc.issuer)
    )
    .limit(1)
    .call()
    .then((ob) => {
      const bid = ob.bids?.[0] ? Number(ob.bids[0].price) : null;
      const ask = ob.asks?.[0] ? Number(ob.asks[0].price) : null;
      const mid = bid != null && ask != null ? (bid + ask) / 2 : bid ?? ask;
      cache = { bid, ask, mid };
      return cache;
    })
    .catch(() => ({ bid: null, ask: null, mid: null }))
    .finally(() => {
      inflight = null;
    });
  return inflight;
}

export function useTanurPrice() {
  const [price, setPrice] = useState<TanurPrice | null>(cache);
  useEffect(() => {
    let alive = true;
    load().then((p) => alive && setPrice(p));
    return () => {
      alive = false;
    };
  }, []);
  return price;
}
