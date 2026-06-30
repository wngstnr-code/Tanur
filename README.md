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
| TanurVault | `CCZVV5BYN76RYDA5MLCR7TOZC24IASMG2QL5KMXXCZT2Q5WP76OCUCOS` |
| TanurYield | `CAZAKOWVTG3HQ26H257SBQZDHB44JSS37XHGHEV3IRGFOYRMO6EH7L7J` |
| TANUR (SAC) | `CAWFHQLUXUHA3MJUBTYE7GXXQSKQPUOWBM4Q4LS6ZEVDC3SA227GPUZB` |
| USDC (Circle testnet) | `GBBD47IF6LWK7P7MDEVSCWR7DPUWV3NY3DTQEVFL4NAT4AQH3ZLLFLA5` |

**Upgradeable + verified.** Both contracts expose `upgrade(new_wasm_hash)` (SEP-49,
admin-gated) and embed `contractmeta` (name/version/source). The deployed WASM is a
**reproducible build** from CI (`.github/workflows/release.yml` via
`stellar-expert/soroban-build-workflow`), published as a GitHub Release with a build
attestation, so StellarExpert links each contract to this source commit:

| Contract | On-chain WASM hash (= attested CI build) |
|---|---|
| TanurVault | `f906873897de932b23c33c1ec5e8f4814be8754d6a0e42478ae91a7b32024a08` |
| TanurYield | `7dba117a725ea2f1abc4d94e2935861cbcf01203c135354cbf29b5d9f6018eb0` |

## The full economic loop, executed on-chain

record + atomic mint → fund USDC → KYC-gated claim. Verified transactions:

| Step | Tx |
|---|---|
| 1. `record_epoch` (+ mint TANUR) | [`aec624c8…`](https://stellar.expert/explorer/testnet/tx/aec624c8374726cea1b387e5dd31e2e0603421d69e3e9a71f014c966d5fe8735) |
| 2. `fund_epoch` (100 USDC) | [`cde626b4…`](https://stellar.expert/explorer/testnet/tx/cde626b44895a37d850623ce792b16e3c75d3a13956dff86db0a4561f58a2c68) |
| 3. `claim` (60 USDC, pro-rata, KYC-gated) | [`a2c23cd3…`](https://stellar.expert/explorer/testnet/tx/a2c23cd396d168d89082541f0da34f8f7fe5244abedff8d01ab7de4f7f4ef9f1) |

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
