# Tanur — Tokenized Indonesian Nickel Revenue on Stellar

> *Dari bijih jadi yield.* Own a fractional, yield-bearing claim on Indonesia's
> nickel revenue. Buy `TANUR` with USDC, earn USDC yield from verified production —
> anchored on official data feeds (LME + HPM/ESDM + Antam), with an AI oracle that
> rejects bad data before it hits the chain.

Built for the **APAC Stellar Hackathon 2026**. Primary track: *Local Finance &
Real-World Access*. Secondary: *DeFi & Composability*. See [`Tanur-Concept.md`](./Tanur-Concept.md)
for the full design.

## Architecture

Two Soroban contracts + a native Stellar asset (TANUR) exposed via its SAC:

| Component | Role |
|---|---|
| **TanurVault** (Soroban) | `record_epoch` (oracle-gated) + rolling oracle reputation + **atomic mint** of TANUR via the SAC from the state it just recorded. Native KYC mirror for cross-contract gating. |
| **TanurYield** (Soroban) | Holds per-epoch USDC; pro-rata `claim` **KYC-gated** via a cross-contract read to the Vault; fund window + sweep. |
| **TANUR** (Stellar Asset + SAC) | Native asset, tradeable on SDEX. KYC = `AUTH_REQUIRED` trustline authorized by the issuer. |
| **Oracle Agent** (Python) | LME + HPM(ESDM) + Antam → cross-validate → **Gemini anomaly gate** → post on-chain via stellar-sdk. |
| **Market Analyst** (Python, stretch) | Closed loop: read chain → Gemini → tune GORR on-chain within ±100 bps / [1%,10%] safety rails. |
| **Frontend** (Next.js) | Connect Freighter (Stellar Wallets Kit) → buy TANUR (USDC via SDEX) → position in USD + Rupiah (`open.er-api.com`) → claim USDC. |

## Deployed on Stellar Testnet

Addresses live in [`deploy/addresses.json`](./deploy/addresses.json). Explorer:
[stellar.expert/explorer/testnet](https://stellar.expert/explorer/testnet).

| | Contract / Asset |
|---|---|
| TanurVault | `CBORXURFYF5RZVFW423IE4VWAVU5AD32ZPYTKVVCCOU3LX7ZPY7OGVMJ` |
| TanurYield | `CCTXME7WDWRP7G65SYYTFO2YZ5IKVNERMRF6Q6MAWXSURF66FBD6JUWJ` |
| TANUR (SAC) | `CDXYMTWV32PKGEOYJT4AMOSPO72RLADKLZ2CDWP7YWKTBXATHNAT3M4D` |
| USDC (Circle testnet) | `GBBD47IF6LWK7P7MDEVSCWR7DPUWV3NY3DTQEVFL4NAT4AQH3ZLLFLA5` |

## The full economic loop, executed on-chain

record + atomic mint → fund USDC → KYC-gated claim. Verified transactions:

| Step | Tx |
|---|---|
| 1. `record_epoch` (+ mint TANUR) | [`09e36874…`](https://stellar.expert/explorer/testnet/tx/09e368743d675ad3f34ce9044f120b07fc721a253cce754ca1c6256e3a67d989) |
| 2. `fund_epoch` (100 USDC) | [`907f895e…`](https://stellar.expert/explorer/testnet/tx/907f895e7a5b5bb9abb86481151d15776301ac067fabfcc0c4adbd7a8d7b9044) |
| 3. `claim` (60 USDC, pro-rata, KYC-gated) | [`2b86c229…`](https://stellar.expert/explorer/testnet/tx/2b86c229a4bc6700303e60a5576da81ef5308654433c4e02edcb8060aa141986) |

## Run it

**Contracts** (Rust + Stellar CLI):
```bash
cd contracts && cargo test          # unit tests (vault + yield)
stellar contract build              # → target/wasm32v1-none/release/*.wasm
```

**Deploy** (regenerates accounts, asset, contracts, KYC):
```bash
bash deploy/deploy.sh               # writes deploy/addresses.json
bash deploy/run-loop.sh             # executes fund + claim, prints tx hashes
```

**Oracle agent** (Python):
```bash
cd agents && python3 -m venv .venv && .venv/bin/pip install -r requirements.txt
cp .env.example .env                # add GEMINI_API_KEY + ORACLE_SECRET
.venv/bin/python oracle_agent.py    # fetch → cross-validate → Gemini gate → record on-chain
DEMO_ANOMALY=on .venv/bin/python oracle_agent.py   # watch the AI veto a fake price spike
```

**Frontend** (Next.js):
```bash
cd frontend && npm install && npm run dev   # http://localhost:3000
```

## Security & hardening

Reviewed against the Stellar smart-contract security checklist. All privileged paths
require auth, init uses `__constructor` (no reinit), cross-contract addresses are set
at deploy (no arbitrary calls), and record+mint are atomic.

Hardening applied:
- **Per-epoch mint cap** (`MAX_TONNES_PER_EPOCH`) bounds blast radius if the oracle key leaks.
- **Key rotation** — `set_oracle` / `set_admin` on the Vault, `set_admin` on Yield.
- **Emergency pause** on Yield (`set_paused`) gating `fund_epoch` + `claim`.
- **Instance TTL** extended on Yield hot paths so config can't be archived on idle.
- **Checked arithmetic** on the claim pro-rata math.

Known limitation (documented, not yet fixed): `claim` computes the share from the
*live* TANUR balance against a *snapshot* supply, so an actor with multiple KYC
accounts could shuffle tokens within a claim window to over-claim relative to other
holders (the `remaining` cap still bounds total payout to the funded amount). The fix
is a per-holder **balance snapshot / Merkle claims** — see roadmap (`Tanur-Concept.md` §13).

## Data provenance (honest)

- **Live:** nickel price (FRED PNICKUSDM / IMF), USD→IDR (public FX API, display-only).
- **Representative in MVP:** HPM (ESDM official reference) and Antam audited production —
  clear path to the live feeds. Record + mint are atomic inside the Vault, so the minted
  amount is cryptographically tied to the verified epoch — the operator cannot insert a
  different number.

*Tanur — APAC Stellar Hackathon 2026 · RWA · DeFi · Agentic AI · Indonesian Nickel*
