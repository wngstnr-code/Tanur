'use client';

import { useMemo, useState, type ReactNode } from 'react';
import { Card } from '@/components/ui/primitives';
import Button from '@/components/ui/Button';
import { AreaChart, type ChartPoint } from '@/components/ui/AreaChart';
import { useWalletAssets } from '@/lib/useWalletAssets';
import { CONTRACTS, ASSETS } from '@/lib/config';
import { LOOP_STEPS } from '@/lib/onchain';
import { txUrl, contractUrl } from '@/lib/stellar';
import { fmtAmount, fmtUsdFromCents, fmtIdr, bpsToPct, shortHash } from '@/lib/format';
import { CountUp } from '@/components/motion/CountUp';
import { useInvestor, type Phase } from './investor';

/* ── small atoms ─────────────────────────────────────────────────────── */

export function EstTag({ title }: { title?: string }) {
  return (
    <span
      title={title}
      className="ml-1.5 rounded bg-bg-2 px-1.5 py-0.5 align-middle text-[10px] font-medium uppercase tracking-wide text-faint"
    >
      est.
    </span>
  );
}

export function Field({ label, value }: { label: string; value: ReactNode }) {
  return (
    <div>
      <div className="text-[11px] uppercase tracking-[0.1em] text-faint">{label}</div>
      <div className="mt-1 font-display text-xl tabular-nums text-ink">{value}</div>
    </div>
  );
}

export function SectionTitle({ children, aside }: { children: ReactNode; aside?: ReactNode }) {
  return (
    <div className="mb-4 flex items-center justify-between">
      <h2 className="font-display text-lg tracking-tightish text-ink">{children}</h2>
      {aside}
    </div>
  );
}

