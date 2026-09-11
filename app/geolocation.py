"""Chunk 4: multi-signal location resolution for CDIS reports.

Resolves a (lat, lng, uncertainty_radius_meters, confidence) pin for a report
using, in order:

  1. gps              - device GPS on the report itself.
  2. landmark_geocode  - geocode a free-text landmark via a local gazetteer,
                         falling back to live Nominatim (OpenStreetMap).
  3. nearby_inference  - inherit an approximate location from already-resolved
                         sibling reports of the same disaster type, close in
                         time and tightly clustered in space.
  4. unresolved        - none of the above produced trustworthy evidence.

Input contract
--------------
`resolve_location` / `resolve_all` take plain dicts, intentionally decoupled
from the Chunk 1 DB schema and Chunk 3 extraction schema:

    {
        "id": str,
        "gps_lat": float | None,
        "gps_lon": float | None,
        "landmark": str | None,        # flattened extracted_json.landmark
        "disaster_type": str | None,   # flattened extracted_json.disaster_type
        "timestamp": str | datetime | None,
    }

See scripts/geolocation_smoke_test.py for how this is built from raw Chunk 2
reports today, and the "Chunk 3 integration" notes in that script for what
changes once real extraction is wired in.
"""

from __future__ import annotations

import json
import logging
import math
import os
import time
import urllib.error
import urllib.parse
import urllib.request
from dataclasses import dataclass
from datetime import datetime, timedelta
from pathlib import Path
from typing import Any, Literal

logger = logging.getLogger(__name__)

ResolutionMethod = Literal["gps", "landmark_geocode", "nearby_inference", "unresolved"]

# ---------------------------------------------------------------------------
# Tunables
# ---------------------------------------------------------------------------

GPS_UNCERTAINTY_M = 15.0
GPS_CONFIDENCE = 0.97

NOMINATIM_URL = "https://nominatim.openstreetmap.org/search"
NOMINATIM_TIMEOUT_S = 4.0
NOMINATIM_MIN_INTERVAL_S = 1.0  # Nominatim usage policy: max ~1 request/sec.
# Set CDIS_OFFLINE_GEOCODE=1 to skip the network entirely (demo safety valve).
NOMINATIM_DISABLED = os.getenv("CDIS_OFFLINE_GEOCODE", "").strip().lower() in (
    "1",
    "true",
    "yes",
)

LOCALITY_BIAS = "Mayur Vihar Phase 1, Delhi, India"
# lon_min,lat_max,lon_max,lat_min - a box around the incident area, used to
# stop Nominatim from matching a same-named place in a different city.
VIEWBOX = "77.27,28.63,77.33,28.58"

MAX_ACCEPTABLE_LANDMARK_RADIUS_M = 1500.0

NEARBY_TIME_WINDOW = timedelta(minutes=20)
NEARBY_MAX_CLUSTER_SPREAD_M = 120.0
NEARBY_MIN_SAMPLES = 2

GEOCODE_CACHE_PATH = (
    Path(__file__).resolve().parents[1] / "data" / "geocode_cache.json"
)

# Curated from a live Nominatim lookup during development (see PR/commit notes),
# not hand-guessed - covers the small set of *real* named places this scenario
# is anchored to. Deliberately does NOT include the dataset's fictional
# hyper-local landmarks ("Metro Pillar 42", "Sector 4 bridge"): those aren't
# real OSM entities, so fabricating coordinates for them would be exactly the
# fake precision this module must avoid. Those are meant to be resolved via
# nearby_inference instead.
OFFLINE_GAZETTEER: list[tuple[str, float, float, float]] = [
    ("mayur vihar phase 1", 28.6098555, 77.2926318, 500.0),
    ("mayur vihar phase-1", 28.6098555, 77.2926318, 500.0),
    ("mayur vihar", 28.6098555, 77.2926318, 600.0),
    ("mayur vihar metro", 28.6038, 77.2900, 90.0),
    ("mayur vihar-i", 28.6038, 77.2900, 90.0),
]

_CLASS_RADIUS_FLOOR_M = {
    "railway": 80.0,
    "highway": 60.0,
    "bridge": 60.0,
    "amenity": 40.0,
    "shop": 40.0,
    "building": 25.0,
}


