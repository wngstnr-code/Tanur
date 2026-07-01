'use client';

import { useState } from 'react';
import { Section } from '@/components/ui/primitives';
import { Reveal } from '@/components/motion/Reveal';
import Button from '@/components/ui/Button';
import { useAccount } from '@/lib/useAccount';
import { useTanurBalance } from '@/lib/useTanurBalance';
import { signXdr } from '@/lib/wallet';
import { buildTrustlineXdr } from '@/lib/access';
import { submitSignedClassic } from '@/lib/stellar';
import { ACCESS_EMAIL } from '@/lib/config';
import { shortHash } from '@/lib/format';

type Phase =
  | { k: 'idle' }
  | { k: 'working'; note: string }
  | { k: 'error'; msg: string };

export default function AccessSection() {
  const { address, connected, ready, connect } = useAccount();
  const { pos, reload } = useTanurBalance(address);
  const [phase, setPhase] = useState<Phase>({ k: 'idle' });

  const hasTrustline = !!pos?.tanurTrustline;
  const authorized = !!pos?.kycAuthorized;

  async function addTrustline() {
    if (!address) return;
    try {
      setPhase({ k: 'working', note: 'Sign in your wallet…' });
      const xdr = await buildTrustlineXdr(address);
      const signed = await signXdr(xdr, address);
      setPhase({ k: 'working', note: 'Submitting…' });
      await submitSignedClassic(signed);
      setPhase({ k: 'idle' });
      reload();
    } catch (e) {
      const m = e instanceof Error ? e.message : String(e);
      setPhase({ k: 'error', msg: /reject|denied|cancel/i.test(m) ? 'Signature cancelled.' : m.slice(0, 80) });
    }
  }

  const steps = [
    {
      n: '01',
      title: 'Connect a Stellar wallet',
      done: connected,
      body: connected ? (
        <span className="font-mono text-[12px] text-muted">{shortHash(address, 5, 5)}</span>
      ) : (
        <button onClick={connect} className="text-[13px] font-medium text-brand hover:text-ink">
          Connect wallet →
        </button>
      ),
    },
    {
      n: '02',
      title: 'Open a TANUR trustline',
      done: hasTrustline,
      locked: !connected,
      body: !connected ? (
        <span className="text-[13px] text-faint">Connect first</span>
      ) : hasTrustline ? (
        <span className="text-[13px] text-muted">Trustline open</span>
      ) : (
        <button
          onClick={addTrustline}
          disabled={phase.k === 'working'}
          className="text-[13px] font-medium text-brand hover:text-ink disabled:opacity-50"
        >
          {phase.k === 'working' ? phase.note : 'Add trustline →'}
        </button>
      ),
    },
    {
      n: '03',
      title: 'KYC authorization',
      done: authorized,
      locked: !hasTrustline,
      body: authorized ? (
        <span className="text-[13px] font-medium text-brand">Authorized — you can hold &amp; claim ✓</span>
      ) : hasTrustline ? (
        <span className="text-[13px] text-muted">
          Awaiting issuer authorization (native AUTH_REQUIRED)
        </span>
      ) : (
        <span className="text-[13px] text-faint">Open a trustline first</span>
      ),
    },
  ];

  return (
    <Section id="access" className="py-24 sm:py-32">
      <Reveal>
        <div className="overflow-hidden rounded-3xl border border-line bg-card shadow-card-lg">
          <div className="grid gap-10 p-6 sm:p-12 lg:grid-cols-[1fr_1.1fr] lg:gap-16 lg:p-16">
            {/* left: pitch */}
            <div className="flex flex-col">
              <div className="inline-flex items-center gap-2 text-[12px] font-medium uppercase tracking-[0.14em] text-brand">
                <span className="h-px w-5 bg-brand/40" />
                For investors
              </div>
              <h2 className="mt-4 font-display text-4xl font-semibold tracking-tighter2 text-ink text-balance sm:text-5xl">
                Permissioned to hold, free to trade.
              </h2>
              <p className="mt-5 max-w-md font-serif text-lg leading-relaxed text-muted sm:text-xl">
                TANUR is a permissioned real-world asset. The issuer authorizes your
                trustline after KYC — native Stellar <span className="font-mono text-[15px]">AUTH_REQUIRED</span>,
                no custom registry. Once authorized, you hold TANUR, claim USDC yield,
                and trade it freely on the SDEX.
              </p>

              <div className="mt-8 flex items-center gap-3">
                <Button href="/app" variant="primary">Open the app</Button>
                <a
                  href={`mailto:${ACCESS_EMAIL}?subject=TANUR%20investor%20access`}
                  className="text-[13px] font-medium text-muted hover:text-ink"
                >
                  Talk to us
                </a>
              </div>
              <p className="mt-4 font-mono text-[12px] text-faint">
                Native KYC via authorized trustline · Stellar Testnet
              </p>
            </div>

            {/* right: live on-chain access status */}
            <div className="rounded-2xl border border-line bg-bg-2/50 p-6 sm:p-8">
              <div className="flex items-center justify-between">
                <span className="text-[11px] font-medium uppercase tracking-[0.12em] text-faint">
                  Your access status
                </span>
                <span
                  className={`rounded-full px-2.5 py-1 font-mono text-[11px] ${
                    authorized
                      ? 'bg-brand-tint text-brand'
                      : 'bg-white text-faint'
                  }`}
                >
                  {!ready ? '—' : authorized ? 'authorized' : connected ? 'pending' : 'not connected'}
                </span>
              </div>

              <ol className="mt-6 flex flex-col">
                {steps.map((s, i) => (
                  <li key={s.n} className="flex gap-4 pb-7 last:pb-0">
                    <div className="flex flex-col items-center">
                      <span
                        className={`grid h-9 w-9 flex-none place-items-center rounded-full border font-mono text-[13px] ${
                          s.done
                            ? 'border-brand bg-brand text-white'
                            : s.locked
                            ? 'border-line-2 text-faint'
                            : 'border-ink text-ink'
                        }`}
                      >
                        {s.done ? '✓' : s.n}
                      </span>
                      {i < steps.length - 1 && (
                        <span aria-hidden className="mt-2 w-px flex-1 bg-line-2" />
                      )}
                    </div>
                    <div className="pt-1">
                      <div className={`font-display text-base font-semibold ${s.locked ? 'text-faint' : 'text-ink'}`}>
                        {s.title}
                      </div>
                      <div className="mt-1">{s.body}</div>
                    </div>
                  </li>
                ))}
              </ol>

              {phase.k === 'error' && (
                <p className="mt-1 text-[12px] text-orange">{phase.msg}</p>
              )}
              {authorized && (
                <div className="mt-2 border-t border-line pt-5">
                  <Button href="/app" variant="primary" size="md" className="w-full sm:w-auto">
                    Open the app →
                  </Button>
                </div>
              )}
            </div>
          </div>
        </div>
      </Reveal>
    </Section>
  );
}