export function Chip({
  children,
  tone = 'muted',
}: {
  children: ReactNode;
  tone?: 'muted' | 'brand';
}) {
  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[11px] font-medium ${
        tone === 'brand' ? 'bg-brand-tint text-brand' : 'bg-bg-2 text-muted'
      }`}
    >
      {children}
    </span>
  );
}

export function TokenBadge({ code }: { code: string }) {
  if (code === 'TANUR') {
    return (
      <span className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-bg-2">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src="/tanur_dark.svg" alt="TANUR" className="h-6 w-6" />
      </span>
    );
  }
  if (code === 'USDC') {
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img src="/usdc.svg" alt="USDC" className="h-9 w-9 shrink-0 rounded-full" />
    );
  }
  if (code === 'XLM') {
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img src="/xlm.svg" alt="XLM" className="h-9 w-9 shrink-0 rounded-full" />
    );
  }
  return (
    <span className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-ink font-display text-[13px] font-semibold text-white">
      {code.slice(0, 2)}
    </span>
  );
}

export function PhaseNote({ phase }: { phase: Phase }) {
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

/* ── Ondo-style balance hero ─────────────────────────────────────────── */

export function BalanceHero({
  label,
  value,
  sub,
  change,
  actions,
}: {
  label: string;
  value: ReactNode;
  sub?: ReactNode;
  change?: { pct: number; note?: string };
  actions?: ReactNode;
}) {
  return (
    <Card className="p-7 sm:p-8">
      <div className="flex flex-wrap items-end justify-between gap-6">
        <div>
          <div className="text-[12px] font-medium uppercase tracking-[0.14em] text-faint">
            {label}
          </div>
          <div className="mt-3 font-display text-5xl tracking-tighter2 tabular-nums text-ink sm:text-6xl">
            {value}
          </div>
          <div className="mt-2 flex items-center gap-3 text-[14px]">
            {change && (
              <span
                className={`inline-flex items-center gap-1 font-medium ${
                  change.pct >= 0 ? 'text-brand' : 'text-orange'
                }`}
              >
                {change.pct >= 0 ? '▲' : '▼'} {Math.abs(change.pct).toFixed(2)}%
                {change.note ? <span className="text-faint">· {change.note}</span> : null}
              </span>
            )}
            {sub && <span className="text-muted">{sub}</span>}
          </div>
        </div>
        {actions && <div className="flex items-center gap-3">{actions}</div>}
      </div>
    </Card>
  );
}

/* ── Ondo-style value chart with range toggle ────────────────────────── */

// FRED PNICKUSDM is a monthly series (~60 points), so ranges are in months of
// observations rather than trading days.
const RANGES = [
  { key: '1Y', months: 12 },
  { key: '3Y', months: 36 },
  { key: '5Y', months: 60 },
] as const;

export function ChartCard({
  id,
  title,
  points,
  footer,
  height = 'h-64',
}: {
  id: string;
  title: string;
  points?: ChartPoint[];
  footer?: string;
  height?: string;
}) {
  const [range, setRange] = useState<(typeof RANGES)[number]['key']>('3Y');
  const series = useMemo(() => {
    if (!points?.length) return undefined;
    const months = RANGES.find((r) => r.key === range)!.months;
    return points.slice(Math.max(0, points.length - months));
  }, [points, range]);

  return (
    <Card className="p-6">
      <div className="flex items-center justify-between">
        <h3 className="font-display text-lg text-ink">{title}</h3>
        <div className="flex items-center gap-1 rounded-lg bg-bg-2 p-1">
          {RANGES.map((r) => (
            <button
              key={r.key}
              onClick={() => setRange(r.key)}
              className={`rounded-md px-2.5 py-1 text-[12px] transition-colors ${
                range === r.key ? 'bg-card text-ink shadow-pill' : 'text-muted hover:text-ink'
              }`}
            >
              {r.key}
            </button>
          ))}
        </div>
      </div>
      <div className={`mt-4 ${height}`}>
        <AreaChart id={id} points={series} />
      </div>
      {footer && <div className="mt-3 text-[12px] text-faint">{footer}</div>}
    </Card>
  );
}

/* ── KYC / trustline banner ──────────────────────────────────────────── */

export function KycBanner() {
  const { pos } = useInvestor();
  return (
    <Card
      className={`flex flex-wrap items-center justify-between gap-3 p-5 ${
        pos?.kycAuthorized ? 'border-brand/30 bg-brand-tint' : ''
      }`}
    >
      <div className="flex items-center gap-3">
        <span
          className={`h-2.5 w-2.5 rounded-full ${pos?.kycAuthorized ? 'bg-brand' : 'bg-orange'}`}
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
        <Button href="/#access" variant="secondary">
          Request access
        </Button>
      )}
    </Card>
  );
}

/* ── Ondo-style holdings rows ────────────────────────────────────────── */

const ASSET_NAME: Record<string, string> = {
  TANUR: 'Nickel revenue token',
  USDC: 'Settlement asset',
  XLM: 'Stellar lumens',
};

export function HoldingsList({ showApy = true }: { showApy?: boolean }) {
  const { address, idr, tanurPrice, hasMark, estApyPct } = useInvestor();
  const assets = useWalletAssets(address);

  const rows = (assets ?? []).map((a) => {
    const valueUsd =
      a.kind === 'usdc'
        ? a.balance
        : a.kind === 'tanur'
        ? hasMark
          ? a.balance * (tanurPrice as number)
          : null
        : null; // no price feed for XLM / other trustlines
    return {
      code: a.code,
      name: ASSET_NAME[a.code] ?? (a.issuer ? `${shortHash(a.issuer, 4, 4)}` : 'Asset'),
      apy: a.kind === 'tanur' ? `${estApyPct.toFixed(2)}%` : null,
      balance: a.balance,
      valueUsd,
      unauthorized: !a.authorized,
    };
  });

  return (
    <Card className="divide-y divide-line overflow-hidden">
      {/* header row */}
      <div className="hidden grid-cols-[1.6fr_1fr_1fr_1fr] gap-4 px-6 py-3 text-[11px] uppercase tracking-[0.1em] text-faint sm:grid">
        <div>Asset</div>
        {showApy && <div className="text-right">Est. APY</div>}
        <div className="text-right">Balance</div>
        <div className="text-right">Value</div>
      </div>

      {assets == null ? (
        <div className="px-6 py-8 text-center text-[13px] text-muted">Loading holdings…</div>
      ) : rows.length === 0 ? (
        <div className="px-6 py-8 text-center text-[13px] text-muted">
          No assets in this wallet yet.
        </div>
      ) : (
        rows.map((r) => (
          <div
            key={r.code}
            className="grid grid-cols-2 items-center gap-4 px-6 py-4 sm:grid-cols-[1.6fr_1fr_1fr_1fr]"
          >
            <div className="flex items-center gap-3">
              <TokenBadge code={r.code} />
              <div>
                <div className="flex items-center gap-2 font-medium text-ink">
                  {r.code}
                  {r.unauthorized && (
                    <span className="rounded bg-orange/10 px-1.5 py-0.5 text-[10px] font-medium text-orange">
                      unauthorized
                    </span>
                  )}
                </div>
                <div className="text-[12px] text-muted">{r.name}</div>
              </div>
            </div>
            {showApy && (
              <div className="hidden text-right sm:block">
                {r.apy ? (
                  <span className="text-[13px] font-bold text-brand">{r.apy}</span>
                ) : (
                  <span className="text-faint">—</span>
                )}
              </div>
            )}
            <div className="text-right tabular-nums text-ink">
              {fmtAmount(r.balance, r.code === 'XLM' ? 4 : 2)}
              <div className="text-[11px] text-faint sm:hidden">{r.code}</div>
            </div>
            <div className="text-right tabular-nums text-ink">
              {r.valueUsd == null ? (
                <span className="text-faint">—</span>
              ) : (
                <>
                  ${fmtAmount(r.valueUsd, 2)}
                  <div className="text-[11px] text-faint">{fmtIdr(r.valueUsd, idr)}</div>
                </>
              )}
            </div>
          </div>
        ))
      )}
    </Card>
  );
}

/* ── latest verified epoch ───────────────────────────────────────────── */

export function EpochPanel() {
  const { state } = useInvestor();
  if (!state || state.latest_epoch <= 0) return null;
  return (
    <Card className="p-7">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="text-[11px] font-medium uppercase tracking-[0.12em] text-faint">
          Latest verified epoch — {state.latest_label}
        </div>
        <span className="text-[12px] font-bold text-brand">
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
  );
}

/* ── on-chain proof ──────────────────────────────────────────────────── */

export function OnChainProof() {
  return (
    <div>
      <div className="grid gap-3 sm:grid-cols-3">
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
    </div>
  );
}

/* ── page heading ────────────────────────────────────────────────────── */

export function PageHead({ title, sub }: { title: string; sub?: string }) {
  return (
    <div>
      <h1 className="font-display text-3xl tracking-tighter2 text-ink sm:text-4xl">{title}</h1>
      {sub && <p className="mt-2 max-w-2xl text-[15px] text-muted">{sub}</p>}
    </div>
  );
}

/* ── Ondo "Converter"-style tool layout (left intro · middle action · right history) ── */

export function ToolColumns({
  left,
  middle,
  right,
}: {
  left: ReactNode;
  middle: ReactNode;
  right: ReactNode;
}) {
  return (
    <div className="grid gap-10 lg:grid-cols-[0.9fr_1.15fr_0.8fr]">
      <div>{left}</div>
      <div>{middle}</div>
      <div>{right}</div>
    </div>
  );
}

export function ToolIntro({
  title,
  paragraphs,
  readMoreHref,
  divided = false,
}: {
  title: string;
  paragraphs: string[];
  readMoreHref?: string;
  divided?: boolean;
}) {
  return (
    <div>
      <h1 className="font-display text-4xl tracking-tighter2 text-ink">{title}</h1>
      <div
        className={`mt-5 text-[14px] leading-relaxed text-muted ${
          divided ? 'divide-y divide-line' : 'space-y-4'
        }`}
      >
        {paragraphs.map((p, i) => (
          <p key={i} className={divided ? 'py-4 first:pt-0 last:pb-0' : ''}>
            {p}
          </p>
        ))}
      </div>
      {readMoreHref && (
        <div className="mt-6">
          <Button href={readMoreHref} variant="secondary">
            Read more
          </Button>
        </div>
      )}
    </div>
  );
}

export function CopyButton({ text }: { text: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <button
      onClick={() => {
        navigator.clipboard?.writeText(text).then(() => {
          setCopied(true);
          setTimeout(() => setCopied(false), 1200);
        });
      }}
      className="text-faint transition-colors hover:text-ink"
      aria-label="Copy"
    >
      {copied ? (
        <svg width="15" height="15" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
          <path d="M3.5 8.5 6.5 11.5 12.5 5" />
        </svg>
      ) : (
        <svg width="15" height="15" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.4">
          <rect x="5.5" y="5.5" width="8" height="8" rx="1.5" />
          <path d="M10.5 5.5V4A1.5 1.5 0 0 0 9 2.5H3.5A1.5 1.5 0 0 0 2 4v5.5A1.5 1.5 0 0 0 3.5 11H5" />
        </svg>
      )}
    </button>
  );
}

export function ContractRow({ label, id }: { label: string; id: string }) {
  return (
    <div className="flex items-center justify-between gap-3 py-3">
      <span className="text-[13px] text-muted">{label}</span>
      <div className="flex items-center gap-3">
        <span className="font-mono text-[13px] text-ink">{shortHash(id, 6, 5)}</span>
        <CopyButton text={id} />
        <a
          href={contractUrl(id)}
          target="_blank"
          rel="noopener noreferrer"
          className="text-faint transition-colors hover:text-ink"
          aria-label="Open in explorer"
        >
          <svg width="15" height="15" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round">
            <path d="M6 3H3.5A1.5 1.5 0 0 0 2 4.5v8A1.5 1.5 0 0 0 3.5 14h8a1.5 1.5 0 0 0 1.5-1.5V10" />
            <path d="M9.5 2.5H13.5V6.5M13 3l-6 6" />
          </svg>
        </a>
      </div>
    </div>
  );
}

export function HistoryPanel({
  title,
  children,
}: {
  title: string;
  children: ReactNode;
}) {
  return (
    <div>
      <h3 className="font-display text-lg text-ink">{title}</h3>
      <div className="mt-4">{children}</div>
    </div>
  );
}

export function EmptyState({ title, text }: { title: string; text: string }) {
  return (
    <div className="flex flex-col items-center py-10 text-center">
      <div className="grid h-14 w-14 place-items-center rounded-2xl border border-line bg-bg-2/50 text-faint">
        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
          <rect x="3" y="7" width="18" height="12" rx="2" />
          <path d="M3 11h18M7 15h4" />
        </svg>
      </div>
      <div className="mt-4 text-[14px] font-medium text-ink">{title}</div>
      <div className="mt-1 max-w-[220px] text-[12px] text-muted">{text}</div>
    </div>
  );
}

export { CountUp };
