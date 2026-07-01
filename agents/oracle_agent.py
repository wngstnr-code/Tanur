"""
Tanur — AI Oracle Agent
=======================
Autonomous agent that gathers Indonesian nickel data from three feeds, cross-
validates them, runs a Gemini reasoning gate to veto anomalies, and posts the
verified epoch on-chain to the TanurVault contract on Stellar Testnet — where
recording the epoch atomically mints TANUR (Tanur-Concept §6.2).

Data feeds (3-feed integrity — the core lesson of the project):
  - LME Nickel        — global exchange reference (FRED PNICKUSDM, USD/ton, live)
  - HPM (HMA) ESDM    — Indonesia's official mineral reference price (representative,
                        derived from the LME reference × Ni-content factor)
  - Antam (ANTM)      — audited quarterly production tonnage (representative in MVP)

AI's role (§6.4): the oracle is a data pipeline; Gemini is the *anomaly gate* that
can veto bad data before it ever touches the chain. AI guards trust — it is not the
headline. The LLM call stays off the critical demo path: set DEMO_ANOMALY=on to inject
a fake price spike and watch Gemini reject it.
"""

import asyncio
import json
import logging
import os
import time
from dataclasses import dataclass
from datetime import datetime, timezone
from pathlib import Path
from typing import Optional

import aiohttp
import google.generativeai as genai
from dotenv import load_dotenv

from nickel_price import fetch_nickel_price, FEED_LABEL
from stellar_writer import StellarWriter

load_dotenv()
logging.basicConfig(level=logging.INFO, format="%(asctime)s [%(levelname)s] %(message)s")
log = logging.getLogger("tanur-oracle")

# ─── CONFIG ───

REPO_ROOT = Path(__file__).resolve().parent.parent
ADDRESSES_FILE = REPO_ROOT / "deploy" / "addresses.json"

GEMINI_API_KEY = os.getenv("GEMINI_API_KEY", "")
GEMINI_MODEL = os.getenv("GEMINI_MODEL", "gemini-2.5-flash")
if GEMINI_API_KEY:
    genai.configure(api_key=GEMINI_API_KEY)

# Inject a fake price spike to demonstrate the Gemini veto (§6.4 demo guidance).
DEMO_ANOMALY = os.getenv("DEMO_ANOMALY", "off").lower() == "on"

# Validation thresholds.
MAX_SOURCE_DIVERGENCE_PCT = 10.0
MIN_VALIDATION_SCORE = 60

# HPM is derived from the LME reference × Ni-content correction (Kepmen 144.K/2026).
HPM_NI_FACTOR = 0.98  # ~official reference sits just under the LME global print


# ─── DATA STRUCTURES ───

@dataclass
class NickelEpochData:
    epoch: int
    epoch_label: str
    tonnes_ni: int
    lme_price_cents: int   # LME global reference, USD cents/ton
    hpm_price_cents: int   # ESDM official reference, USD cents/ton
    validation_score: int
    data_source: str


@dataclass
class SourceReading:
    source: str
    tonnes_ni: Optional[int]
    price_cents: Optional[int]
    confidence: int


# ─── DATA FEEDS ───

async def fetch_lme_nickel(
    session: aiohttp.ClientSession, real_price_cents: Optional[int]
) -> SourceReading:
    """LME Nickel — global exchange reference (live via FRED PNICKUSDM)."""
    log.info("[LME] Global nickel reference (live feed)...")
    return SourceReading(
        source="LME",
        tonnes_ni=None,                              # price-only source
        price_cents=real_price_cents or 1_600_000,   # live feed, fallback $16,000/ton
        confidence=95,
    )


async def fetch_hpm_esdm(
    session: aiohttp.ClientSession, real_price_cents: Optional[int]
) -> SourceReading:
    """HPM/HMA ESDM — Indonesia's official mineral reference price.

    Published ~2×/month on minerba.esdm.go.id + APNI under Kepmen 144.K/2026.
    Representative in MVP: derived from the live LME reference × Ni-content factor.
    """
    log.info("[HPM] ESDM official reference (Kepmen 144.K/2026)...")
    base = real_price_cents or 1_600_000
    return SourceReading(
        source="HPM-ESDM",
        tonnes_ni=None,
        price_cents=int(base * HPM_NI_FACTOR),
        confidence=90,
    )


async def fetch_antam_production(
    session: aiohttp.ClientSession, real_price_cents: Optional[int]
) -> SourceReading:
    """Antam (ANTM) — audited quarterly nickel production from IDX filings.

    Representative tonnage in MVP (clear path to the live audited feed). Price
    anchored to the live LME reference for cross-validation.
    """
    log.info("[ANTAM] Audited quarterly production (IDX filing)...")
    return SourceReading(
        source="ANTM",
        tonnes_ni=5_000,                             # representative monthly Ni-content output
        price_cents=real_price_cents or 1_600_000,
        confidence=85,
    )


