'use client';

// Stellar Wallets Kit is a singleton (lib/wallet.ts) — no React provider tree is
// required, unlike the old iframe wallet. This stays as a thin passthrough so the
// layout's <Providers> boundary keeps working.
export default function Providers({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
