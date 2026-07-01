'use client';

import { useMemo, useState } from 'react';
import Link from 'next/link';
import { useAccount } from '@/lib/useAccount';
import { useChainState } from '@/lib/useChainState';
import { useTanurBalance } from '@/lib/useTanurBalance';
import { useFx } from '@/lib/useFx';
import { signXdr } from '@/lib/wallet';
import { buildClaimXdr, fetchClaim } from '@/lib/claim';
import { buildBuyXdr } from '@/lib/buy';
import { submitSigned, submitSignedClassic, txUrl, contractUrl } from '@/lib/stellar';
import { CONTRACTS, ASSETS } from '@/lib/config';
import { fmtAmount, fmtUsdFromCents, fmtIdr, bpsToPct, shortHash } from '@/lib/format';
import { LOOP_STEPS } from '@/lib/onchain';
import { Section, Card, Stat, Eyebrow } from '@/components/ui/primitives';
import { CountUp } from '@/components/motion/CountUp';
import Button from '@/components/ui/Button';

type Phase =
  | { phase: 'idle' }
  | { phase: 'working'; note: string }
  | { phase: 'done'; hash: string }
  | { phase: 'error'; message: string };

export default function InvestorDashboard() {
  const { address, connected, ready, connect, disconnect } = useAccount();
  const state = useChainState();
  const { pos, reload } = useTanurBalance(address);
  const idr = useFx();

  const [claim, setClaim] = useState<Phase>({ phase: 'idle' });
  const [buy, setBuy] = useState<Phase>({ phase: 'idle' });
  const [usdcSpend, setUsdcSpend] = useState('10');

  const nickelUsdPerTon = state ? state.latest_lme_price_cents / 100 : 0;

  const derived = useMemo(() => {
    const supply = state?.total_minted ?? 0;
    const myShare = pos && supply ? pos.tanur / supply : 0;
    return { supply, myShare };
  }, [state, pos]);

  async function handleClaim() {
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
  }

  async function handleBuy() {
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
  }

  if (!connected) return <ConnectGate ready={ready} onConnect={connect} />;

  return (
    <main className="min-h-screen bg-bg pb-24">
      {/* top bar */}
      <header className="sticky top-0 z-30 border-b border-line bg-bg/80 backdrop-blur">
        <Section className="flex h-16 items-center justify-between">
          <Link href="/" className="font-display text-lg font-600 tracking-tightish text-ink">
            Tanur
          </Link>
          {ready && (
            connected ? (
              <div className="flex items-center gap-3">
                <span className="rounded-full border border-line bg-card px-3 py-1.5 font-mono text-[12px] text-muted">
                  {shortHash(address, 4, 4)}
                </span>
                <Button variant="secondary" size="md" onClick={disconnect}>
                  Disconnect
                </Button>
              </div>
            ) : (
              <Button onClick={connect}>Connect wallet</Button>
            )
          )}
        </Section>
      </header>

      <Section className="pt-12">
        <Eyebrow>Investor dashboard</Eyebrow>
        <h1 className="mt-3 font-display text-4xl tracking-tighter2 text-ink sm:text-5xl">
          Your nickel revenue position
        </h1>
        <p className="mt-3 max-w-2xl text-[15px] text-muted">
          A fractional, yield-bearing claim on Indonesia&apos;s nickel revenue.
          Settled in USDC, displayed in USD &amp; Rupiah. KYC is native — the issuer
          authorizes your TANUR trustline.
        </p>
      </Section>

      {connected && (
        <>
          {/* KYC banner */}
          <Section className="mt-8">
            <Card
              className={`flex flex-wrap items-center justify-between gap-3 p-5 ${
                pos?.kycAuthorized ? 'border-brand/30 bg-brand-tint' : ''
              }`}
            >
              <div className="flex items-center gap-3">
                <span
                  className={`h-2.5 w-2.5 rounded-full ${
                    pos?.kycAuthorized ? 'bg-brand' : 'bg-orange'
                  }`}
                />
                <div>
                  <div className="text-[14px] font-medium text-ink">
                    {pos?.kycAuthorized
                      ? 'KYC authorized — your TANUR trustline is active'
                      : pos?.tanurTrustline
                      ? 'Trustline pending issuer authorization'
                      : 'No TANUR trustline yet'}
                  </div>
                  <div className="text-[12px] text-muted">
                    Native Stellar AUTH_REQUIRED — only authorized accounts can hold TANUR or claim yield.
                  </div>
                </div>
              </div>
              {!pos?.kycAuthorized && (
                <Button href="/#access" variant="secondary">Request access</Button>
              )}
            </Card>
          </Section>

          {/* position */}
          <Section className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <Stat
              label="TANUR balance"
              accent
              value={<CountUp to={pos?.tanur ?? 0} format={(v) => fmtAmount(v)} />}
              sub={`${(derived.myShare * 100).toFixed(2)}% of supply`}
            />
            <Stat
              label="USDC balance"
              value={<CountUp to={pos?.usdc ?? 0} format={(v) => fmtAmount(v, 2)} />}
              sub={pos ? fmtIdr(pos.usdc, idr) : '—'}
            />
            <Stat
              label="Nickel price (LME)"
              value={fmtUsdFromCents(state?.latest_lme_price_cents ?? 0)}
              sub={`${fmtIdr(nickelUsdPerTon, idr)} / ton`}
            />
            <Stat
              label="Oracle reputation"
              value={<><CountUp to={state?.oracle_reputation ?? 0} />/100</>}
              sub={`${state?.epoch_count ?? 0} epochs recorded`}
            />
          </Section>

          {/* actions */}
          <Section className="mt-6 grid gap-4 lg:grid-cols-2">
            {/* claim */}
            <Card className="p-7">
              <div className="text-[11px] font-medium uppercase tracking-[0.12em] text-faint">
                Claim yield
              </div>
              <h3 className="mt-2 font-display text-2xl text-ink">USDC, KYC-gated</h3>
              <p className="mt-2 text-[14px] text-muted">
                Claim your USDC entitlement for the latest funded epoch
                {state ? ` (#${state.latest_epoch})` : ''}. The amount is fixed by a
                Merkle snapshot; the contract verifies your proof and KYC on-chain.
              </p>
              <div className="mt-5 flex items-center gap-3">
                <Button
                  onClick={handleClaim}
                  disabled={claim.phase === 'working' || !pos?.kycAuthorized}
                >
                  {claim.phase === 'working' ? claim.note : 'Claim USDC'}
                </Button>
                <PhaseNote phase={claim} />
              </div>
            </Card>

            {/* buy */}
            <Card className="p-7">
              <div className="text-[11px] font-medium uppercase tracking-[0.12em] text-faint">
                Buy TANUR
              </div>
              <h3 className="mt-2 font-display text-2xl text-ink">Spend USDC on SDEX</h3>
              <p className="mt-2 text-[14px] text-muted">
                Path-payment USDC → TANUR via Stellar&apos;s built-in orderbook. Requires
                a live TANUR/USDC offer and an authorized trustline.
              </p>
              <div className="mt-5 flex flex-wrap items-center gap-3">
                <div className="flex items-center rounded-lg border border-line-2 bg-white px-3 py-2">
                  <input
                    value={usdcSpend}
                    onChange={(e) => setUsdcSpend(e.target.value)}
                    inputMode="decimal"
                    className="w-20 bg-transparent text-[15px] tabular-nums outline-none"
                  />
                  <span className="text-[13px] text-faint">USDC</span>
                </div>
                <Button
                  variant="secondary"
                  onClick={handleBuy}
                  disabled={buy.phase === 'working' || !pos?.kycAuthorized}
                >
                  {buy.phase === 'working' ? buy.note : 'Buy'}
                </Button>
                <PhaseNote phase={buy} />
              </div>
            </Card>
          </Section>

          {/* latest verified epoch */}
          {state && state.latest_epoch > 0 && (
            <Section className="mt-6">
              <Card className="p-7">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div className="text-[11px] font-medium uppercase tracking-[0.12em] text-faint">
                    Latest verified epoch — {state.latest_label}
                  </div>
                  <span className="rounded-full bg-brand-tint px-3 py-1 text-[12px] font-medium text-brand">
                    score {state.latest_score}/100
                  </span>
                </div>
                <div className="mt-5 grid gap-6 sm:grid-cols-4">
                  <Field label="Production" value={`${fmtAmount(state.latest_tonnes)} t Ni`} />
                  <Field label="LME price" value={fmtUsdFromCents(state.latest_lme_price_cents)} />
                  <Field label="HMA (ESDM)" value={fmtUsdFromCents(state.latest_hpm_price_cents)} />
                  <Field label="GORR" value={bpsToPct(state.gorr_bps)} />
                </div>
              </Card>
            </Section>
          )}

          {/* on-chain proof */}
          <Section className="mt-6">
            <Eyebrow>On-chain proof</Eyebrow>
            <div className="mt-4 grid gap-3 sm:grid-cols-3">
              {LOOP_STEPS.map((s) => (
                <Card key={s.n} className="p-5">
                  <div className="font-mono text-[12px] text-faint">step {s.n}</div>
                  <div className="mt-1 font-display text-lg text-ink">{s.title}</div>
                  <p className="mt-1 text-[13px] text-muted">{s.desc}</p>
                  {s.tx ? (
                    <a
                      className="mt-3 inline-block font-mono text-[12px] text-brand hover:underline"
                      href={txUrl(s.tx)}
                      target="_blank"
                      rel="noopener noreferrer"
                    >
                      {shortHash(s.tx, 8, 6)} ↗
                    </a>
                  ) : (
                    <div className="mt-3 font-mono text-[12px] text-faint">pending</div>
                  )}
                </Card>
              ))}
            </div>
            <div className="mt-4 flex flex-wrap gap-4 text-[12px] text-muted">
              <a className="hover:text-ink" href={contractUrl(CONTRACTS.vault)} target="_blank" rel="noopener noreferrer">
                TanurVault ↗
              </a>
              <a className="hover:text-ink" href={contractUrl(CONTRACTS.yield)} target="_blank" rel="noopener noreferrer">
                TanurYield ↗
              </a>
              <a className="hover:text-ink" href={contractUrl(ASSETS.tanur.sac)} target="_blank" rel="noopener noreferrer">
                TANUR (SAC) ↗
              </a>
            </div>
          </Section>
        </>
      )}
    </main>
  );
}

