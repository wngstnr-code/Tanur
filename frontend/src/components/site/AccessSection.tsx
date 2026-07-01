import Image from 'next/image';
import { Section } from '@/components/ui/primitives';
import { Reveal } from '@/components/motion/Reveal';
import Button from '@/components/ui/Button';

export default function AccessSection() {
  return (
    <Section id="access" className="py-24 sm:py-32">
      <Reveal>
        <div className="relative mx-auto max-w-5xl overflow-hidden rounded-3xl border border-white/10 px-6 py-14 text-center shadow-card-lg sm:px-12 sm:py-20">
          {/* darkened city backdrop — lighter than the How-it-works section */}
          <div className="absolute inset-0 -z-10">
            <Image
              src="/hero/city.jpg"
              alt=""
              fill
              sizes="100vw"
              className="object-cover [filter:saturate(0.6)]"
            />
            <div className="absolute inset-0 bg-ink/60" />
            <div className="absolute inset-0 bg-gradient-to-t from-ink/70 via-ink/40 to-ink/45" />
          </div>

          <div className="inline-flex items-center gap-2 text-[12px] font-medium uppercase tracking-[0.14em] text-brand-bright">
            <span className="h-px w-5 bg-brand-bright/50" />
            For investors
          </div>
          <h2 className="mt-4 font-display text-4xl font-semibold tracking-tighter2 text-bg text-balance sm:text-5xl lg:whitespace-nowrap">
            Permissioned to hold, free to trade.
          </h2>
          <p className="mx-auto mt-5 max-w-xl font-serif text-lg leading-relaxed text-white/75 sm:text-xl">
            TANUR is a permissioned real-world asset. The issuer authorizes your
            trustline after KYC — native Stellar{' '}
            <span className="font-mono text-[15px] text-white">AUTH_REQUIRED</span>, no
            custom registry. Once authorized, you hold TANUR, claim USDC yield, and
            trade it freely on the SDEX.
          </p>

          <div className="mt-9 flex items-center justify-center">
            <Button href="/app" variant="dark" size="lg">
              Open the app →
            </Button>
          </div>
          <p className="mt-5 font-mono text-[12px] text-white/45">
            Native KYC via authorized trustline · Stellar Testnet
          </p>
        </div>
      </Reveal>
    </Section>
  );
}
