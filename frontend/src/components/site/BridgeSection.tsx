'use client';

import { motion } from 'framer-motion';
import { Reveal } from '@/components/motion/Reveal';

export default function BridgeSection() {
  return (
    <section className="relative overflow-hidden bg-ink py-28 text-center sm:py-36">
      {/* furnace heat — an ember glow rising from the base (the "tanur"/smelter) */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-x-0 bottom-0 -z-0 h-[70%]"
        style={{
          background:
            'radial-gradient(120% 90% at 50% 118%, rgba(226,116,46,0.55) 0%, rgba(226,116,46,0.14) 34%, rgba(46,111,142,0.10) 55%, transparent 72%)',
        }}
      />
      {/* concentric heat rings radiating from the furnace mouth */}
      <svg
        className="pointer-events-none absolute left-1/2 top-0 -z-0 h-[120%] w-[140%] -translate-x-1/2"
        viewBox="0 0 1000 600"
        fill="none"
      >
        {[0, 1, 2, 3, 4].map((i) => (
          <motion.ellipse
            key={i}
            cx="500"
            cy="640"
            rx={220 + i * 120}
            ry={190 + i * 100}
            stroke={i < 2 ? 'rgba(226,116,46,0.30)' : 'rgba(255,255,255,0.12)'}
            strokeWidth="1"
            initial={{ opacity: 0 }}
            whileInView={{ opacity: 1 }}
            viewport={{ once: true }}
            transition={{ duration: 1, delay: i * 0.15 }}
          />
        ))}
      </svg>

      <div className="relative mx-auto w-full max-w-content px-5 sm:px-8">
        <Reveal>
          <div className="inline-flex items-center gap-2 text-[12px] font-medium uppercase tracking-[0.14em] text-orange">
            <span className="h-px w-5 bg-orange/50" />
            From ore to yield
          </div>
          <h2 className="mx-auto mt-5 max-w-3xl font-display text-4xl font-semibold leading-[1.05] tracking-tighter2 text-bg text-balance sm:text-6xl">
            Where raw ore becomes
            <br />
            on-chain value.
          </h2>
          <p className="mx-auto mt-6 max-w-xl font-serif text-lg leading-relaxed text-white/65 sm:text-xl">
            Indonesia&rsquo;s nickel backbone, made programmable — production,
            minting, and USDC yield, all on Stellar. <span className="italic text-white/80">Dari bijih jadi yield.</span>
          </p>
        </Reveal>
      </div>
    </section>
  );
}
