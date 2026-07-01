'use client';

import { Reveal } from '@/components/motion/Reveal';
import { CountUp } from '@/components/motion/CountUp';
import Button from '@/components/ui/Button';
import { fmtAmount } from '@/lib/format';
import { useChainState } from '@/lib/useChainState';
import { useNickelHistory } from '@/lib/useNickelHistory';
import { LineTrend } from '@/components/ui/LineTrend';

export default function RwaSection() {
  const s = useChainState();
  const hist = useNickelHistory();
  const nickelValueM = s ? (s.total_tonnes * s.latest_lme_price_cents) / 100 / 1_000_000 : 0;
  const rep = s?.oracle_reputation ?? 0;

  return (
    <section id="rwa" className="flex min-h-screen flex-col justify-center px-5 py-24 sm:px-8 sm:py-32">
      <div className="mx-auto w-full max-w-content">
      <Reveal className="mx-auto mb-12 max-w-3xl text-center">
        <div className="inline-flex items-center justify-center gap-2 text-[12px] font-medium uppercase tracking-[0.14em] text-brand">
          <span className="h-px w-5 bg-brand/40" />
          Real-world asset
        </div>
        <h2 className="mt-4 font-display text-4xl font-semibold tracking-tighter2 text-ink text-balance sm:text-5xl">
          The world&apos;s largest nickel producer, brought on-chain.
        </h2>
      </Reveal>

      <Reveal>
        <div className="rounded-3xl border border-line bg-bg-2/60 p-3 sm:p-4">
          <div className="grid gap-3 lg:grid-cols-3">
            {/* product card (tall, left) — clean, no image */}
            <div className="relative flex flex-col overflow-hidden rounded-2xl border border-line bg-card shadow-card lg:row-span-2">
              {/* thin smelter-heat rule (signature, not an image) */}
              <div className="h-1 w-full bg-gradient-to-r from-brand via-brand-bright to-orange" />

              <div className="flex flex-1 flex-col p-7">
                {/* icon */}
                <div className="grid h-12 w-12 place-items-center rounded-xl border border-line bg-bg-2">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src="/tanur_dark.svg" alt="" className="h-7 w-7" />
                </div>

                <h3 className="mt-6 font-display text-2xl tracking-tightish text-ink">
                  <span className="font-semibold">Tanur</span>
                  <span className="font-semibold"> Protocol</span>
                </h3>
                <p className="mt-3 text-[14px] leading-relaxed text-muted">
                  Tokenized nickel revenue on Stellar — verified by an AI oracle,
                  minted as TANUR, and claimable as USDC yield.
                </p>
                <div className="mt-4 flex flex-wrap gap-2">
                  {['Stellar Asset', 'KYC-gated', 'USDC yield'].map((b) => (
                    <span key={b} className="rounded-full bg-bg-2 px-2.5 py-1 text-[11px] text-muted">
                      {b}
                    </span>
                  ))}
                </div>

                <div className="mt-auto pt-8">
                  <div className="flex items-center gap-2 border-t border-line pt-5 font-mono text-[11px] text-faint">
                    <span className="h-1.5 w-1.5 rounded-full bg-brand" />
                    Live on Stellar Testnet
                  </div>
                  <div className="mt-5">
                    <Button href="/app" variant="primary" size="md">
                      Launch App →
                    </Button>
                  </div>
                </div>
              </div>
            </div>

            {/* verified value + chart (wide, top-right) */}
            <div className="rounded-2xl border border-line bg-card p-7 shadow-card lg:col-span-2">
              <div className="flex items-start justify-between">
                <div>
                  <div className="text-[12px] text-faint">Verified nickel value</div>
                  <div className="mt-1 font-display text-4xl font-semibold tracking-tighter2 text-ink">
                    {s ? <CountUp to={nickelValueM} format={(v) => `$${v.toFixed(2)}M`} /> : '—'}
                  </div>
                </div>
                <span className="rounded-md border border-line px-2 py-1 font-mono text-[11px] text-brand">
                  recorded on-chain
                </span>
              </div>
              <div className="mt-5 flex items-center justify-between">
                <span className="font-mono text-[11px] uppercase tracking-[0.1em] text-faint">
                  Nickel price · FRED/IMF
                </span>
                {hist && (
                  <span className="rounded-md bg-brand px-2 py-0.5 font-mono text-[11px] text-white">
                    {hist.change_pct >= 0 ? '+' : ''}
                    {hist.change_pct}% · 5y
                  </span>
                )}
              </div>
              <div className="mt-2 h-32">
                <LineTrend id="rwa" data={hist?.series.map((p) => p.price)} />
              </div>
            </div>

            {/* nickel recorded (bottom-right-left) */}
            <div className="rounded-2xl border border-line bg-card p-7 shadow-card">
              <div className="text-[12px] text-faint">Nickel recorded</div>
              <div className="mt-1 font-display text-4xl font-semibold tracking-tighter2 text-ink">
                {s ? <CountUp to={s.total_tonnes} format={(v) => `${Math.round(v).toLocaleString()} t`} /> : '—'}
              </div>
              <p className="mt-3 text-[13px] leading-relaxed text-muted">
                Across {s?.epoch_count ?? 0} verified epoch(s), priced from the
                live FRED/IMF nickel feed.
              </p>
            </div>

            {/* oracle reputation + bars (bottom-right-right) */}
            <div className="rounded-2xl border border-line bg-card p-7 shadow-card">
              <div className="text-[12px] text-faint">Oracle reputation</div>
              <div className="mt-1 font-display text-4xl font-semibold tracking-tighter2 text-ink">
                {s ? <CountUp to={rep} format={(v) => `${Math.round(v)}/100`} /> : '—'}
              </div>
              <div className="mt-5">
                <div className="h-2 w-full overflow-hidden rounded-md bg-bg-2">
                  <div
                    className="h-full rounded-md bg-brand transition-[width] duration-700"
                    style={{ width: `${rep}%` }}
                  />
                </div>
                <div className="mt-2.5 flex justify-between font-mono text-[11px] text-faint">
                  <span>{s?.oracle_submission_count ?? 0} submissions</span>
                  <span>{rep >= 90 ? 'Excellent' : rep >= 75 ? 'Good' : 'Review'}</span>
                </div>
              </div>
            </div>
          </div>

          {/* footnote row: TANUR supply */}
          <div className="mt-3 flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-line bg-card px-7 py-5 shadow-card">
            <span className="font-display text-lg font-semibold text-ink">
              {s ? fmtAmount(s.total_minted) : '—'}{' '}
              <span className="text-muted">TANUR minted</span>
            </span>
            <span className="font-mono text-[12px] text-faint">
              yield-bearing · claimable in USDC
            </span>
          </div>
        </div>
      </Reveal>
      </div>
    </section>
  );
}
