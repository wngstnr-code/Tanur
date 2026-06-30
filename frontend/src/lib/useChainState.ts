'use client';

import { useEffect, useState } from 'react';
import { CONTRACTS, TANUR_DECIMALS, type ContractState } from './config';
import { viewContract } from './stellar';

const num = (v: unknown) => Number(v ?? 0);

// Read TanurVault state live via Soroban RPC simulation (no fees, no signing).
async function readState(): Promise<ContractState | null> {
  try {
    const [reputation, submissions, totalMinted, totalTonnes, epochCount, latestEpoch, gorr, rate] =
      await Promise.all([
        viewContract<number>(CONTRACTS.vault, 'get_oracle_reputation'),
        viewContract<number>(CONTRACTS.vault, 'get_submission_count'),
        viewContract<bigint>(CONTRACTS.vault, 'get_total_minted'),
        viewContract<bigint>(CONTRACTS.vault, 'get_total_tonnes'),
        viewContract<number>(CONTRACTS.vault, 'get_epoch_count'),
        viewContract<number>(CONTRACTS.vault, 'get_latest_epoch'),
        viewContract<number>(CONTRACTS.vault, 'get_gorr'),
        viewContract<number>(CONTRACTS.vault, 'get_token_rate'),
      ]);

    let label = '—';
    let tonnes = 0;
    let lme = 0;
    let hpm = 0;
    let score = 0;
    if (num(latestEpoch) > 0) {
      try {
        const { nativeToScVal } = await import('@stellar/stellar-sdk');
        const rec = await viewContract<Record<string, unknown>>(
          CONTRACTS.vault,
          'get_epoch',
          [nativeToScVal(num(latestEpoch), { type: 'u32' })]
        );
        label = String(rec.label ?? '—');
        tonnes = num(rec.tonnes);
        lme = num(rec.lme_price_cents);
        hpm = num(rec.hpm_price_cents);
        score = num(rec.score);
      } catch {
        /* latest epoch record unavailable */
      }
    }

    return {
      oracle_reputation: num(reputation),
      oracle_submission_count: num(submissions),
      total_minted: num(totalMinted) / 10 ** TANUR_DECIMALS,
      total_tonnes: num(totalTonnes),
      epoch_count: num(epochCount),
      latest_epoch: num(latestEpoch),
      gorr_bps: num(gorr),
      token_rate: num(rate),
      latest_label: label,
      latest_tonnes: tonnes,
      latest_lme_price_cents: lme,
      latest_hpm_price_cents: hpm,
      latest_score: score,
    };
  } catch {
    return null;
  }
}

let cache: ContractState | null = null;
let inflight: Promise<ContractState | null> | null = null;

function fetchState(): Promise<ContractState | null> {
  if (cache) return Promise.resolve(cache);
  if (inflight) return inflight;
  inflight = readState()
    .then((s) => {
      cache = s;
      return s;
    })
    .finally(() => {
      inflight = null;
    });
  return inflight;
}

export function useChainState() {
  const [state, setState] = useState<ContractState | null>(cache);
  useEffect(() => {
    let alive = true;
    fetchState().then((s) => alive && s && setState(s));
    return () => {
      alive = false;
    };
  }, []);
  return state;
}