function Field({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <div className="text-[11px] uppercase tracking-[0.1em] text-faint">{label}</div>
      <div className="mt-1 font-display text-xl tabular-nums text-ink">{value}</div>
    </div>
  );
}

function PhaseNote({ phase }: { phase: Phase }) {
  if (phase.phase === 'done') {
    return (
      <a
        className="font-mono text-[12px] text-brand hover:underline"
        href={txUrl(phase.hash)}
        target="_blank"
        rel="noopener noreferrer"
      >
        ✓ {shortHash(phase.hash, 6, 4)} ↗
      </a>
    );
  }
  if (phase.phase === 'error') {
    return <span className="text-[12px] text-orange">{phase.message}</span>;
  }
  return null;
}

function humanError(e: unknown): string {
  const m = e instanceof Error ? e.message : String(e);
  if (/op_no_trust|no_trust/i.test(m)) return 'No authorized TANUR trustline.';
  if (/too few offers|no path|op_too_few/i.test(m)) return 'No SDEX liquidity yet.';
  if (/NotKyc|#5/i.test(m)) return 'Account not KYC-authorized.';
  if (/AlreadyClaimed|#9/i.test(m)) return 'Already claimed this epoch.';
  if (/EpochNotFound|#6/i.test(m)) return 'No funded epoch to claim yet.';
  if (/reject|denied|cancel/i.test(m)) return 'Signature cancelled.';
  return m.length > 80 ? m.slice(0, 80) + '…' : m;
}

/* ─────────────────── wallet connect gate (not connected) ─────────────────── */

function ConnectGate({ ready, onConnect }: { ready: boolean; onConnect: () => void }) {
  return (
    <main className="grid min-h-screen place-items-center bg-bg px-5 py-20">
      <div className="flex w-full max-w-xl flex-col items-center text-center">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src="/tanur_dark.svg" alt="Tanur" className="h-28 w-28" />
        <h1 className="mt-4 font-display text-3xl font-semibold tracking-tighter2 text-ink sm:text-4xl">
          Your nickel revenue position
        </h1>
        <p className="mt-3 max-w-xl font-serif text-lg leading-relaxed text-muted">
          Connect a Stellar wallet to view your TANUR holdings and claim USDC
          yield from verified Indonesian nickel production.
        </p>

        <button
          onClick={onConnect}
          disabled={!ready}
          className="mt-8 inline-flex items-center gap-2 rounded-lg bg-ink px-7 py-3 text-sm font-medium text-bg shadow-pill transition-transform hover:-translate-y-0.5 disabled:opacity-50"
        >
          {ready ? 'Connect wallet' : 'Loading…'}
        </button>

        <Link href="/" className="mt-4 text-sm text-muted transition-colors hover:text-ink">
          ← Back to site
        </Link>
      </div>
    </main>
  );
}
