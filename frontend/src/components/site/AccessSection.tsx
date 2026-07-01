import { Section } from '@/components/ui/primitives';
import { Reveal } from '@/components/motion/Reveal';
import Button from '@/components/ui/Button';
import { ACCESS_EMAIL } from '@/lib/config';

export default function AccessSection() {
  return (
    <Section id="access" className="py-24 sm:py-32">
      <Reveal>
        <div className="mx-auto max-w-3xl overflow-hidden rounded-3xl border border-line bg-card px-6 py-14 text-center shadow-card-lg sm:px-12 sm:py-20">
          <div className="inline-flex items-center gap-2 text-[12px] font-medium uppercase tracking-[0.14em] text-brand">
            <span className="h-px w-5 bg-brand/40" />
            For investors
          </div>
          <h2 className="mx-auto mt-4 max-w-2xl font-display text-4xl font-semibold tracking-tighter2 text-ink text-balance sm:text-5xl">
            Permissioned to hold, free to trade.
          </h2>
          <p className="mx-auto mt-5 max-w-xl font-serif text-lg leading-relaxed text-muted sm:text-xl">
            TANUR is a permissioned real-world asset. The issuer authorizes your
            trustline after KYC — native Stellar{' '}
            <span className="font-mono text-[15px]">AUTH_REQUIRED</span>, no custom
            registry. Once authorized, you hold TANUR, claim USDC yield, and trade it
            freely on the SDEX.
          </p>

          <div className="mt-9 flex items-center justify-center gap-3">
            <Button href="/app" variant="primary" size="lg">
              Open the app →
            </Button>
            <a
              href={`mailto:${ACCESS_EMAIL}?subject=TANUR%20investor%20access`}
              className="text-[14px] font-medium text-muted hover:text-ink"
            >
              Talk to us
            </a>
          </div>
          <p className="mt-5 font-mono text-[12px] text-faint">
            Native KYC via authorized trustline · Stellar Testnet
          </p>
        </div>
      </Reveal>
    </Section>
  );
}
