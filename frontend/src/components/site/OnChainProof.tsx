import { Section, Eyebrow } from '@/components/ui/primitives';
import { Reveal, Stagger, StaggerItem } from '@/components/motion/Reveal';
import { LOOP_STEPS, txUrl, contractUrl } from '@/lib/onchain';
import { CONTRACTS, ASSETS } from '@/lib/config';

// Short, stable result per step (the mint amount varies by epoch, so keep it qualitative).
const RESULT: Record<string, string> = {
  record_epoch: 'Verified epoch → TANUR minted',
  fund_epoch: '100 USDC funded',
  claim: '60 USDC claimed · Merkle proof',
};

const CONTRACT_LINKS: [string, string][] = [
  ['TanurVault', CONTRACTS.vault],
  ['TanurYield', CONTRACTS.yield],
  ['TANUR · SAC', ASSETS.tanur.sac],
];

export default function OnChainProof() {
  return (
    <Section id="proof" className="flex min-h-screen flex-col justify-center py-24 sm:py-32">
      <Reveal className="max-w-2xl">
        <Eyebrow>Proof, on-chain</Eyebrow>
        <h2 className="mt-4 font-display text-4xl font-semibold tracking-tighter2 text-ink text-balance sm:text-5xl">
          The full economic loop, already executed.
        </h2>
        <p className="mt-5 font-serif text-lg leading-relaxed text-muted sm:text-xl">
          Not a mockup — real transactions on Stellar Testnet. Ore is recorded, TANUR
          is minted atomically, USDC revenue is funded, and a KYC-gated holder claims by
          Merkle proof. Verify every step on the explorer.
        </p>
      </Reveal>

      {/* connected loop flow */}
      <Stagger className="mt-14 flex flex-col items-stretch gap-3 lg:flex-row lg:items-stretch lg:gap-0">
        {LOOP_STEPS.map((s, i) => (
          <StaggerItem
            key={s.n}
            className="flex flex-1 flex-col lg:flex-row lg:items-stretch"
          >
            <div className="relative flex flex-1 flex-col rounded-2xl border border-line bg-card p-7 shadow-card transition-shadow hover:shadow-card-lg">
              {/* step badge + method */}
              <div className="flex items-center justify-between">
                <span className="grid h-9 w-9 place-items-center rounded-full border border-orange/40 bg-orange/[0.06] font-mono text-[13px] font-semibold text-orange">
                  {s.n}
                </span>
                <span className="rounded-md border border-line bg-bg-2/60 px-2 py-1 font-mono text-[11px] text-brand">
                  {s.method}
                </span>
              </div>

              <h3 className="mt-5 font-display text-lg font-semibold text-ink">
                {s.title}
              </h3>
              <div className="mt-1 font-mono text-[13px] text-muted">
                {RESULT[s.method] ?? ''}
              </div>
              <p className="mt-3 flex-1 text-[13px] leading-relaxed text-muted">
                {s.desc}
              </p>

              {/* tx hash → explorer */}
              {s.tx ? (
                <a
                  href={txUrl(s.tx)}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="mt-5 inline-flex items-center gap-1.5 border-t border-line pt-4 font-mono text-[12px] text-ink/70 transition-colors hover:text-orange"
                >
                  <span className="h-1.5 w-1.5 flex-none rounded-full bg-brand" />
                  {s.tx.slice(0, 12)}…{s.tx.slice(-6)} ↗
                </a>
              ) : (
                <span className="mt-5 inline-flex items-center gap-1.5 border-t border-line pt-4 font-mono text-[12px] text-faint">
                  pending
                </span>
              )}
            </div>

            {/* connector arrow (between cards) */}
            {i < LOOP_STEPS.length - 1 && (
              <div
                aria-hidden
                className="flex items-center justify-center py-1 text-faint lg:px-1"
              >
                <span className="lg:hidden">↓</span>
                <span className="hidden lg:inline">→</span>
              </div>
            )}
          </StaggerItem>
        ))}
      </Stagger>

      {/* verified contracts strip */}
      <Reveal delay={0.1}>
        <div className="mt-6 flex flex-col gap-4 rounded-2xl border border-line bg-bg-2/50 px-7 py-5 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-2.5">
            <span className="h-2 w-2 rounded-full bg-brand" />
            <span className="text-[13px] text-muted">
              Upgradeable &amp; source-verified — reproducible CI build, matched on
              StellarExpert.
            </span>
          </div>
          <div className="flex flex-wrap items-center gap-x-5 gap-y-2">
            {CONTRACT_LINKS.map(([name, id]) => (
              <a
                key={name}
                href={contractUrl(id)}
                target="_blank"
                rel="noopener noreferrer"
                className="font-mono text-[12px] text-ink/70 transition-colors hover:text-brand"
              >
                {name} ↗
              </a>
            ))}
          </div>
        </div>
      </Reveal>
    </Section>
  );
}
