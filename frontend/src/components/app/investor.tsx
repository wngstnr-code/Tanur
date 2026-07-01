'use client';

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react';
import { useAccount } from '@/lib/useAccount';
import { useChainState } from '@/lib/useChainState';
import { useTanurBalance, type Position } from '@/lib/useTanurBalance';
import { useFx } from '@/lib/useFx';
import { useTanurPrice } from '@/lib/useTanurPrice';
import { signXdr } from '@/lib/wallet';
import { buildClaimXdr, fetchClaim } from '@/lib/claim';
import { buildBuyXdr } from '@/lib/buy';
import { submitSigned, submitSignedClassic, viewContract } from '@/lib/stellar';
import { CONTRACTS, USDC_DECIMALS, type ContractState } from '@/lib/config';

export type Phase =
  | { phase: 'idle' }
  | { phase: 'working'; note: string }
  | { phase: 'done'; hash: string }
  | { phase: 'error'; message: string };

type InvestorValue = {
  // wallet
  address?: string;
  connected: boolean;
  ready: boolean;
  connect: () => void;
  disconnect: () => void;
  // data
  state: ContractState | null;
  pos: Position | null;
  reload: () => void;
  idr: number;
  tanurPrice: number | null; // USDC per TANUR (best bid), null if no book
  // derived
  supply: number;
  myShare: number; // 0..1
  portfolioUsd: number;
  hasMark: boolean; // true when a TANUR mark is available
  estApyPct: number; // from GORR band
  entitlement: number | null; // USDC entitlement for latest epoch (from snapshot)
  alreadyClaimed: boolean | null; // has the holder already claimed the latest epoch
  nextDistribution: Date; // end of current monthly claim window (est.)
  // actions
  claim: Phase;
  buy: Phase;
  handleClaim: () => Promise<void>;
  handleBuy: (usdcSpend: string) => Promise<void>;
};

const Ctx = createContext<InvestorValue | null>(null);

export function InvestorProvider({ children }: { children: ReactNode }) {
  const { address, connected, ready, connect, disconnect } = useAccount();
  const state = useChainState();
  const { pos, reload } = useTanurBalance(address);
  const idr = useFx();
  const price = useTanurPrice();

  const [claim, setClaim] = useState<Phase>({ phase: 'idle' });
  const [buy, setBuy] = useState<Phase>({ phase: 'idle' });
  const [entitlement, setEntitlement] = useState<number | null>(null);
  const [alreadyClaimed, setAlreadyClaimed] = useState<boolean | null>(null);

  const tanurPrice = price?.bid ?? price?.mid ?? null;

  // pull the connected holder's USDC entitlement for the latest funded epoch
  // straight from the published Merkle snapshot (real, not fabricated).
  useEffect(() => {
    let alive = true;
    if (!address || !state || state.latest_epoch <= 0) {
      setEntitlement(null);
      setAlreadyClaimed(null);
      return;
    }
    // snapshot amounts are in stroops (7-decimal) — convert to whole USDC for display.
    fetchClaim(state.latest_epoch, address).then((e) => {
      if (alive) setEntitlement(e ? e.amount / 10 ** USDC_DECIMALS : 0);
    });
    // has this holder already claimed the latest epoch? (read on-chain)
    (async () => {
      try {
        const { nativeToScVal, Address } = await import('@stellar/stellar-sdk');
        const claimed = await viewContract<boolean>(CONTRACTS.yield, 'has_claimed', [
          nativeToScVal(state.latest_epoch, { type: 'u32' }),
          Address.fromString(address).toScVal(),
        ]);
        if (alive) setAlreadyClaimed(Boolean(claimed));
      } catch {
        if (alive) setAlreadyClaimed(null);
      }
    })();
    return () => {
      alive = false;
    };
  }, [address, state, claim]);

  const derived = useMemo(() => {
    const supply = state?.total_minted ?? 0;
    const tanur = pos?.tanur ?? 0;
    const usdc = pos?.usdc ?? 0;
    const myShare = supply ? tanur / supply : 0;
    const hasMark = tanurPrice != null && tanurPrice > 0;
    const portfolioUsd = usdc + (hasMark ? tanur * (tanurPrice as number) : 0);
    // GORR sits in the 1–10% safety band; surface it as an estimated protocol rate.
    const estApyPct = state ? state.gorr_bps / 100 : 0;
    // monthly epoch cadence → next distribution ≈ end of the current calendar month.
    const now = new Date();
    const nextDistribution = new Date(now.getFullYear(), now.getMonth() + 1, 1);
    return { supply, myShare, hasMark, portfolioUsd, estApyPct, nextDistribution };
  }, [state, pos, tanurPrice]);

  const handleClaim = useCallback(async () => {
    if (!address || !state) return;
    try {
      setClaim({ phase: 'working', note: 'Fetching entitlement…' });
      const entry = await fetchClaim(state.latest_epoch, address);
      if (!entry) {
        setClaim({ phase: 'error', message: 'No entitlement in this epoch snapshot.' });
        return;
      }
      setClaim({ phase: 'working', note: 'Building claim…' });
      const xdr = await buildClaimXdr(address, state.latest_epoch, entry.amount, entry.proof);
      setClaim({ phase: 'working', note: 'Sign in your wallet…' });
      const signed = await signXdr(xdr, address);
      setClaim({ phase: 'working', note: 'Submitting…' });
      const hash = await submitSigned(signed);
      setClaim({ phase: 'done', hash });
      reload();
    } catch (e) {
      setClaim({ phase: 'error', message: humanError(e) });
    }
  }, [address, state, reload]);

  const handleBuy = useCallback(
    async (usdcSpend: string) => {
      if (!address) return;
      try {
        setBuy({ phase: 'working', note: 'Building order…' });
        const xdr = await buildBuyXdr(address, usdcSpend);
        setBuy({ phase: 'working', note: 'Sign in your wallet…' });
        const signed = await signXdr(xdr, address);
        setBuy({ phase: 'working', note: 'Submitting…' });
        const hash = await submitSignedClassic(signed);
        setBuy({ phase: 'done', hash });
        reload();
      } catch (e) {
        setBuy({ phase: 'error', message: humanError(e) });
      }
    },
    [address, reload]
  );

  const value: InvestorValue = {
    address,
    connected,
    ready,
    connect,
    disconnect,
    state,
    pos,
    reload,
    idr,
    tanurPrice,
    ...derived,
    entitlement,
    alreadyClaimed,
    claim,
    buy,
    handleClaim,
    handleBuy,
  };

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useInvestor(): InvestorValue {
  const v = useContext(Ctx);
  if (!v) throw new Error('useInvestor must be used within <InvestorProvider>');
  return v;
}

export function humanError(e: unknown): string {
  const m = e instanceof Error ? e.message : String(e);
  if (/op_no_trust|no_trust/i.test(m)) return 'No authorized TANUR trustline.';
  if (/too few offers|no path|op_too_few/i.test(m)) return 'No SDEX liquidity yet.';
  if (/NotKyc|#5/i.test(m)) return 'Account not KYC-authorized.';
  if (/AlreadyClaimed|#9/i.test(m)) return 'Already claimed this epoch.';
  if (/EpochNotFound|#6/i.test(m)) return 'No funded epoch to claim yet.';
  if (/reject|denied|cancel/i.test(m)) return 'Signature cancelled.';
  return m.length > 80 ? m.slice(0, 80) + '…' : m;
}
