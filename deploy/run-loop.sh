#!/usr/bin/env bash
# Tanur — execute the full economic loop on Stellar Testnet and print tx hashes.
#   (oracle already did record+mint) → distribute TANUR → fund USDC → claim USDC
# Idempotent-ish; safe to re-run with a fresh epoch via EPOCH=N.
set -uo pipefail
export PATH="/opt/homebrew/bin:$PATH"
NET=testnet
DIR="$(cd "$(dirname "$0")" && pwd)"
A="$DIR/addresses.json"

j() { python3 -c "import json,sys; print(json.load(open('$A'))$1)"; }
ADMIN=$(j "['accounts']['admin']")
KYC=$(j "['accounts']['kyc_user']")
VAULT=$(j "['contracts']['vault']")
YIELD=$(j "['contracts']['yield']")
TANUR_SAC=$(j "['assets']['tanur']['sac']")
USDC_ASSET="USDC:$(j "['assets']['usdc']['issuer']")"
EXPLORER=$(j "['explorer']")

# Epoch to settle = latest recorded on-chain (the oracle posted it).
EPOCH=${EPOCH:-$(stellar contract invoke --id "$VAULT" --source tanur-admin --network "$NET" -- get_latest_epoch 2>/dev/null)}
echo "Settling epoch $EPOCH"

# Pull the signed tx hash from the CLI's stderr.
last_hash() { grep -oE 'Signing transaction: [0-9a-f]{64}' | tail -1 | awk '{print $3}'; }

echo "▶ 0. Ensure admin has USDC (acquire via SDEX if low)"
USDC_BAL=$(curl -s "https://horizon-testnet.stellar.org/accounts/$ADMIN" \
  | python3 -c "import sys,json; b=[x for x in json.load(sys.stdin)['balances'] if x.get('asset_code')=='USDC']; print(b[0]['balance'] if b else '0')")
echo "   admin USDC: $USDC_BAL"
if python3 -c "import sys; sys.exit(0 if float('$USDC_BAL')<100 else 1)"; then
  echo "   acquiring USDC via path payment (spend 200 XLM → USDC)..."
  stellar tx new path-payment-strict-send --source tanur-admin --network "$NET" \
    --send-asset native --send-amount 2000000000 --dest-asset "$USDC_ASSET" \
    --dest-min 1 --destination "$ADMIN" --fee 1000 >/dev/null 2>&1 || \
    echo "   ⚠ SDEX acquire failed — fund $ADMIN via faucet.circle.com (USDC, testnet)"
fi

echo "▶ 1. Distribute 30,000 TANUR to the KYC investor (so they have a position)"
# TANUR is a 7-decimal asset: 30,000 TANUR = 30_000 * 10^7 stroops.
stellar contract invoke --id "$TANUR_SAC" --source tanur-admin --network "$NET" \
  -- transfer --from "$ADMIN" --to "$KYC" --amount 300000000000 2>&1 | tail -1 || true

echo "▶ 1b. Post a TANUR/USDC sell offer on SDEX (treasury) so the in-app Buy works"
# Sell 5,000 TANUR (5_000 * 10^7 stroops) at 0.10 USDC each (price = 1:10).
TANUR_ASSET="TANUR:$(j "['assets']['tanur']['issuer']")"
stellar tx new manage-sell-offer --source tanur-admin --network "$NET" \
  --selling "$TANUR_ASSET" --buying "$USDC_ASSET" \
  --amount 50000000000 --price 1:10 --fee 1000 2>&1 | tail -1 || true

echo "▶ 2. Fund epoch $EPOCH with 100 USDC (30-day claim window)"
FUND_OUT=$(stellar contract invoke --id "$YIELD" --source tanur-admin --network "$NET" \
  -- fund_epoch --funder "$ADMIN" --epoch "$EPOCH" --amount 1000000000 --window_secs 2592000 2>&1)
FUND_TX=$(echo "$FUND_OUT" | last_hash)
echo "   fund tx: $FUND_TX"

echo "▶ 3. KYC investor claims their pro-rata USDC"
CLAIM_OUT=$(stellar contract invoke --id "$YIELD" --source tanur-kyc --network "$NET" \
  -- claim --holder "$KYC" --epoch "$EPOCH" 2>&1)
CLAIM_TX=$(echo "$CLAIM_OUT" | last_hash)
CLAIM_RET=$(echo "$CLAIM_OUT" | grep -oE '"[0-9]+"' | tail -1)
echo "   claim tx: $CLAIM_TX  (USDC paid, raw: $CLAIM_RET)"

echo
echo "✅ Loop complete on epoch $EPOCH"
echo "   fund : $EXPLORER/tx/$FUND_TX"
echo "   claim: $EXPLORER/tx/$CLAIM_TX"
echo
echo "FUND_TX=$FUND_TX"
echo "CLAIM_TX=$CLAIM_TX"