# ─── CROSS-VALIDATION ───

def compute_validation_score(readings: list[SourceReading]) -> tuple[int, int, int, str]:
    """Cross-validate the feeds. Returns (tonnes, avg_price_cents, score, sources)."""
    price_readings = [r for r in readings if r.price_cents is not None]
    production_readings = [r for r in readings if r.tonnes_ni is not None]
    sources = "+".join(r.source for r in readings)

    avg_price = int(sum(r.price_cents for r in price_readings) / len(price_readings))
    max_price = max(r.price_cents for r in price_readings)
    min_price = min(r.price_cents for r in price_readings)
    price_divergence = (max_price - min_price) / avg_price * 100

    avg_tonnes = int(
        sum(r.tonnes_ni for r in production_readings) / len(production_readings)
    )

    base_score = int(sum(r.confidence for r in readings) / len(readings))
    if price_divergence > MAX_SOURCE_DIVERGENCE_PCT:
        log.warning(f"[VALIDATE] High price divergence: {price_divergence:.1f}% — penalizing")
        base_score = max(0, base_score - int(price_divergence * 2))
    if len(readings) >= 3 and price_divergence < 5.0:
        base_score = min(100, base_score + 5)

    log.info(f"[VALIDATE] Score {base_score} | divergence {price_divergence:.1f}%")
    log.info(f"[VALIDATE] Avg price ${avg_price/100:,.2f}/ton | production {avg_tonnes:,} t Ni")
    return avg_tonnes, avg_price, base_score, sources


# ─── GEMINI ANOMALY GATE ───

async def analyze_with_gemini(
    readings: list[SourceReading],
    tonnes_ni: int,
    price_cents: int,
    base_score: int,
    epoch_label: str,
) -> tuple[int, str]:
    """Gemini reasons about data quality and can veto anomalies the math misses."""
    if not GEMINI_API_KEY:
        log.warning("[GEMINI] No API key — skipping AI gate (base score kept)")
        return base_score, "AI gate skipped (no GEMINI_API_KEY)"

    log.info("[GEMINI] Running anomaly gate on nickel data...")
    readings_text = "\n".join(
        f"  - {r.source}: "
        f"{f'{r.tonnes_ni:,} t Ni' if r.tonnes_ni else 'price-only'}, "
        f"{f'${r.price_cents/100:,.0f}/ton' if r.price_cents else 'N/A'}, "
        f"confidence={r.confidence}%"
        for r in readings
    )

    prompt = f"""You are the data-integrity gate for Tanur, which tokenizes Indonesian nickel revenue on Stellar. Bad data leads to incorrect TANUR minting and unfair USDC yield. Your job: decide if this epoch is trustworthy enough to record on-chain.

EPOCH: {epoch_label}
RAW FEED READINGS:
{readings_text}

CROSS-VALIDATED RESULT:
  - Consensus production: {tonnes_ni:,} tonnes Ni-content
  - Consensus price: ${price_cents/100:,.2f}/ton
  - Base validation score: {base_score}/100

CONTEXT:
  - Normal LME nickel price (2025-2026): $14,000-$22,000/ton
  - Indonesia dominates ~50% of global nickel supply
  - HPM (ESDM official reference) normally sits within a few % of the LME print
  - Representative monthly Ni-content output for a single operation: 3,000-8,000 t
  - A sudden 2x+ price jump with no corroborating source is a red flag

ANALYZE:
1. Is the price within the normal band and consistent across LME vs HPM?
2. Is the production figure plausible?
3. Any suspicious spike or divergence?
4. Overall: trustworthy for on-chain recording?

Respond in EXACTLY this JSON:
{{
  "trustworthy": true,
  "score_adjustment": 0,
  "anomalies": [],
  "analysis": "2-3 sentence summary",
  "recommendation": "APPROVE"
}}

score_adjustment: integer -30..+10 (negative if issues). recommendation: "APPROVE" or "REJECT"."""

    try:
        model = genai.GenerativeModel(GEMINI_MODEL)
        response = await asyncio.to_thread(model.generate_content, prompt)
        raw = response.text.strip()
        if "```json" in raw:
            raw = raw.split("```json")[1].split("```")[0].strip()
        elif "```" in raw:
            raw = raw.split("```")[1].split("```")[0].strip()
        result = json.loads(raw)

        adjustment = int(result.get("score_adjustment", 0))
        analysis = result.get("analysis", "")
        anomalies = result.get("anomalies", [])
        recommendation = result.get("recommendation", "APPROVE")
        adjusted = max(0, min(100, base_score + adjustment))

        log.info(f"[GEMINI] adjustment {adjustment:+d} → {adjusted} | {recommendation}")
        log.info(f"[GEMINI] {analysis}")
        for a in anomalies:
            log.warning(f"[GEMINI] ⚠ Anomaly: {a}")

        if recommendation == "REJECT":
            log.error("[GEMINI] AI VETO — epoch rejected before reaching chain")
            return 0, f"REJECTED by AI: {analysis}"
        return adjusted, analysis
    except Exception as e:  # noqa: BLE001 — never hard-fail on the LLM
        log.error(f"[GEMINI] Gate failed: {e} — keeping base score")
        return base_score, "AI gate unavailable"