@dataclass
class LocationResult:
    report_id: str
    lat: float | None
    lng: float | None
    uncertainty_radius_meters: float | None
    resolution_method: ResolutionMethod
    confidence: float
    detail: str = ""

    def to_dict(self) -> dict[str, Any]:
        return {
            "report_id": self.report_id,
            "lat": self.lat,
            "lng": self.lng,
            "uncertainty_radius_meters": self.uncertainty_radius_meters,
            "resolution_method": self.resolution_method,
            "confidence": self.confidence,
            "detail": self.detail,
        }


def _unresolved(report_id: str, detail: str = "") -> LocationResult:
    return LocationResult(
        report_id=report_id,
        lat=None,
        lng=None,
        uncertainty_radius_meters=None,
        resolution_method="unresolved",
        confidence=0.0,
        detail=detail,
    )


# ---------------------------------------------------------------------------
# Geometry helpers
# ---------------------------------------------------------------------------


def _haversine_m(lat1: float, lon1: float, lat2: float, lon2: float) -> float:
    r = 6371000.0
    phi1, phi2 = math.radians(lat1), math.radians(lat2)
    dphi = math.radians(lat2 - lat1)
    dlambda = math.radians(lon2 - lon1)
    a = (
        math.sin(dphi / 2) ** 2
        + math.cos(phi1) * math.cos(phi2) * math.sin(dlambda / 2) ** 2
    )
    return 2 * r * math.asin(min(1.0, math.sqrt(a)))


# ---------------------------------------------------------------------------
# Geocode cache
# ---------------------------------------------------------------------------


def _load_cache() -> dict[str, dict | None]:
    try:
        with GEOCODE_CACHE_PATH.open("r", encoding="utf-8") as f:
            return json.load(f)
    except (FileNotFoundError, json.JSONDecodeError):
        return {}


def _save_cache(cache: dict[str, dict | None]) -> None:
    try:
        GEOCODE_CACHE_PATH.parent.mkdir(parents=True, exist_ok=True)
        with GEOCODE_CACHE_PATH.open("w", encoding="utf-8") as f:
            json.dump(cache, f, indent=2, sort_keys=True)
    except OSError:
        logger.warning("Could not persist geocode cache to %s", GEOCODE_CACHE_PATH)


_CACHE: dict[str, dict | None] = _load_cache()
_last_nominatim_call = 0.0


def _normalize_landmark(text: str) -> str:
    return " ".join(text.strip().lower().split())


# ---------------------------------------------------------------------------
# Landmark geocoding
# ---------------------------------------------------------------------------


def _radius_from_place_rank(rank: int) -> float | None:
    if rank >= 28:
        return 30.0
    if rank >= 25:
        return 70.0
    if rank >= 21:
        return 180.0
    if rank >= 17:
        return 500.0
    if rank >= 14:
        return 1200.0
    return None  # city/state/country level - too coarse to be a usable pin


def _bbox_radius_m(bbox: list[str]) -> float:
    try:
        lat_min, lat_max, lon_min, lon_max = (float(x) for x in bbox)
        diagonal = _haversine_m(lat_min, lon_min, lat_max, lon_max)
        return diagonal / 2
    except (ValueError, TypeError):
        return 0.0


def _query_offline_gazetteer(query: str) -> dict | None:
    # Longest matching needle wins, so "mayur vihar metro" (specific, tight
    # radius) isn't shadowed by the broader "mayur vihar" entry.
    matches = [
        (needle, lat, lng, radius_m)
        for needle, lat, lng, radius_m in OFFLINE_GAZETTEER
        if needle in query
    ]
    if not matches:
        return None
    needle, lat, lng, radius_m = max(matches, key=lambda m: len(m[0]))
    return {
        "lat": lat,
        "lng": lng,
        "radius_m": radius_m,
        "source": "offline_gazetteer",
        "detail": f"gazetteer:{needle}",
    }


