"""
Tanur — Market Analyst Agent (STRETCH, closed-loop)
===================================================
Reads TanurVault state on Stellar, asks Gemini to reason about the nickel market
and protocol health, and — only when AUTONOMY_MODE=on — autonomously tunes the
GORR on-chain within hard safety rails (Tanur-Concept §6.3, §10).

The closed loop is READ chain → REASON (Gemini) → WRITE chain. It is positioned
as a differentiator that *supports* the product, not the whole story. Per §6.4,
do not run the live LLM write on the critical demo path — record the closed loop
under controlled conditions. AUTONOMY_MODE defaults to off (report-only).
"""

import asyncio
import json
import logging
import os
from pathlib import Path

import google.generativeai as genai
from dotenv import load_dotenv

from stellar_writer import StellarWriter

load_dotenv()
logging.basicConfig(level=logging.INFO, format="%(asctime)s [%(levelname)s] %(message)s")
log = logging.getLogger("tanur-analyst")

REPO_ROOT = Path(__file__).resolve().parent.parent
ADDRESSES_FILE = REPO_ROOT / "deploy" / "addresses.json"

GEMINI_API_KEY = os.getenv("GEMINI_API_KEY", "")
GEMINI_MODEL = os.getenv("GEMINI_MODEL", "gemini-2.5-flash")
if GEMINI_API_KEY:
    genai.configure(api_key=GEMINI_API_KEY)

# Closed-loop autonomy + safety rails (mirror the contract band).
AUTONOMY_MODE = os.getenv("AUTONOMY_MODE", "off").lower() == "on"
MAX_GORR_CHANGE_BPS = int(os.getenv("MAX_GORR_CHANGE_BPS", "100"))
MIN_GORR_BPS = int(os.getenv("MIN_GORR_BPS", "100"))
MAX_GORR_BPS = int(os.getenv("MAX_GORR_BPS", "1000"))
ANALYST_SECRET = os.getenv("ANALYST_SECRET", "")  # admin key, for the write


def clamp_gorr(recommended: int, current: int):
    """Never let one AI cycle move GORR beyond ±MAX_GORR_CHANGE_BPS or outside
    the [MIN, MAX] band."""
    delta = recommended - current
    safe = recommended
    reason = None
    if abs(delta) > MAX_GORR_CHANGE_BPS:
        safe = current + (MAX_GORR_CHANGE_BPS if delta > 0 else -MAX_GORR_CHANGE_BPS)
        reason = f"capped to ±{MAX_GORR_CHANGE_BPS} bps (AI wanted {delta:+d})"
    safe = max(MIN_GORR_BPS, min(MAX_GORR_BPS, safe))
    return safe, reason


def gemini_analysis(state: dict) -> dict:
    if not GEMINI_API_KEY:
        log.warning("[ANALYST] No GEMINI_API_KEY — holding GORR steady")
        return {"gorr_recommendation_bps": state["gorr_bps"], "analysis": "AI unavailable"}

    prompt = f"""You are the Market Analyst for Tanur, which tokenizes Indonesian nickel revenue on Stellar (yield paid in USDC).

CURRENT ON-CHAIN STATE (Stellar Testnet):
  - GORR: {state['gorr_bps']} bps ({state['gorr_bps']/100:.1f}%)
  - Oracle reputation: {state['oracle_reputation']}/100
  - Epochs recorded: {state['epoch_count']}
  - Total Ni recorded: {state['total_tonnes']:,} tonnes
  - TANUR minted: {state['total_minted']:,}
  - Token rate: {state['token_rate']} TANUR/tonne

GORR (Gross Overriding Royalty Rate) is the share of nickel revenue routed to holders.
Higher GORR = more yield but more cost to the operation. Target a sustainable APY.
Safety rails: GORR must stay within [{MIN_GORR_BPS}, {MAX_GORR_BPS}] bps and move at
most {MAX_GORR_CHANGE_BPS} bps per cycle.

Respond in EXACTLY this JSON:
{{
  "analysis": "2-3 sentence market + protocol assessment",
  "gorr_recommendation_bps": {state['gorr_bps']},
  "reasoning": "why this GORR"
}}"""

    try:
        model = genai.GenerativeModel(GEMINI_MODEL)
        raw = model.generate_content(prompt).text.strip()
        if "```json" in raw:
            raw = raw.split("```json")[1].split("```")[0].strip()
        elif "```" in raw:
            raw = raw.split("```")[1].split("```")[0].strip()
        return json.loads(raw)
    except Exception as e:  # noqa: BLE001
        log.error(f"[ANALYST] Gemini failed: {e} — holding steady")
        return {"gorr_recommendation_bps": state["gorr_bps"], "analysis": "AI error"}


def run_cycle():
    writer = StellarWriter.from_addresses(ADDRESSES_FILE)
    state = writer.read_state()
    log.info(f"[ANALYST] State: GORR {state['gorr_bps']}bps, rep {state['oracle_reputation']}/100, "
             f"{state['epoch_count']} epochs, {state['total_tonnes']:,} t Ni")

    result = gemini_analysis(state)
    log.info(f"[ANALYST] {result.get('analysis', '')}")

    recommended = int(result.get("gorr_recommendation_bps", state["gorr_bps"]))
    safe, note = clamp_gorr(recommended, state["gorr_bps"])
    if note:
        log.warning(f"[ANALYST] Safety rail: {note}")
    log.info(f"[ANALYST] GORR {state['gorr_bps']} → recommend {safe} bps")

    if safe == state["gorr_bps"]:
        log.info("[ANALYST] No change needed.")
        return
    if not AUTONOMY_MODE:
        log.info("[ANALYST] AUTONOMY_MODE=off — report only, not writing on-chain.")
        return
    if not ANALYST_SECRET:
        log.error("[ANALYST] AUTONOMY_MODE=on but ANALYST_SECRET (admin) not set")
        return

    log.warning(f"[AUTONOMY] Applying GORR {safe} bps on-chain...")
    tx = writer.set_gorr(safe, ANALYST_SECRET)
    log.info(f"[AUTONOMY] ✅ GORR updated — tx {tx}")
    log.info(f"[AUTONOMY]    {writer.explorer}/tx/{tx}")


async def main():
    once = os.getenv("ANALYST_ONCE", "on").lower() == "on"
    log.info("Tanur Market Analyst Agent starting...")
    while True:
        try:
            run_cycle()
        except Exception as e:  # noqa: BLE001
            log.error(f"[ANALYST] Cycle failed: {e}", exc_info=True)
        if once:
            break
        await asyncio.sleep(6 * 3600)


if __name__ == "__main__":
    asyncio.run(main())
