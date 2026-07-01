'use client';

import { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import { geoMercator, geoPath } from 'd3-geo';
import { feature } from 'topojson-client';
import { Section } from '@/components/ui/primitives';
import { Reveal } from '@/components/motion/Reveal';

const W = 760;
const H = 440;

// Indonesia's nickel belt — real smelter/mining hubs (Sulawesi + North Maluku),
// a geography distinct from the palm belt: concentrated in the east.
const hubs = [
  { label: 'Morowali · IMIP', lon: 121.9, lat: -2.0 },
  { label: 'Bahodopi', lon: 122.1, lat: -2.8 },
  { label: 'Sorowako · Vale', lon: 121.35, lat: -2.53 },
  { label: 'Pomalaa · Antam', lon: 121.6, lat: -4.18 },
  { label: 'Konawe', lon: 122.0, lat: -3.9 },
  { label: 'Weda Bay · IWIP', lon: 127.9, lat: 0.5 },
  { label: 'Obi Island', lon: 127.5, lat: -1.5 },
];

type Pt = { x: number; y: number; label: string };

export default function BeliefSection() {
  const [path, setPath] = useState('');
  const [pts, setPts] = useState<Pt[]>([]);

  useEffect(() => {
    fetch('https://cdn.jsdelivr.net/npm/world-atlas@2/countries-110m.json')
      .then((r) => r.json())
      .then((world: any) => {
        const fc: any = feature(world, world.objects.countries);
        const idn = fc.features.find((f: any) => String(f.id) === '360');
        if (!idn) return;
        const pad = 8;
        const proj = geoMercator().fitExtent(
          [
            [pad, pad],
            [W - pad, H - pad],
          ],
          idn
        );
        const d = geoPath(proj)(idn) || '';
        setPath(d);
        setPts(
          hubs
            .map((e) => {
              const p = proj([e.lon, e.lat]);
              return p ? { x: p[0], y: p[1], label: e.label } : null;
            })
            .filter(Boolean) as Pt[]
        );
      })
      .catch(() => {});
  }, []);

  return (
    <Section className="py-24 sm:py-32">
      <div className="grid items-center gap-14 lg:grid-cols-2">
        <Reveal>
          <div className="inline-flex items-center gap-2 text-[12px] font-medium uppercase tracking-[0.14em] text-brand">
            <span className="h-px w-5 bg-brand/40" />
            What we believe
          </div>
          <h2 className="mt-4 font-display text-4xl font-semibold tracking-tighter2 text-ink text-balance sm:text-5xl">
            We believe in{' '}
            <span className="text-brand">verifiable yield</span>.
          </h2>
          <p className="mt-5 max-w-md font-serif text-lg leading-relaxed text-muted sm:text-xl">
            Every token traces back to real ore, a real smelter, and a real
            payout — across Indonesia&rsquo;s nickel belt, from Sulawesi to
            Halmahera. No synthetics, no black boxes. Just production you can
            audit on-chain.
          </p>
        </Reveal>

        <Reveal delay={0.1}>
          <div className="relative w-full overflow-hidden rounded-2xl border border-line bg-bg-2/50 p-4">
            <svg viewBox={`0 0 ${W} ${H}`} className="w-full">
              {path && (
                <path
                  d={path}
                  fill="#E6F0F5"
                  stroke="#2E6F8E"
                  strokeWidth={0.8}
                  strokeOpacity={0.5}
                />
              )}
              {pts.map((p, i) => (
                <g key={p.label}>
                  <motion.circle
                    cx={p.x}
                    cy={p.y}
                    r={12}
                    fill="rgba(226,116,46,0.28)"
                    animate={{ r: [7, 20, 7], opacity: [0.6, 0, 0.6] }}
                    transition={{
                      duration: 2.6,
                      repeat: Infinity,
                      delay: i * 0.22,
                      ease: 'easeInOut',
                    }}
                  />
                  <circle cx={p.x} cy={p.y} r={4} fill="#E2742E" />
                  <circle cx={p.x} cy={p.y} r={1.6} fill="#fff" opacity={0.9} />
                </g>
              ))}
            </svg>
            {!path && (
              <div className="flex h-[300px] items-center justify-center text-sm text-faint">
                Loading map…
              </div>
            )}
            {/* legend — clean, avoids overlapping labels on the clustered belt */}
            <div className="mt-2 grid grid-cols-2 gap-x-4 gap-y-1.5 border-t border-line px-2 pt-3 sm:grid-cols-3">
              {hubs.map((h) => (
                <div key={h.label} className="flex items-center gap-2">
                  <span className="h-1.5 w-1.5 flex-none rounded-full bg-orange" />
                  <span className="truncate font-mono text-[11px] text-muted">{h.label}</span>
                </div>
              ))}
            </div>
          </div>
        </Reveal>
      </div>
    </Section>
  );
}
