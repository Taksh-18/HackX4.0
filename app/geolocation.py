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
`resolve_location` / `resolve_all` accept reports with extracted_json directly,
or the original flattened input shape:

    {
        "id": str,
        "gps_lat": float | None,
        "gps_lon": float | None,
        "landmark": str | None,        # flattened extracted_json.landmark
        "disaster_type": str | None,   # flattened extracted_json.disaster_type
        "timestamp": str | datetime | None,
    }

Use result.to_report(original_report) to add the resolved_lat, resolved_lon,
and uncertainty_radius_m fields consumed by clustering. Exclude unresolved
results before clustering. Inference is an approximate fallback, not a claim
that the report's actual location has been established.
"""

from __future__ import annotations

import json
import logging
import math
import os
import re
import time
import urllib.error
import urllib.parse
import urllib.request
from dataclasses import dataclass
from datetime import UTC, datetime, timedelta
from pathlib import Path
from tempfile import NamedTemporaryFile
from threading import Lock
from typing import Any, Literal

logger = logging.getLogger(__name__)

ResolutionMethod = Literal["gps", "landmark_geocode", "nearby_inference", "unresolved"]

# ---------------------------------------------------------------------------
# Tunables
# ---------------------------------------------------------------------------

GPS_UNCERTAINTY_M = 15.0
GPS_CONFIDENCE = 0.97

NOMINATIM_URL = os.getenv(
    "CDIS_NOMINATIM_URL", "https://nominatim.openstreetmap.org/search"
)
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

GEOCODE_CACHE_PATH = Path(__file__).resolve().parents[1] / "data" / "geocode_cache.json"
# v1 cached unsuccessful lookups caused by requesting a format without place_rank.
GEOCODE_CACHE_VERSION = 2

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

    def to_report(self, report: dict) -> dict:
        """Return a copy with clustering fields and the original resolution detail."""
        if report.get("id") != self.report_id:
            raise ValueError("Location result and report IDs do not match")
        return {
            **report,
            "resolved_lat": self.lat,
            "resolved_lon": self.lng,
            "uncertainty_radius_m": self.uncertainty_radius_meters,
            "geolocation": self.to_dict(),
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
    return 2 * r * math.asin(math.sqrt(max(0.0, min(1.0, a))))


# ---------------------------------------------------------------------------
# Geocode cache
# ---------------------------------------------------------------------------


def _load_cache() -> dict[str, dict | None]:
    try:
        with GEOCODE_CACHE_PATH.open("r", encoding="utf-8") as f:
            payload = json.load(f)
        if (
            isinstance(payload, dict)
            and payload.get("version") == GEOCODE_CACHE_VERSION
        ):
            entries = payload.get("entries")
            if isinstance(entries, dict):
                return entries
    except FileNotFoundError:
        return {}
    except (OSError, ValueError):
        logger.warning("Could not read geocode cache at %s", GEOCODE_CACHE_PATH)
    return {}


def _save_cache(cache: dict[str, dict | None]) -> None:
    temporary_path = None
    try:
        GEOCODE_CACHE_PATH.parent.mkdir(parents=True, exist_ok=True)
        with NamedTemporaryFile(
            mode="w", encoding="utf-8", dir=GEOCODE_CACHE_PATH.parent, delete=False
        ) as f:
            temporary_path = Path(f.name)
            json.dump(
                {"version": GEOCODE_CACHE_VERSION, "entries": cache},
                f,
                indent=2,
                sort_keys=True,
                allow_nan=False,
            )
        temporary_path.replace(GEOCODE_CACHE_PATH)
    except OSError:
        logger.warning("Could not persist geocode cache to %s", GEOCODE_CACHE_PATH)
    finally:
        if temporary_path is not None:
            try:
                temporary_path.unlink(missing_ok=True)
            except OSError:
                logger.warning("Could not remove temporary geocode cache file")


_CACHE: dict[str, dict | None] = _load_cache()
_last_nominatim_call = 0.0
_nominatim_lock = Lock()


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
        if not (_valid_gps(lat_min, lon_min) and _valid_gps(lat_max, lon_max)):
            return 0.0
        if lat_min > lat_max or lon_min > lon_max:
            return 0.0
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
        if re.search(rf"(?<!\w){re.escape(needle)}(?!\w)", query)
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

    # FastAPI can call sync functions from multiple worker threads. Serialize
    # requests so the existing one-request-per-second limit holds per process.
    with _nominatim_lock:
        return _query_nominatim_serial(query)


def _query_nominatim_serial(query: str) -> tuple[dict | None, bool]:

    global _last_nominatim_call
    wait = NOMINATIM_MIN_INTERVAL_S - (time.monotonic() - _last_nominatim_call)
    if wait > 0:
        time.sleep(wait)

    params = {
        "q": f"{query}, {LOCALITY_BIAS}",
        # JSONv2 supplies place_rank; legacy JSON does not. Its category field
        # replaces class: https://nominatim.org/release-docs/latest/api/Output/
        "format": "jsonv2",
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
    except (urllib.error.URLError, TimeoutError, ValueError, OSError) as e:
        logger.warning("Nominatim lookup failed for %r: %s", query, e)
        return None, False
    finally:
        _last_nominatim_call = time.monotonic()

    if not isinstance(results, list):
        logger.warning("Nominatim returned an unexpected response for %r", query)
        return None, False
    if not results:
        return None, True  # Nominatim answered: genuinely nothing there

    hit = results[0]
    if not isinstance(hit, dict):
        return None, False
    try:
        rank = int(hit.get("place_rank", 0))
        cls = hit.get("category", hit.get("class", ""))
        lat = float(hit["lat"])
        lng = float(hit["lon"])
    except (KeyError, ValueError, TypeError):
        return None, False
    if not _valid_gps(lat, lng) or not isinstance(cls, str):
        return None, False

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
    if not isinstance(landmark, str):
        return None
    query = _normalize_landmark(landmark)
    if not query:
        return None

    if query in _CACHE:
        cached = _CACHE[query]
        if cached is None or _valid_geocode_hit(cached):
            return cached
        del _CACHE[query]  # A damaged cache entry must not crash a report batch.

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
    if isinstance(lat, bool) or isinstance(lon, bool):
        return False
    try:
        return -90.0 <= float(lat) <= 90.0 and -180.0 <= float(lon) <= 180.0
    except (TypeError, ValueError, OverflowError):
        return False


def _valid_geocode_hit(hit: Any) -> bool:
    if not isinstance(hit, dict) or not _valid_gps(hit.get("lat"), hit.get("lng")):
        return False
    radius = hit.get("radius_m")
    return (
        isinstance(radius, (int, float))
        and not isinstance(radius, bool)
        and 0 <= radius <= MAX_ACCEPTABLE_LANDMARK_RADIUS_M
        and isinstance(hit.get("detail"), str)
    )


def _fact(report: dict, key: str) -> Any:
    facts = report.get("extracted_json")
    if isinstance(facts, dict) and key in facts:
        return facts[key]
    return report.get(key)


def resolve_location(report: dict) -> LocationResult:
    """Resolve a single report using GPS or landmark geocoding only.

    Does not attempt nearby_inference (method 3), since that requires
    sibling reports - use `resolve_all` for the full pipeline.
    """
    report_id = report.get("id", "<unknown>")
    if _fact(report, "relevant") is False:
        return _unresolved(report_id, detail="irrelevant_report")
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

    landmark = _fact(report, "landmark")
    landmark = landmark.strip() if isinstance(landmark, str) else ""
    if landmark:
        hit = geocode_landmark(landmark)
        if hit is not None:
            return LocationResult(
                report_id=report_id,
                lat=float(hit["lat"]),
                lng=float(hit["lng"]),
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
    if isinstance(value, str):
        try:
            value = datetime.fromisoformat(value)
        except ValueError:
            return None
    if isinstance(value, datetime):
        if value.tzinfo is None:
            value = value.replace(tzinfo=UTC)
        return value.astimezone(UTC)
    return None


def _infer_from_neighbors(
    report: dict, resolved: dict[str, tuple[LocationResult, dict]]
) -> LocationResult:
    report_id = report.get("id", "<unknown>")
    if _fact(report, "relevant") is False:
        return _unresolved(report_id, detail="irrelevant_report")
    disaster_type = _fact(report, "disaster_type")
    ts = _parse_timestamp(report.get("timestamp"))

    if not disaster_type or ts is None:
        return _unresolved(report_id, detail="no_disaster_type_or_timestamp")

    candidates: list[LocationResult] = []
    for other_id, (other_result, other_report) in sorted(resolved.items()):
        if other_id == report_id:
            continue
        if other_result.resolution_method not in ("gps", "landmark_geocode"):
            continue  # only inherit from direct evidence, never chain inferences
        if _fact(other_report, "disaster_type") != disaster_type:
            continue
        other_ts = _parse_timestamp(other_report.get("timestamp"))
        if other_ts is None or abs(other_ts - ts) > NEARBY_TIME_WINDOW:
            continue
        candidates.append(other_result)

    if len(candidates) < NEARBY_MIN_SAMPLES:
        return _unresolved(report_id, detail=f"only_{len(candidates)}_neighbors")

    # A distant direct pin must not poison an otherwise tight group. Build a
    # candidate group around every direct pin, retain only groups whose centroid
    # spread passes the limit, then require one uniquely largest group. Equal
    # groups are ambiguous because this report has no resolved position yet.
    tight_groups: dict[frozenset[str], list[LocationResult]] = {}
    for anchor in candidates:
        nearby = [
            candidate
            for candidate in candidates
            if _haversine_m(anchor.lat, anchor.lng, candidate.lat, candidate.lng)
            <= 2 * NEARBY_MAX_CLUSTER_SPREAD_M
        ]
        if len(nearby) < NEARBY_MIN_SAMPLES:
            continue
        group_lat = sum(candidate.lat for candidate in nearby) / len(nearby)
        group_lng = sum(candidate.lng for candidate in nearby) / len(nearby)
        group_spread = max(
            _haversine_m(candidate.lat, candidate.lng, group_lat, group_lng)
            for candidate in nearby
        )
        if group_spread <= NEARBY_MAX_CLUSTER_SPREAD_M:
            tight_groups[frozenset(item.report_id for item in nearby)] = nearby

    if not tight_groups:
        return _unresolved(report_id, detail="no_tight_neighbor_group")
    largest_size = max(len(group) for group in tight_groups.values())
    largest = [group for group in tight_groups.values() if len(group) == largest_size]
    if len(largest) != 1:
        return _unresolved(report_id, detail="ambiguous_neighbor_groups")
    candidates = largest[0]

    centroid_lat = sum(c.lat for c in candidates) / len(candidates)
    centroid_lng = sum(c.lng for c in candidates) / len(candidates)
    spread_m = max(
        _haversine_m(c.lat, c.lng, centroid_lat, centroid_lng) for c in candidates
    )

    # Always inflate beyond the observed spread: this is inherited, not observed.
    radius_m = max(
        150.0,
        spread_m * 1.5 + 60.0,
        max(
            c.uncertainty_radius_meters
            + _haversine_m(c.lat, c.lng, centroid_lat, centroid_lng)
            for c in candidates
        ),
    )
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
        report_id = report.get("id")
        if not isinstance(report_id, str) or not report_id:
            raise ValueError("Each report requires a nonempty string id")
        if report_id in pass1:
            raise ValueError(f"Duplicate report id: {report_id}")
        result = resolve_location(report)
        pass1[report_id] = (result, report)

    final: list[LocationResult] = []
    for report in reports:
        report_id = report.get("id", "<unknown>")
        result, _ = pass1[report_id]
        if result.resolution_method != "unresolved":
            final.append(result)
        else:
            final.append(_infer_from_neighbors(report, pass1))

    return final
