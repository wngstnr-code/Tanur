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
| **TanurYield** (Soroban) | Holds per-epoch USDC; **Merkle-proof `claim`**, **KYC-gated** via a cross-contract read to the Vault; funds only Vault-recorded epochs; window + sweep. |
| **TANUR** (Stellar Asset + SAC) | Native asset, tradeable on SDEX. KYC = `AUTH_REQUIRED` trustline authorized by the issuer. |
| **Oracle Agent** (Python) | LME + HPM(ESDM) + Antam → cross-validate → **deterministic plausibility gate** → **Gemini reasoning gate** → post on-chain via stellar-sdk. The trust guarantee is deterministic; the LLM adds reasoning on top, it is never the sole gate. |
| **Market Analyst** (Python, stretch) | Closed loop: read chain → Gemini → tune GORR on-chain within ±100 bps / [1%,10%] safety rails. |
| **Frontend** (Next.js) | Connect Freighter (Stellar Wallets Kit) → buy TANUR (USDC via SDEX) → position in USD + Rupiah (`open.er-api.com`) → claim USDC. |

## Deployed on Stellar Testnet

Addresses live in [`deploy/addresses.json`](./deploy/addresses.json). Explorer:
[stellar.expert/explorer/testnet](https://stellar.expert/explorer/testnet).

| | Contract / Asset |
|---|---|
| TanurVault | `CAAQKZFA6SLEGO6NIEFTATWSCS4VP464NA4BJJZFX53LQVUKDANMG2L7` |
| TanurYield | `CCDEL4BVX552UN6C2PO4ZRR54VYJFGARO5ZM7EW6CVA537JR5FVOOHYX` |
| TANUR (SAC) | `CCKIUVK3NDBEIMGYR7HMHQCDIN3ZQ63ALWYDHWNWXVPHXJWVTWUDEEB3` |
| USDC (Circle testnet) | `GBBD47IF6LWK7P7MDEVSCWR7DPUWV3NY3DTQEVFL4NAT4AQH3ZLLFLA5` |

**Upgradeable + verified.** Both contracts expose `upgrade(new_wasm_hash)` (SEP-49,
admin-gated) and embed `contractmeta` (name/version/source). The deployed WASM is a
**reproducible build** from CI (`.github/workflows/release.yml` via
`stellar-expert/soroban-build-workflow`), published as a GitHub Release with a build
attestation, so StellarExpert links each contract to this source commit:

| Contract | On-chain WASM hash (= attested CI build) |
|---|---|
| TanurVault | `086a1d878ec9d83792c77ec5a97705124f242456cfe12a15e93d0d16370afebd` |
| TanurYield | `54ed504df6647b793e91a5357ce450367b1b3cbf83d47571971170b931ae29a8` |

## The full economic loop, executed on-chain

record + atomic mint → fund USDC → KYC-gated claim. Verified transactions:

| Step | Tx |
|---|---|
| 1. `record_epoch` (+ mint TANUR) | [`d782b72a…`](https://stellar.expert/explorer/testnet/tx/d782b72aa9e929b074b86785a21e7c29a63579614c5d3ded82a9fa3c7e036522) |
| 2. `fund_epoch` (100 USDC) | [`de14f90c…`](https://stellar.expert/explorer/testnet/tx/de14f90c0ade1ceaed33d26db4ab1d9edecf29b0864e35767a3d81e9640f5be8) |
| 3. `claim` (60 USDC, Merkle proof, KYC-gated) | [`c56180c3…`](https://stellar.expert/explorer/testnet/tx/c56180c3deeb62389a32526d97ab6b2335fc0bc2aec7845eec2052ee7c344067) |

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
- **Merkle claims** — entitlements are snapshotted off-chain and committed as a Merkle
  root at fund time; `claim(holder, epoch, amount, proof)` verifies the proof on-chain.
  The amount is fixed by the snapshot, so moving TANUR during the window cannot change
  it — this closes the live-balance "shuffle" gaming a pro-rata-on-live-balance design
  allows. Leaf = `sha256(XDR(Address) || XDR(i128))`; off-chain builder in `agents/merkle.py`.
- **Fund guarded** — `fund_epoch` refuses epochs the Vault never recorded (`epoch_exists`).
- **Per-epoch mint cap** (`MAX_TONNES_PER_EPOCH`) bounds blast radius if the oracle key leaks.
- **Key rotation** — `set_oracle` / `set_admin` on the Vault, `set_admin` on Yield.
- **Emergency pause** on Yield (`set_paused`) gating `fund_epoch` + `claim`.
- **Instance TTL** extended on Yield hot paths so config can't be archived on idle.
- **Checked arithmetic** throughout the claim math.
- **Upgradeable (SEP-49)** + **verified reproducible builds** (see above).

The full contract test suite (19 unit tests, incl. Merkle proof verify, invalid-proof
rejection, double-claim, KYC gating, pause, sweep) is green.

## Data provenance (honest)

- **Live:** nickel price (FRED PNICKUSDM / IMF), USD→IDR (public FX API, display-only).
- **Representative in MVP:** HPM (ESDM official reference) and Antam audited production —
  clear path to the live feeds. Record + mint are atomic inside the Vault, so the minted
  amount is cryptographically tied to the verified epoch — the operator cannot insert a
  different number.

*Tanur — APAC Stellar Hackathon 2026 · RWA · DeFi · Agentic AI · Indonesian Nickel*
