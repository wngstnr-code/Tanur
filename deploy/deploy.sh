#!/usr/bin/env bash
# Tanur — deploy to Stellar Testnet: accounts, TANUR asset (AUTH_REQUIRED) + SAC,
# both Soroban contracts, SAC-admin handoff, and native KYC (authorized trustlines).
# Idempotent-ish: re-running regenerates addresses.json; individual on-chain steps
# that already exist will error harmlessly (guarded with `|| true` where safe).
set -uo pipefail
export PATH="/opt/homebrew/bin:$PATH"

NET=testnet
DIR="$(cd "$(dirname "$0")" && pwd)"
ROOT="$(cd "$DIR/.." && pwd)"
WASM_DIR="$ROOT/contracts/target/wasm32v1-none/release"
OUT="$DIR/addresses.json"

# Circle USDC testnet issuer (Tanur-Concept §15).
USDC_ISSUER="GBBD47IF6LWK7P7MDEVSCWR7DPUWV3NY3DTQEVFL4NAT4AQH3ZLLFLA5"

# Tokenomics defaults (§9).
TOKEN_RATE=1000   # TANUR per tonne Ni
GORR_BPS=100      # 1%

say() { printf "\n\033[1;36m▶ %s\033[0m\n" "$*" >&2; }

ensure_key() {
  local name="$1"
  if ! stellar keys address "$name" >/dev/null 2>&1; then
    say "Generating + funding key: $name"
    stellar keys generate "$name" --network "$NET" --fund >/dev/null 2>&1 || \
      stellar keys generate "$name" --network "$NET" >/dev/null 2>&1
  fi
  stellar keys fund "$name" --network "$NET" >/dev/null 2>&1 || true
  stellar keys address "$name"
}

say "1. Accounts"
ISSUER=$(ensure_key tanur-issuer)
ADMIN=$(ensure_key tanur-admin)     # distributor/treasury + contract admin + yield funder
ORACLE=$(ensure_key tanur-oracle)
KYC=$(ensure_key tanur-kyc)         # demo investor (KYC-authorized)
echo "issuer=$ISSUER admin=$ADMIN oracle=$ORACLE kyc=$KYC"

say "2. Issuer flags: AUTH_REQUIRED + AUTH_REVOCABLE (native KYC)"
stellar tx new set-options --source tanur-issuer --network "$NET" \
  --set-required --set-revocable --fee 1000 2>&1 | tail -1 || true

TANUR_ASSET="TANUR:$ISSUER"
USDC_ASSET="USDC:$USDC_ISSUER"

say "3. Deploy TANUR Stellar Asset Contract (SAC)"
TANUR_SAC=$(stellar contract asset deploy --asset "$TANUR_ASSET" \
  --source tanur-admin --network "$NET" 2>/dev/null) || true
if [ -z "${TANUR_SAC:-}" ]; then
  TANUR_SAC=$(stellar contract id asset --asset "$TANUR_ASSET" --network "$NET")
fi
echo "TANUR_SAC=$TANUR_SAC"

say "4. Resolve USDC SAC id (Circle testnet)"
stellar contract asset deploy --asset "$USDC_ASSET" --source tanur-admin --network "$NET" >/dev/null 2>&1 || true
USDC_SAC=$(stellar contract id asset --asset "$USDC_ASSET" --network "$NET")
echo "USDC_SAC=$USDC_SAC"

say "5. Deploy TanurVault"
VAULT=$(stellar contract deploy --wasm "$WASM_DIR/tanur_vault.wasm" \
  --source tanur-admin --network "$NET" -- \
  --admin "$ADMIN" --oracle "$ORACLE" --tanur_sac "$TANUR_SAC" \
  --treasury "$ADMIN" --token_rate "$TOKEN_RATE" --gorr_bps "$GORR_BPS")
echo "VAULT=$VAULT"

say "6. Deploy TanurYield"
YIELD=$(stellar contract deploy --wasm "$WASM_DIR/tanur_yield.wasm" \
  --source tanur-admin --network "$NET" -- \
  --admin "$ADMIN" --vault "$VAULT" --usdc "$USDC_SAC" --tanur_sac "$TANUR_SAC")
echo "YIELD=$YIELD"

say "7. Hand TANUR SAC admin to the Vault (enables atomic mint in record_epoch)"
stellar contract invoke --id "$TANUR_SAC" --source tanur-issuer --network "$NET" \
  -- set_admin --new_admin "$VAULT" 2>&1 | tail -1 || true

say "8. Trustlines + native KYC authorization"
# Treasury (admin) must hold TANUR to receive mints.
stellar tx new change-trust --source tanur-admin --network "$NET" --line "$TANUR_ASSET" --fee 1000 2>&1 | tail -1 || true
stellar tx new set-trustline-flags --source tanur-issuer --network "$NET" \
  --trustor "$ADMIN" --asset "$TANUR_ASSET" --set-authorize --fee 1000 2>&1 | tail -1 || true
# KYC investor: authorized TANUR trustline = native KYC gate.
stellar tx new change-trust --source tanur-kyc --network "$NET" --line "$TANUR_ASSET" --fee 1000 2>&1 | tail -1 || true
stellar tx new set-trustline-flags --source tanur-issuer --network "$NET" \
  --trustor "$KYC" --asset "$TANUR_ASSET" --set-authorize --fee 1000 2>&1 | tail -1 || true
# USDC trustlines for admin (funder) + kyc (claimer).
stellar tx new change-trust --source tanur-admin --network "$NET" --line "$USDC_ASSET" --fee 1000 2>&1 | tail -1 || true
stellar tx new change-trust --source tanur-kyc --network "$NET" --line "$USDC_ASSET" --fee 1000 2>&1 | tail -1 || true

say "9. Mirror KYC into the Vault (cross-contract gate for claims)"
stellar contract invoke --id "$VAULT" --source tanur-admin --network "$NET" \
  -- set_kyc --account "$KYC" --approved true 2>&1 | tail -1 || true

say "Writing $OUT"
cat > "$OUT" <<JSON
{
  "network": "$NET",
  "network_passphrase": "Test SDF Network ; September 2015",
  "rpc_url": "https://soroban-testnet.stellar.org",
  "horizon_url": "https://horizon-testnet.stellar.org",
  "explorer": "https://stellar.expert/explorer/testnet",
  "accounts": {
    "issuer": "$ISSUER",
    "admin": "$ADMIN",
    "oracle": "$ORACLE",
    "kyc_user": "$KYC"
  },
  "assets": {
    "tanur": { "code": "TANUR", "issuer": "$ISSUER", "sac": "$TANUR_SAC" },
    "usdc": { "code": "USDC", "issuer": "$USDC_ISSUER", "sac": "$USDC_SAC" }
  },
  "contracts": {
    "vault": "$VAULT",
    "yield": "$YIELD"
  },
  "tokenomics": { "token_rate": $TOKEN_RATE, "gorr_bps": $GORR_BPS }
}
JSON

echo
echo "✅ Deploy complete. Addresses → $OUT"
cat "$OUT"