def _query_nominatim(query: str) -> tuple[dict | None, bool]:
    """Returns (hit_or_None, cacheable).

    cacheable=False means the lookup didn't actually complete (network error,
    timeout, or geocoding disabled) - that must not be remembered as a
    permanent "this landmark doesn't exist", or a transient network hiccup
    during a demo would poison the cache for the rest of it.
    """
    if NOMINATIM_DISABLED:
        return None, False

    global _last_nominatim_call
    wait = NOMINATIM_MIN_INTERVAL_S - (time.monotonic() - _last_nominatim_call)
    if wait > 0:
        time.sleep(wait)

    params = {
        "q": f"{query}, {LOCALITY_BIAS}",
        "format": "json",
        "limit": "1",
        "addressdetails": "0",
        "viewbox": VIEWBOX,
        "bounded": "1",
    }
    url = f"{NOMINATIM_URL}?{urllib.parse.urlencode(params)}"
    req = urllib.request.Request(
        url,
        headers={
            # Required by Nominatim's usage policy: a descriptive UA, no PII.
            "User-Agent": "CDIS-HackX4-Geolocation/1.0 (hackathon demo)"
        },
    )

    try:
        with urllib.request.urlopen(req, timeout=NOMINATIM_TIMEOUT_S) as resp:
            results = json.loads(resp.read().decode("utf-8"))
    except (urllib.error.URLError, TimeoutError, json.JSONDecodeError, OSError) as e:
        logger.warning("Nominatim lookup failed for %r: %s", query, e)
        return None, False
    finally:
        _last_nominatim_call = time.monotonic()

    if not results:
        return None, True  # Nominatim answered: genuinely nothing there

    hit = results[0]
    try:
        rank = int(hit.get("place_rank", 0))
        cls = hit.get("class", "")
        lat = float(hit["lat"])
        lng = float(hit["lon"])
    except (KeyError, ValueError, TypeError):
        return None, True

    base_radius = _radius_from_place_rank(rank)
    if base_radius is None:
        return None, True  # too coarse (city/state/country) - reject, don't fake it

    radius_m = max(base_radius, _CLASS_RADIUS_FLOOR_M.get(cls, 0.0))
    radius_m = max(radius_m, _bbox_radius_m(hit.get("boundingbox", [])))

    if radius_m > MAX_ACCEPTABLE_LANDMARK_RADIUS_M:
        return None, True

    return {
        "lat": lat,
        "lng": lng,
        "radius_m": radius_m,
        "source": "nominatim",
        "detail": f"nominatim:class={cls},rank={rank}",
    }, True


def _confidence_for_landmark(radius_m: float) -> float:
    if radius_m <= 40:
        return 0.85
    if radius_m <= 100:
        return 0.7
    if radius_m <= 300:
        return 0.55
    if radius_m <= 800:
        return 0.4
    return 0.25


def geocode_landmark(landmark: str) -> dict | None:
    """Resolve free-text landmark -> {lat, lng, radius_m, source, detail}.

    Checks the cache, then the offline gazetteer, then live Nominatim.
    Returns None if nothing usable was found (caller should fall through
    to nearby_inference / unresolved rather than guess).
    """
    query = _normalize_landmark(landmark)
    if not query:
        return None

    if query in _CACHE:
        return _CACHE[query]

    hit = _query_offline_gazetteer(query)
    if hit is not None:
        _CACHE[query] = hit
        _save_cache(_CACHE)
        return hit

    hit, cacheable = _query_nominatim(query)
    if cacheable:
        _CACHE[query] = hit
        _save_cache(_CACHE)
    return hit


# ---------------------------------------------------------------------------
# Direct resolution (GPS + landmark) - usable standalone, per report
# ---------------------------------------------------------------------------


def _valid_gps(lat: Any, lon: Any) -> bool:
    try:
        return -90.0 <= float(lat) <= 90.0 and -180.0 <= float(lon) <= 180.0
    except (TypeError, ValueError):
        return False


