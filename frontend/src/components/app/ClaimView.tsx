'use client';

import Button from '@/components/ui/Button';
import { fmtAmount, shortHash } from '@/lib/format';
import { txUrl } from '@/lib/stellar';
import { CONTRACTS, ASSETS } from '@/lib/config';
import { useInvestor } from './investor';
import {
  ToolColumns,
  ToolIntro,
  ContractRow,
  HistoryPanel,
  EmptyState,
  PhaseNote,
} from './shared';

type Status = 'loading' | 'not-kyc' | 'nothing' | 'claimable' | 'claimed';

export default function ClaimView() {
  const { state, pos, entitlement, alreadyClaimed, claim, handleClaim } = useInvestor();

  const claimedNow = claim.phase === 'done';
  const status: Status = !pos
    ? 'loading'
    : !pos.kycAuthorized
    ? 'not-kyc'
    : claimedNow || alreadyClaimed === true
    ? 'claimed'
    : entitlement == null
    ? 'loading'
    : entitlement > 0
    ? 'claimable'
    : 'nothing';

  const amount = status === 'claimable' || status === 'claimed' ? entitlement ?? 0 : 0;
  const epoch = state && state.latest_epoch > 0 ? state.latest_epoch : '—';

  return (
    <ToolColumns
      left={
        <ToolIntro
          title="Claim Yield"
          divided
          paragraphs={[
            'TANUR is yield-bearing. Each funded epoch distributes USDC to holders pro-rata, fixed by a Merkle snapshot committed on-chain.',
            'Your entitlement is verified against the epoch root and your KYC status when you claim — no custodian, settled straight to your wallet in USDC.',
            'You can claim once per epoch. New yield opens with the next distribution.',
          ]}
        />
      }
      middle={
        <div className="space-y-4">
          {/* epoch */}
          <div className="rounded-2xl bg-bg-2 px-5 py-4">
            <div className="text-[12px] text-faint">Epoch</div>
            <div className="mt-0.5 font-display text-lg text-ink">#{epoch}</div>
          </div>

          {/* claimable amount */}
          <div className="rounded-2xl bg-bg-2 p-5">
            <div className="flex items-center justify-between gap-4">
              <div className="font-display text-4xl tabular-nums text-ink">
                {fmtAmount(amount, 2)}
              </div>
              <div className="flex items-center gap-2">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src="/usdc.svg" alt="" className="h-6 w-6 rounded-full" />
                <span className="text-[15px] font-medium text-ink">USDC</span>
              </div>
            </div>
            <div className="mt-1 text-right text-[12px] text-muted">
              Wallet balance: {fmtAmount(pos?.usdc ?? 0, 2)}
            </div>
          </div>

          {/* CTA */}
          <CTA status={status} claiming={claim.phase === 'working'} note={claim.phase === 'working' ? claim.note : ''} onClaim={handleClaim} />
          <div className="text-center">
            <PhaseNote phase={claim} />
          </div>

          {/* contracts */}
          <div className="pt-2">
            <div className="text-[12px] font-medium uppercase tracking-[0.12em] text-faint">
              Contracts
            </div>
            <div className="mt-1 divide-y divide-line">
              <ContractRow label="TanurYield" id={CONTRACTS.yield} />
              <ContractRow label="TANUR (SAC)" id={ASSETS.tanur.sac} />
            </div>
          </div>
        </div>
      }
      right={
        <HistoryPanel title="History">
          {status === 'claimed' ? (
            <div className="rounded-xl border border-line bg-card p-4">
              <div className="flex items-center justify-between">
                <span className="text-[13px] font-bold text-brand">Claimed</span>
                <span className="text-[11px] text-faint">epoch #{epoch}</span>
              </div>
              <div className="mt-1 text-[13px] text-muted">${fmtAmount(amount, 2)} USDC</div>
              {claim.phase === 'done' && (
                <a
                  href={txUrl(claim.hash)}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="mt-2 inline-block font-mono text-[12px] text-brand hover:underline"
                >
                  {shortHash(claim.hash, 6, 4)} ↗
                </a>
              )}
            </div>
          ) : (
            <EmptyState
              title="No claims yet"
              text="Once you claim yield, your distribution history will appear here."
            />
          )}
        </HistoryPanel>
      }
    />
  );
}

function CTA({
  status,
  claiming,
  note,
  onClaim,
}: {
  status: Status;
  claiming: boolean;
  note: string;
  onClaim: () => void;
}) {
  if (status === 'not-kyc') {
    return (
      <Button href="/app/tools/kyc" size="lg" className="w-full">
        Verify KYC to claim
      </Button>
    );
  }
  const label =
    status === 'loading'
      ? 'Checking…'
      : status === 'nothing'
      ? 'Nothing to claim'
      : status === 'claimed'
      ? 'Claimed'
      : claiming
      ? note || 'Claiming…'
      : 'Claim USDC';
  const disabled = status !== 'claimable' || claiming;
  return (
    <Button onClick={onClaim} disabled={disabled} size="lg" className="w-full">
      {label}
    </Button>
  );
}
