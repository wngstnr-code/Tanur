'use client';

import { Card } from '@/components/ui/primitives';
import { CountUp } from '@/components/motion/CountUp';
import { useNickelHistory } from '@/lib/useNickelHistory';
import { useAccountActivity, type ActivityKind } from '@/lib/useAccountActivity';
import { fmtAmount, fmtIdr, shortHash } from '@/lib/format';
import { txUrl } from '@/lib/stellar';
import { NETWORK } from '@/lib/config';
import { useInvestor } from './investor';
import { PageHead, HoldingsList, BalanceHero, ChartCard, SectionTitle } from './shared';

function ActivityIcon({ kind }: { kind: ActivityKind }) {
  const glyph =
    kind === 'claim' ? (
      // badge-check
      <>
        <path d="M12 3.5 14 5l2.4-.2.6 2.3 2 1.4-1 2.1 1 2.1-2 1.4-.6 2.3L14 19l-2 1.5L10 19l-2.4.2L7 16.9l-2-1.4 1-2.1-1-2.1 2-1.4.6-2.3L10 5z" />
        <path d="m9 12 2 2 4-4" />
      </>
    ) : kind === 'buy' ? (
      // arrow-down-to-line (acquire)
      <>
        <path d="M12 4v11m0 0 4-4m-4 4-4-4" />
        <path d="M5 20h14" />
      </>
    ) : kind === 'trustline' ? (
      // link
      <>
        <path d="M9.5 14.5 14.5 9.5" />
        <path d="M8 11 6.5 12.5a3.5 3.5 0 0 0 5 5L13 16" />
        <path d="M16 13l1.5-1.5a3.5 3.5 0 0 0-5-5L11 8" />
      </>
    ) : (
      // arrow-left-right (payment/swap)
      <>
        <path d="M7 8h11m0 0-3-3m3 3-3 3" />
        <path d="M17 16H6m0 0 3-3m-3 3 3 3" />
      </>
    );
  return (
    <span className="shrink-0 text-brand">
      <svg
        width="20"
        height="20"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.7"
        strokeLinecap="round"
        strokeLinejoin="round"
        aria-hidden
      >
        {glyph}
      </svg>
    </span>
  );
}

function relTime(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  const s = (Date.now() - d.getTime()) / 1000;
  if (s < 60) return 'just now';
  if (s < 3600) return `${Math.floor(s / 60)}m ago`;
  if (s < 86400) return `${Math.floor(s / 3600)}h ago`;
  if (s < 86400 * 30) return `${Math.floor(s / 86400)}d ago`;
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

export default function PortfolioView() {
  const { pos, address, supply, myShare, portfolioUsd, hasMark, idr } = useInvestor();
  const history = useNickelHistory();
  const activity = useAccountActivity(address);

  return (
    <div className="space-y-6">
      <PageHead
        title="Portfolio"
        sub="Your TANUR and USDC holdings, share of the outstanding revenue token, and on-chain activity."
      />

      <BalanceHero
        label="Portfolio value"
        value={hasMark ? <CountUp to={portfolioUsd} format={(v) => `$${fmtAmount(v, 2)}`} /> : '—'}
        sub={
          hasMark
            ? `${fmtIdr(portfolioUsd, idr)} · ${(myShare * 100).toFixed(2)}% of ${fmtAmount(supply)} supply`
            : `${(myShare * 100).toFixed(2)}% of ${fmtAmount(supply)} supply`
        }
        change={history ? { pct: history.change_pct, note: '5-yr nickel' } : undefined}
      />

      <ChartCard
        id="portfolio"
        title="Value over time"
        points={history?.series}
        footer="Portfolio value tracks the nickel price feed (FRED PNICKUSDM) that backs TANUR."
      />

      <div>
        <SectionTitle
          aside={
            <span className="text-[12px] text-muted">
              TANUR {fmtAmount(pos?.tanur ?? 0)} · USDC {fmtAmount(pos?.usdc ?? 0, 2)}
            </span>
          }
        >
          Holdings
        </SectionTitle>
        <HoldingsList />
      </div>

      {/* activity */}
      <div>
        <SectionTitle
          aside={
            address && (
              <a
                href={`${NETWORK.explorer}/account/${address}`}
                target="_blank"
                rel="noopener noreferrer"
                className="text-[12px] text-brand hover:underline"
              >
                Full history ↗
              </a>
            )
          }
        >
          On-chain activity
        </SectionTitle>
        <Card className="divide-y divide-line overflow-hidden">
          {activity == null ? (
            <div className="px-6 py-8 text-center text-[13px] text-muted">Loading activity…</div>
          ) : activity.length === 0 ? (
            <div className="px-6 py-8 text-center text-[13px] text-muted">
              No on-chain activity yet for this wallet.
            </div>
          ) : (
            activity.map((a) => (
              <div key={a.id} className="flex items-center justify-between gap-4 px-6 py-4">
                <div className="flex items-center gap-3">
                  <ActivityIcon kind={a.kind} />
                  <div>
                    <div className="text-[14px] font-medium text-ink">{a.label}</div>
                    <div className="text-[12px] text-muted">
                      {a.detail ? `${a.detail} · ` : ''}
                      {relTime(a.when)}
                    </div>
                  </div>
                </div>
                <a
                  href={txUrl(a.tx)}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="shrink-0 font-mono text-[12px] text-brand hover:underline"
                >
                  {shortHash(a.tx, 6, 4)} ↗
                </a>
              </div>
            ))
          )}
        </Card>
      </div>
    </div>
  );
}