def resolve_location(report: dict) -> LocationResult:
    """Resolve a single report using GPS or landmark geocoding only.

    Does not attempt nearby_inference (method 3), since that requires
    sibling reports - use `resolve_all` for the full pipeline.
    """
    report_id = report.get("id", "<unknown>")
    lat, lon = report.get("gps_lat"), report.get("gps_lon")

    if _valid_gps(lat, lon):
        return LocationResult(
            report_id=report_id,
            lat=float(lat),
            lng=float(lon),
            uncertainty_radius_meters=GPS_UNCERTAINTY_M,
            resolution_method="gps",
            confidence=GPS_CONFIDENCE,
            detail="device_gps",
        )

    landmark = (report.get("landmark") or "").strip()
    if landmark:
        hit = geocode_landmark(landmark)
        if hit is not None:
            return LocationResult(
                report_id=report_id,
                lat=hit["lat"],
                lng=hit["lng"],
                uncertainty_radius_meters=hit["radius_m"],
                resolution_method="landmark_geocode",
                confidence=_confidence_for_landmark(hit["radius_m"]),
                detail=hit["detail"],
            )

    return _unresolved(report_id, detail="no_gps_no_landmark_match")


# ---------------------------------------------------------------------------
# Nearby inference (method 3) + full batch pipeline
# ---------------------------------------------------------------------------


def _parse_timestamp(value: Any) -> datetime | None:
    if isinstance(value, datetime):
        return value
    if isinstance(value, str):
        try:
            return datetime.fromisoformat(value)
        except ValueError:
            return None
    return None


def _infer_from_neighbors(
    report: dict, resolved: dict[str, tuple[LocationResult, dict]]
) -> LocationResult:
    report_id = report.get("id", "<unknown>")
    disaster_type = report.get("disaster_type")
    ts = _parse_timestamp(report.get("timestamp"))

    if not disaster_type or ts is None:
        return _unresolved(report_id, detail="no_disaster_type_or_timestamp")

    candidates: list[LocationResult] = []
    for other_id, (other_result, other_report) in resolved.items():
        if other_id == report_id:
            continue
        if other_result.resolution_method not in ("gps", "landmark_geocode"):
            continue  # only inherit from direct evidence, never chain inferences
        if other_report.get("disaster_type") != disaster_type:
            continue
        other_ts = _parse_timestamp(other_report.get("timestamp"))
        if other_ts is None or abs(other_ts - ts) > NEARBY_TIME_WINDOW:
            continue
        candidates.append(other_result)

    if len(candidates) < NEARBY_MIN_SAMPLES:
        return _unresolved(report_id, detail=f"only_{len(candidates)}_neighbors")

    centroid_lat = sum(c.lat for c in candidates) / len(candidates)
    centroid_lng = sum(c.lng for c in candidates) / len(candidates)
    spread_m = max(
        _haversine_m(c.lat, c.lng, centroid_lat, centroid_lng) for c in candidates
    )

    if spread_m > NEARBY_MAX_CLUSTER_SPREAD_M:
        return _unresolved(
            report_id, detail=f"neighbors_too_scattered_spread={spread_m:.0f}m"
        )

    # Always inflate beyond the observed spread: this is inherited, not observed.
    radius_m = max(150.0, spread_m * 1.5 + 60.0)
    confidence = max(0.15, min(0.45, 0.15 + 0.05 * len(candidates)))

    return LocationResult(
        report_id=report_id,
        lat=centroid_lat,
        lng=centroid_lng,
        uncertainty_radius_meters=radius_m,
        resolution_method="nearby_inference",
        confidence=confidence,
        detail=f"nearby:n={len(candidates)},spread={spread_m:.0f}m",
    )


def resolve_all(reports: list[dict]) -> list[LocationResult]:
    """Full pipeline: GPS/landmark first, then nearby_inference for the rest.

    Two passes so method 3 only ever inherits from direct evidence (gps or
    landmark_geocode), never from another inference - keeps this idempotent
    and avoids compounding uncertainty across chained guesses.
    """
    pass1: dict[str, tuple[LocationResult, dict]] = {}
    for report in reports:
        result = resolve_location(report)
        pass1[report.get("id", "<unknown>")] = (result, report)

    final: list[LocationResult] = []
    for report in reports:
        report_id = report.get("id", "<unknown>")
        result, _ = pass1[report_id]
        if result.resolution_method != "unresolved":
            final.append(result)
        else:
            final.append(_infer_from_neighbors(report, pass1))

    return final
