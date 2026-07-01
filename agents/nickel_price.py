"""
Tanur — Live nickel price feed.

Real-world nickel price from FRED series **PNICKUSDM** ("Global price of Nickel",
IMF data, USD per metric ton, monthly). Public CSV endpoint — free, no API key.

Two live reference points are derived from this one real series:
  - **LME reference**   = the latest observation (current global metal price).
  - **HMA reference**   = the prior month's observation. ESDM's Harga Mineral Acuan
    (the basis of the official HPM) is set from the prior period's average, so the
    previous monthly print is a faithful, *live* proxy — not a hand-picked factor.

Cross-validating latest vs prior month is a genuine month-over-month integrity check.
"""

import csv
import io
import logging
from typing import List, Optional, Tuple

import aiohttp

FRED_CSV_URL = "https://fred.stlouisfed.org/graph/fredgraph.csv?id=PNICKUSDM"
FRED_SERIES = "PNICKUSDM"
FEED_LABEL = "FRED PNICKUSDM (IMF Global price of Nickel, USD/ton)"

log = logging.getLogger("nickel-price")


async def fetch_nickel_series(
    session: aiohttp.ClientSession, last: int = 6, timeout: float = 20.0
) -> Optional[List[Tuple[str, int]]]:
    """Fetch the most recent `last` valid observations, oldest→newest.

    Returns a list of (observation_date, price_cents_per_ton), or None if the feed
    is unreachable / unparseable (callers then fall back to representative figures).
    """
    try:
        async with session.get(
            FRED_CSV_URL, timeout=aiohttp.ClientTimeout(total=timeout)
        ) as resp:
            if resp.status != 200:
                log.warning(f"[FEED] FRED returned HTTP {resp.status}")
                return None
            text = await resp.text()
    except Exception as e:  # noqa: BLE001 — network feed is best-effort
        log.warning(f"[FEED] FRED fetch failed: {e}")
        return None

    obs: List[Tuple[str, int]] = []
    reader = csv.reader(io.StringIO(text))
    next(reader, None)  # skip header row
    for row in reader:
        if len(row) < 2:
            continue
        date, raw = row[0], row[1].strip()
        if raw in ("", "."):  # FRED marks missing observations with "."
            continue
        try:
            obs.append((date, int(round(float(raw) * 100))))  # USD/ton → cents/ton
        except ValueError:
            continue

    if not obs:
        log.warning("[FEED] No valid observation found in FRED response")
        return None
    return obs[-last:]


async def fetch_nickel_price(
    session: aiohttp.ClientSession, timeout: float = 20.0
) -> Optional[Tuple[int, str]]:
    """Latest global nickel price as (price_cents_per_ton, observation_date)."""
    series = await fetch_nickel_series(session, last=1, timeout=timeout)
    if not series:
        return None
    date, cents = series[-1]
    return cents, date