# ─── ORACLE CYCLE ───

async def run_oracle_cycle() -> Optional[str]:
    """One cycle: fetch 3 feeds → cross-validate → Gemini gate → record on-chain."""
    writer = StellarWriter.from_addresses(ADDRESSES_FILE)

    now = datetime.now(timezone.utc)
    epoch_label = now.strftime("%Y-%m") + " Morowali"
    # Next epoch = on-chain latest + 1 (avoids DuplicateEpoch on re-runs).
    epoch = writer.get_latest_epoch() + 1

    log.info(f"=== Tanur Oracle — epoch {epoch} ({epoch_label}) ===")

    async with aiohttp.ClientSession() as session:
        feed = await fetch_nickel_price(session)
        real_price_cents = feed[0] if feed else None
        if feed:
            log.info(f"[FEED] Live nickel price ${real_price_cents/100:,.2f}/ton "
                     f"({FEED_LABEL}, obs {feed[1]})")
        else:
            log.warning("[FEED] Live feed unavailable — using representative figures")

        readings = list(await asyncio.gather(
            fetch_lme_nickel(session, real_price_cents),
            fetch_hpm_esdm(session, real_price_cents),
            fetch_antam_production(session, real_price_cents),
        ))

        if DEMO_ANOMALY:
            # Spike ALL feeds together so cross-validation (divergence) still passes —
            # the reading is internally consistent but absurdly high in absolute terms.
            # This is the case only the Gemini reasoning gate can catch (§6.4).
            log.warning("[DEMO] Injecting an internally-consistent 2.5x price spike "
                        "across all feeds — only the Gemini gate should veto it")
            for r in readings:
                if r.price_cents is not None:
                    r.price_cents = int(r.price_cents * 2.5)

        tonnes_ni, price_cents, score, sources = compute_validation_score(readings)
        if score < MIN_VALIDATION_SCORE:
            log.error(f"[ORACLE] Score {score} < {MIN_VALIDATION_SCORE} — REJECTED (stats)")
            return None

        score, analysis = await analyze_with_gemini(
            readings, tonnes_ni, price_cents, score, epoch_label
        )
        if score < MIN_VALIDATION_SCORE:
            log.error("[ORACLE] Below threshold after AI gate — REJECTED (not posted)")
            return None

        hpm = next(r.price_cents for r in readings if r.source == "HPM-ESDM")
        data = NickelEpochData(
            epoch=epoch,
            epoch_label=epoch_label,
            tonnes_ni=tonnes_ni,
            lme_price_cents=price_cents,
            hpm_price_cents=hpm,
            validation_score=score,
            data_source=sources,
        )

        log.info("[ORACLE] Verified epoch:")
        log.info(f"  Production : {data.tonnes_ni:,} t Ni")
        log.info(f"  LME price  : ${data.lme_price_cents/100:,.2f}/ton")
        log.info(f"  HPM price  : ${data.hpm_price_cents/100:,.2f}/ton")
        log.info(f"  Score      : {data.validation_score}/100 (AI-gated)")
        log.info(f"  Sources    : {sources}")

        tx_hash = writer.record_epoch(
            epoch=data.epoch,
            label=data.epoch_label,
            tonnes=data.tonnes_ni,
            lme_price_cents=data.lme_price_cents,
            hpm_price_cents=data.hpm_price_cents,
            score=data.validation_score,
        )
        log.info(f"[ORACLE] ✅ Epoch {epoch} recorded + TANUR minted — tx {tx_hash}")
        log.info(f"[ORACLE]    {writer.explorer}/tx/{tx_hash}")
        return tx_hash


async def main():
    once = os.getenv("ORACLE_ONCE", "on").lower() == "on"
    log.info("Tanur AI Oracle Agent starting...")
    while True:
        try:
            await run_oracle_cycle()
        except Exception as e:  # noqa: BLE001
            log.error(f"[ORACLE] Cycle failed: {e}", exc_info=True)
        if once:
            break
        log.info("[ORACLE] Next cycle in 30 days. Sleeping...")
        await asyncio.sleep(30 * 24 * 3600)


if __name__ == "__main__":
    asyncio.run(main())
