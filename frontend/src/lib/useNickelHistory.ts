'use client';

import { useEffect, useState } from 'react';

export type NickelHistory = {
  series: { date: string; price: number }[];
  latest: number;
  change_pct: number;
  source: string;
};

// Shared across landing + app so the real FRED nickel price history loads once.
let cache: NickelHistory | null = null;
let inflight: Promise<NickelHistory | null> | null = null;

function load(): Promise<NickelHistory | null> {
  if (cache) return Promise.resolve(cache);
  if (inflight) return inflight;
  inflight = fetch('/api/nickel-history')
    .then((r) => (r.ok ? r.json() : null))
    .then((j) => {
      cache = j && j.series ? (j as NickelHistory) : null;
      return cache;
    })
    .catch(() => null)
    .finally(() => {
      inflight = null;
    });
  return inflight;
}

export function useNickelHistory() {
  const [data, setData] = useState<NickelHistory | null>(cache);
  useEffect(() => {
    let alive = true;
    load().then((d) => alive && d && setData(d));
    return () => {
      alive = false;
    };
  }, []);
  return data;
}
