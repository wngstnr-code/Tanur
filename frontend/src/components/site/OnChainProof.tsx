'use client';

import { useState } from 'react';
import { motion } from 'framer-motion';
import { Reveal } from '@/components/motion/Reveal';
import { LOOP_STEPS, txUrl } from '@/lib/onchain';

// Short, stable result per step (the mint amount varies by epoch, so keep it qualitative).
const RESULT: Record<string, string> = {
  record_epoch: 'Verified epoch → TANUR minted',
  fund_epoch: '100 USDC funded · 30-day window',
  claim: '60 USDC claimed · Merkle proof',
};

export default function OnChainProof() {
  const [active, setActive] = useState(0);

  return (
    <section
      id="proof"
      className="relative isolate flex min-h-screen flex-col justify-center overflow-hidden bg-bg-2/50 py-24 sm:py-32"
    >
      <div className="mx-auto w-full max-w-content px-5 sm:px-8">
        <Reveal className="max-w-2xl">
          <div className="inline-flex items-center gap-2 text-[12px] font-medium uppercase tracking-[0.14em] text-brand">
            <span className="h-px w-5 bg-brand/40" />
            Proof, on-chain
          </div>
          <h2 className="mt-4 font-display text-4xl font-semibold tracking-tighter2 text-ink text-balance sm:text-5xl">
            The full economic loop, already executed.
          </h2>
          <p className="mt-5 font-serif text-lg leading-relaxed text-muted sm:text-xl">
            Not a mockup — real transactions on Stellar Testnet. Tap a step to inspect it,
            then verify the hash on the explorer.
          </p>
        </Reveal>

        {/* carousel of proof cards (light) */}
        <div className="mt-14 flex flex-col gap-3 sm:flex-row sm:gap-4">
          {LOOP_STEPS.map((s, i) => {
            const isActive = i === active;
            const n = String(s.n).padStart(2, '0');
            return (
              <motion.button
                key={s.n}
                layout
                onClick={() => setActive(i)}
                transition={{ duration: 0.5, ease: [0.22, 1, 0.36, 1] }}
                className={`group relative flex min-h-[320px] flex-col rounded-2xl border p-7 text-left ${
                  isActive
                    ? 'border-line bg-card shadow-card sm:flex-[2.4]'
                    : 'border-line bg-bg-2 hover:bg-bg-2/70 sm:flex-1'
                }`}
              >
                {!isActive && (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src="/tanur_dark.svg"
                    alt=""
                    aria-hidden
                    className="pointer-events-none absolute left-1/2 top-1/2 h-24 w-24 -translate-x-1/2 -translate-y-1/2 opacity-[0.05]"
                  />
                )}
                <motion.span
                  layout
                  className={`grid h-9 w-9 place-items-center rounded-full border font-mono text-[13px] ${
                    isActive
                      ? 'border-line text-ink'
                      : 'border-line-2 text-faint'
                  }`}
                >
                  {n}
                </motion.span>

                <div className="mt-auto">
                  <motion.h3
                    layout="position"
                    className={`font-display text-xl font-semibold ${
                      isActive ? 'text-ink' : 'text-muted'
                    }`}
                  >
                    {s.title}
                  </motion.h3>

                  {isActive && (
                    <motion.div
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      transition={{ delay: 0.15 }}
                    >
                      <div className="mt-1 font-mono text-[13px] text-brand">
                        {RESULT[s.method] ?? ''}
                      </div>
                      <p className="mt-3 text-[14px] leading-relaxed text-muted">
                        {s.desc}
                      </p>
                      <div className="mt-5 flex flex-wrap items-center justify-between gap-2 border-t border-line pt-4">
                        <span className="rounded-md border border-line bg-bg-2/60 px-2 py-1 font-mono text-[11px] text-brand">
                          {s.method}
                        </span>
                        {s.tx ? (
                          <a
                            href={txUrl(s.tx)}
                            target="_blank"
                            rel="noopener noreferrer"
                            onClick={(e) => e.stopPropagation()}
                            className="inline-flex items-center gap-1.5 font-mono text-[12px] text-ink/70 transition-colors hover:text-orange"
                          >
                            {s.tx.slice(0, 12)}…{s.tx.slice(-6)} ↗
                          </a>
                        ) : (
                          <span className="font-mono text-[12px] text-faint">pending</span>
                        )}
                      </div>
                    </motion.div>
                  )}
                </div>
              </motion.button>
            );
          })}
        </div>
      </div>
    </section>
  );
}
