'use client';

import { useState } from 'react';
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

export default function KycView() {
  const { pos, address, reload } = useInvestor();

  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [country, setCountry] = useState('');
  const [accountType, setAccountType] = useState<'Individual' | 'Institution'>('Individual');
  const [agree, setAgree] = useState(false);
  const [sent, setSent] = useState(false);

  const canSubmit = name.trim() && /.+@.+\..+/.test(email) && country.trim() && agree;

  function submit() {
    const body = [
      `Full name: ${name}`,
      `Email: ${email}`,
      `Country/Jurisdiction: ${country}`,
      `Account type: ${accountType}`,
      `Stellar account: ${address ?? '-'}`,
      '',
      'Please authorize my TANUR trustline (native AUTH_REQUIRED).',
    ].join('\n');
    window.location.href = `mailto:${ACCESS_EMAIL}?subject=${encodeURIComponent(
      'Tanur KYC registration'
    )}&body=${encodeURIComponent(body)}`;
    setSent(true);
  }

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
        <div className="space-y-4">
          <Input label="Full name" value={name} onChange={setName} placeholder="Jane Investor" />
          <Input label="Email" value={email} onChange={setEmail} placeholder="jane@fund.com" type="email" />
          <Input label="Country / Jurisdiction" value={country} onChange={setCountry} placeholder="Indonesia" />

          <div>
            <label className="text-[12px] text-faint">Account type</label>
            <div className="mt-1.5 grid grid-cols-2 gap-2">
              {(['Individual', 'Institution'] as const).map((t) => (
                <button
                  key={t}
                  onClick={() => setAccountType(t)}
                  className={`rounded-lg border px-3 py-2.5 text-[14px] transition-colors ${
                    accountType === t
                      ? 'border-brand bg-brand font-medium text-white'
                      : 'border-line-2 text-muted hover:border-ink/30'
                  }`}
                >
                  {t}
                </button>
              ))}
            </div>
          </div>

          <div>
            <label className="text-[12px] text-faint">Stellar account</label>
            <div className="mt-1.5 break-all rounded-lg bg-bg-2 px-3 py-2.5 font-mono text-[12px] text-ink">
              {address ?? '—'}
            </div>
          </div>

          <label className="flex items-start gap-2.5 text-[13px] text-muted">
            <input
              type="checkbox"
              checked={agree}
              onChange={(e) => setAgree(e.target.checked)}
              className="mt-0.5 accent-brand"
            />
            I confirm the information is accurate and consent to KYC verification.
          </label>

          {sent ? (
            <div className="rounded-lg border border-brand/30 bg-brand-tint px-4 py-3 text-[13px] text-brand">
              Application opened in your email client — send it to complete registration.
            </div>
          ) : (
            <Button onClick={submit} disabled={!canSubmit} size="lg" className="w-full">
              Submit application
            </Button>
          )}

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
        </div>
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

function Input({
  label,
  value,
  onChange,
  placeholder,
  type = 'text',
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  type?: string;
}) {
  return (
    <div>
      <label className="text-[12px] text-faint">{label}</label>
      <input
        type={type}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className="mt-1.5 w-full rounded-lg border border-line-2 bg-white px-3 py-2.5 text-[14px] text-ink outline-none transition-colors placeholder:text-faint focus:border-brand"
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
