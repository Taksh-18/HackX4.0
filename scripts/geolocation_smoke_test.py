"""Standalone sanity check for app/geolocation.py against Chunk 2's raw JSON.

Chunk 3 (app/extraction.py) writes extracted_json.landmark / .disaster_type
via an LLM call, and its output isn't checked into data/simulated_reports.json
(which only has id/source_user/raw_text/media_url/timestamp/gps_lat/gps_lon).
Calling a real LLM here would make this script network- and key-dependent,
which defeats the point of a fast offline sanity check.

So this script uses a small keyword/regex placeholder (`_placeholder_extract`
below) to stand in for Chunk 3's landmark/disaster_type fields. It is
deliberately dumb - it exists only to exercise app/geolocation.py's resolution
logic end to end. See the "Chunk 3 integration" notes at the bottom of this
file for what to change once real extraction is wired in.

Run: python -m scripts.geolocation_smoke_test   (from the HackX4.0/ directory)
"""

from __future__ import annotations

import json
import os
import re
from pathlib import Path

# This script is explicitly an offline check; set before importing the module.
os.environ.setdefault("CDIS_OFFLINE_GEOCODE", "1")

from app.geolocation import resolve_all

DATA_PATH = Path(__file__).resolve().parents[1] / "data" / "simulated_reports.json"

_FLOOD_PATTERNS = (
    r"\bflood\w*",
    r"\bwater\b",
    r"\bwaterlog\w*",
    r"\brain(?:ing|fall)?\b",
    r"\bcurrent\b",
    r"\bsubmerg\w*",
)
_COLLAPSE_PATTERNS = (
    r"\bcollaps\w*",
    r"\bcrack\w*",
    r"\bdebris\b",
    r"\bfallen\b",
    r"\bgiven way\b",
    r"\bsinking\b",
)
_FIRE_PATTERNS = (r"\bfire\b", r"\bsmoke\b", r"\bblaze\b")

# Longer/more specific phrases first so e.g. "Metro Pillar 42" wins over "metro".
_KNOWN_LANDMARKS = [
    "metro pillar 42",
    "pillar 42",
    "sector 4 bridge",
    "sector 4 crossing",
    "sector 4",
    "mayur vihar phase 1",
    "mayur vihar metro",
    "mayur vihar",
    "metro market",
    "metro station",
    "school gate",
    "market underpass",
    "flyover",
    "bridge",
]

_NEAR_PATTERN = re.compile(
    r"(?:near|beside|at|by|close to)\s+(?:the\s+)?([A-Za-z0-9][\w\s\-]{2,40}?)"
    r"(?=[.,;]|$)",
    re.IGNORECASE,
)


def _placeholder_disaster_type(text: str) -> str | None:
    low = text.lower()
    if any(re.search(pattern, low) for pattern in _COLLAPSE_PATTERNS):
        return "COLLAPSE"
    if any(re.search(pattern, low) for pattern in _FIRE_PATTERNS):
        return "FIRE"
    if any(re.search(pattern, low) for pattern in _FLOOD_PATTERNS):
        return "FLOOD"
    return None


def _placeholder_landmark(text: str) -> str | None:
    low = text.lower()
    for phrase in _KNOWN_LANDMARKS:
        if phrase in low:
            return phrase
    match = _NEAR_PATTERN.search(text)
    if match:
        return match.group(1).strip()
    return None


def _placeholder_extract(report: dict) -> dict:
    """Stand-in for Chunk 3: flattens landmark/disaster_type onto the report."""
    disaster_type = _placeholder_disaster_type(report["raw_text"])
    landmark = _placeholder_landmark(report["raw_text"]) if disaster_type else None
    return {
        **report,
        "relevant": disaster_type is not None,
        "disaster_type": disaster_type,
        "landmark": landmark,
    }


def _fmt(v, nd=5):
    return f"{v:.{nd}f}" if isinstance(v, float) else "-"


def main() -> None:
    raw_reports = json.loads(DATA_PATH.read_text(encoding="utf-8"))
    reports = [_placeholder_extract(r) for r in raw_reports]

    results = resolve_all(reports)
    by_id = {r.get("id"): r for r in reports}

    header = (
        f"{'report_id':<10} {'method':<18} {'conf':>5} "
        f"{'lat':>10} {'lng':>10} {'radius_m':>9}  landmark"
    )
    print(header)
    print("-" * len(header))

    counts: dict[str, int] = {}
    for res in results:
        counts[res.resolution_method] = counts.get(res.resolution_method, 0) + 1
        landmark = by_id[res.report_id].get("landmark") or ""
        print(
            f"{res.report_id:<10} {res.resolution_method:<18} "
            f"{res.confidence:>5.2f} {_fmt(res.lat):>10} {_fmt(res.lng):>10} "
            f"{_fmt(res.uncertainty_radius_meters, 0):>9}  {landmark}"
        )

    print("-" * len(header))
    print("Totals:", counts)

    print("\nReports with no GPS and no landmark match (the vague/missing-location")
    print("cases this pipeline needs to degrade gracefully on):")
    for res in results:
        report = by_id[res.report_id]
        if report.get("gps_lat") is None and not report.get("landmark"):
            print(
                f"  {res.report_id}: method={res.resolution_method} "
                f"conf={res.confidence:.2f} "
                f"pin={_fmt(res.lat)},{_fmt(res.lng)} "
                f"radius={_fmt(res.uncertainty_radius_meters, 0)}m"
                f' | "{report["raw_text"][:70]}..."'
            )


if __name__ == "__main__":
    main()

# ---------------------------------------------------------------------------
# Chunk 3 integration notes
# ---------------------------------------------------------------------------
# When app.extraction.process_reports(...) is actually run (needs an OpenAI
# client + API key), replace `_placeholder_extract` above with:
#
#     def _from_chunk3(report: dict, extracted_json: dict) -> dict:
#         return {
#             **report,
#             "disaster_type": extracted_json.get("disaster_type"),
#             "landmark": extracted_json.get("landmark"),
#         }
#
# i.e. pull extracted_json["disaster_type"] / ["landmark"] straight off each
# processed report (or off the `reports.extracted_json` DB column) and flatten
# them onto the dict passed to resolve_location/resolve_all. No other change
# needed - app/geolocation.py never imports app.extraction and doesn't care
# how those two fields were produced.
#
# Assumptions this module makes about extracted_json's shape (per Chunk 3's
# current ExtractedReport model in app/extraction.py):
#   - landmark: str | None - a raw, possibly vague, location phrase, not a
#     normalized address. Empty/whitespace-only is treated the same as null.
#   - disaster_type: one of "FLOOD" | "FIRE" | "COLLAPSE" | "OTHER" | None.
#     None (irrelevant report) intentionally disables nearby_inference for
#     that report - we don't want off-topic chatter inheriting a real
#     incident's pin just because it landed nearby in time.
# If Chunk 3's landmark field ever starts returning multiple candidate
# landmarks (e.g. a list) or a confidence score of its own, geolocation.py's
# `resolve_location` will need a small update to consume that - currently it
# expects a single string.
