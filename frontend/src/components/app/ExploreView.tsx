'use client';

import { useState } from 'react';
import { Card } from '@/components/ui/primitives';
import Button from '@/components/ui/Button';
import { CountUp } from '@/components/motion/CountUp';
import { useNickelHistory } from '@/lib/useNickelHistory';
import { fmtAmount, fmtUsdFromCents, fmtIdr } from '@/lib/format';
import { useInvestor } from './investor';
import {
  PageHead,
  PhaseNote,
  EpochPanel,
  BalanceHero,
  ChartCard,
  SectionTitle,
  EstTag,
} from './shared';

export default function ExploreView() {
  const { state, idr, tanurPrice, hasMark, estApyPct, buy, handleBuy, pos } = useInvestor();
  const [usdcSpend, setUsdcSpend] = useState('10');
  const history = useNickelHistory();

  const nickelUsdPerTon = state ? state.latest_lme_price_cents / 100 : 0;
  const estTanurOut =
    hasMark && Number(usdcSpend) > 0 ? Number(usdcSpend) / (tanurPrice as number) : null;

  return (
    <div className="space-y-6">
      <PageHead
        title="Explore"
        sub="A fractional, yield-bearing claim on verified Indonesian nickel revenue."
      />

      {/* product hero */}
      <BalanceHero
        label="Nickel price (LME)"
        value={fmtUsdFromCents(state?.latest_lme_price_cents ?? 0)}
        sub={`${fmtIdr(nickelUsdPerTon, idr)} / ton · TANUR/USDC ${
          hasMark ? `$${fmtAmount(tanurPrice as number, 4)}` : 'no offer yet'
        }`}
        change={history ? { pct: history.change_pct, note: '5-yr nickel' } : undefined}
      />

      {/* KPI row */}
      <div className="grid gap-4 sm:grid-cols-3">
        <ProductStat
          label={<>Est. APY <EstTag title="Derived from the on-chain GORR revenue rate" /></>}
          value={`${estApyPct.toFixed(2)}%`}
          sub="GORR revenue band"
          accent
        />
        <ProductStat
          label="Oracle reputation"
          value={<><CountUp to={state?.oracle_reputation ?? 0} />/100</>}
          sub={`${state?.epoch_count ?? 0} epochs recorded`}
        />
        <ProductStat
          label="Total minted"
          value={<CountUp to={state?.total_minted ?? 0} format={(v) => fmtAmount(v)} />}
          sub="TANUR outstanding"
        />
      </div>

      <div className="grid gap-6 lg:grid-cols-[1fr_360px]">
        <ChartCard
          id="explore"
          title="Nickel price history"
          points={history?.series}
          footer="FRED PNICKUSDM (IMF) — the same feed the oracle uses to value each epoch."
          height="h-72"
        />

        {/* buy panel */}
        <Card className="p-7">
          <div className="text-[11px] font-medium uppercase tracking-[0.12em] text-faint">
            Acquire · SDEX
          </div>
          <h3 className="mt-2 font-display text-2xl text-ink">Buy TANUR</h3>
          <p className="mt-2 text-[14px] text-muted">
            Path-payment USDC → TANUR via Stellar&apos;s orderbook. Requires a live TANUR/USDC
            offer and an authorized trustline.
          </p>

          <div className="mt-5">
            <label className="text-[12px] text-faint">You spend</label>
            <div className="mt-1 flex items-center rounded-lg border border-line-2 bg-white px-3 py-2.5">
              <input
                value={usdcSpend}
                onChange={(e) => setUsdcSpend(e.target.value)}
                inputMode="decimal"
                className="w-full bg-transparent text-[16px] tabular-nums outline-none"
              />
              <span className="text-[13px] text-faint">USDC</span>
            </div>
            {estTanurOut != null && (
              <div className="mt-2 text-[12px] text-muted">
                ≈ {fmtAmount(estTanurOut, 2)} TANUR at best bid
              </div>
            )}
          </div>

          <div className="mt-5">
            {pos?.kycAuthorized ? (
              <Button
                onClick={() => handleBuy(usdcSpend)}
                disabled={buy.phase === 'working'}
                className="w-full"
              >
                {buy.phase === 'working' ? buy.note : 'Buy TANUR'}
              </Button>
            ) : (
              <Button href="/app/tools/kyc" variant="secondary" className="w-full">
                Verify KYC to buy
              </Button>
            )}
          </div>
          <div className="mt-2">
            <PhaseNote phase={buy} />
          </div>
        </Card>
      </div>

      {/* provenance */}
      <div>
        <SectionTitle>Provenance</SectionTitle>
        <EpochPanel />
        <p className="mt-3 text-[12px] text-faint">
          Source: Antam (ANTM) Ni-content (2026 guidance), epoch tagged to the Morowali nickel
          hub — priced from the FRED/IMF nickel feed and HMA (ESDM). Single-producer feed in this
          MVP; extensible to more facilities.
        </p>
      </div>
    </div>
  );
}

function ProductStat({
  label,
  value,
  sub,
  accent,
}: {
  label: React.ReactNode;
  value: React.ReactNode;
  sub: string;
  accent?: boolean;
}) {
  return (
    <Card className="p-6">
      <div className="text-[11px] font-medium uppercase tracking-[0.12em] text-faint">{label}</div>
      <div
        className={`mt-2 font-display text-3xl tracking-tightish tabular-nums ${
          accent ? 'text-brand' : 'text-ink'
        }`}
      >
        {value}
      </div>
      <div className="mt-1.5 text-[13px] text-muted">{sub}</div>
    </Card>
  );
}
