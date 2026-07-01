'use client';

import { useEffect, useState } from 'react';
import Button from '@/components/ui/Button';
import { ACCESS_EMAIL, ASSETS } from '@/lib/config';
import { useInvestor } from './investor';
import {
  ToolColumns,
  ToolIntro,
  ContractRow,
  HistoryPanel,
  PageHead,
} from './shared';
import { Card } from '@/components/ui/primitives';

// Per-wallet "application submitted, awaiting issuer verification" flag.
// Persisted in localStorage so the pending state survives reloads until the
// issuer authorizes the trustline on-chain (pos.kycAuthorized flips to true).
const submitKey = (addr?: string) => `tanur:kyc-submitted:${addr ?? 'anon'}`;

export default function KycView() {
  const { pos, address, reload } = useInvestor();

  const [sent, setSent] = useState(false);
  const [phase, setPhase] = useState<'idle' | 'sending' | 'error'>('idle');
  const [error, setError] = useState('');

  // Restore the "already submitted" flag for the connected wallet.
  useEffect(() => {
    if (typeof window === 'undefined') return;
    setSent(localStorage.getItem(submitKey(address)) === '1');
  }, [address]);

  // While waiting on the issuer, poll chain state so the view flips to
  // "Verified" on its own the moment the trustline is authorized (no refresh).
  const pending = sent && !pos?.kycAuthorized;
  useEffect(() => {
    if (!pending) return;
    const id = setInterval(reload, 10_000);
    return () => clearInterval(id);
  }, [pending, reload]);

  // Send the application straight to the issuer's inbox via FormSubmit.co
  // (no backend / API key). The wallet is bound to the connected account and
  // cannot be edited, so the issuer authorizes exactly this trustline.
  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (phase === 'sending' || !address) return;
    const form = e.currentTarget;
    const data = Object.fromEntries(new FormData(form).entries());
    if ((data._honey as string)?.length) return; // honeypot
    setPhase('sending');
    setError('');
    try {
      const res = await fetch(
        `https://formsubmit.co/ajax/${encodeURIComponent(ACCESS_EMAIL)}`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
          body: JSON.stringify({
            _subject: 'Tanur — KYC registration',
            _template: 'table',
            _captcha: 'false',
            name: data.name,
            email: data.email,
            stellar_account: address,
            allocation_usd: data.allocation || '—',
            organization: data.entity || '—',
            message: data.message || '—',
            request: 'Please authorize my TANUR trustline (native AUTH_REQUIRED).',
          }),
        }
      );
      const json = await res.json().catch(() => ({}));
      if (!res.ok || !(json.success === 'true' || json.success === true)) {
        throw new Error(json.message || 'Submission failed. Please try again.');
      }
      if (typeof window !== 'undefined') localStorage.setItem(submitKey(address), '1');
      setSent(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
      setPhase('error');
    }
  }

  // Authorized on-chain — done.
  if (pos?.kycAuthorized) {
    return (
      <div className="mx-auto max-w-xl space-y-6">
        <PageHead title="Verify KYC" sub="Your account is verified and ready." />
        <Card className="p-8 text-center">
          <span className="text-[13px] font-bold uppercase tracking-[0.14em] text-brand">
            Verified
          </span>
          <h3 className="mt-3 font-display text-2xl text-ink">You&apos;re all set</h3>
          <p className="mt-2 text-[14px] text-muted">
            Your TANUR trustline is authorized — you can buy TANUR and claim USDC yield.
          </p>
          <div className="mt-6 flex justify-center gap-3">
            <Button href="/app">Explore TANUR</Button>
            <Button href="/app/tools/claim" variant="secondary">
              Claim yield
            </Button>
          </div>
        </Card>
      </div>
    );
  }

  // Submitted but not yet authorized — waiting on the issuer to verify.
  if (sent) {
    return (
      <div className="mx-auto max-w-xl space-y-6">
        <PageHead title="Verify KYC" sub="Application received — awaiting issuer verification." />
        <Card className="p-8 text-center">
          <span className="text-[13px] font-bold uppercase tracking-[0.14em] text-faint">
            Pending review
          </span>
          <h3 className="mt-3 font-display text-2xl text-ink">Application under review</h3>
          <p className="mt-2 text-[14px] leading-relaxed text-muted">
            Your application for
            <span className="mx-1 break-all font-mono text-[12px] text-ink">{address ?? '—'}</span>
            has been sent. The issuer will authorize your TANUR trustline
            (native AUTH_REQUIRED) once your details are verified.
          </p>
          <div className="mt-6 w-full divide-y divide-line rounded-lg border border-line-2 text-left [&>div]:px-4">
            <StatusRow label="Application" ok />
            <StatusRow label="Authorized" ok={false} />
          </div>
          <p className="mt-4 text-[12px] text-faint">
            This updates automatically once the issuer authorizes your account.
          </p>
        </Card>
      </div>
    );
  }

  // Registration — left intro + SAWIT-styled form (middle) + status (right).
  return (
    <ToolColumns
      left={
        <ToolIntro
          title="Verify KYC"
          divided
          paragraphs={[
            'TANUR is a permissioned real-world asset. Only issuer-authorized accounts can hold it or claim yield — enforced natively by Stellar AUTH_REQUIRED, not a custom contract.',
            'Register below with your details. The issuer reviews your application and authorizes your account off-chain.',
          ]}
        />
      }
      middle={
        <form onSubmit={onSubmit} className="space-y-4">
          {/* honeypot */}
          <input type="text" name="_honey" tabIndex={-1} autoComplete="off" className="hidden" aria-hidden />

          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Full name" name="name" required placeholder="Jane Investor" />
            <Field label="Email" name="email" type="email" required placeholder="you@email.com" />
          </div>

          {/* Stellar wallet — auto-filled from the connected account, not editable */}
          <div>
            <label className="text-[12px] font-medium text-ink">Stellar wallet (public key)</label>
            <div className="mt-1.5 overflow-x-auto whitespace-nowrap rounded-xl border border-line bg-bg-2/60 px-3.5 py-2.5 font-mono text-[11px] leading-5 text-ink">
              {address ?? '— connect your wallet —'}
            </div>
            <p className="mt-1 text-[11px] text-faint">
              Auto-filled from your connected wallet. The issuer authorizes exactly this account.
            </p>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Intended allocation (USD)" name="allocation" placeholder="50,000  (optional)" />
            <Field label="Organization" name="entity" placeholder="Optional" />
          </div>

          <div>
            <label className="text-[12px] font-medium text-ink">Message</label>
            <textarea
              name="message"
              rows={3}
              placeholder="Anything we should know? (optional)"
              className="mt-1.5 w-full rounded-xl border border-line bg-bg-2/40 px-3.5 py-2.5 text-[14px] text-ink outline-none transition-colors placeholder:text-faint focus:border-brand/50 focus:bg-card"
            />
          </div>

          {phase === 'error' && (
            <div className="rounded-xl border border-amber-300 bg-amber-50 p-3 text-[13px] text-amber-700">
              {error}
            </div>
          )}

          <Button
            type="submit"
            disabled={phase === 'sending' || !address}
            size="lg"
            className="w-full"
          >
            {phase === 'sending' ? 'Sending…' : 'Submit application'}
          </Button>
          <p className="text-center text-[11px] text-faint">
            {address
              ? 'KYC-gated · the issuer authorizes your TANUR trustline'
              : 'Connect your wallet first — it fills your Stellar account automatically'}
          </p>

          {/* contracts */}
          <div className="pt-2">
            <div className="text-[12px] font-medium uppercase tracking-[0.12em] text-faint">
              Contracts
            </div>
            <div className="mt-1 divide-y divide-line">
              <ContractRow label="TANUR issuer" id={ASSETS.tanur.issuer} />
              <ContractRow label="TANUR (SAC)" id={ASSETS.tanur.sac} />
            </div>
          </div>
        </form>
      }
      right={
        <HistoryPanel title="Status">
          <div className="divide-y divide-line">
            <StatusRow label="Application" ok={sent} />
            <StatusRow label="Authorized" ok={!!pos?.kycAuthorized} />
          </div>
          <p className="mt-5 text-[12px] leading-relaxed text-faint">
            Once your application is reviewed, the issuer authorizes your account and
            &quot;Authorized&quot; turns green.
          </p>
        </HistoryPanel>
      }
    />
  );
}

function Field({
  label,
  name,
  type = 'text',
  required,
  placeholder,
}: {
  label: string;
  name: string;
  type?: string;
  required?: boolean;
  placeholder?: string;
}) {
  return (
    <div>
      <label className="text-[12px] font-medium text-ink">
        {label}
        {required && <span className="text-brand"> *</span>}
      </label>
      <input
        type={type}
        name={name}
        required={required}
        placeholder={placeholder}
        className="mt-1.5 w-full rounded-xl border border-line bg-bg-2/40 px-3.5 py-2.5 text-[14px] text-ink outline-none transition-colors placeholder:text-faint focus:border-brand/50 focus:bg-card"
      />
    </div>
  );
}

function StatusRow({ label, ok }: { label: string; ok: boolean }) {
  return (
    <div className="flex items-center justify-between py-3">
      <span className="text-[13px] text-ink">{label}</span>
      <span className={`text-[12px] font-semibold ${ok ? 'text-brand' : 'text-faint'}`}>
        {ok ? 'Done' : 'Pending'}
      </span>
    </div>
  );
}
