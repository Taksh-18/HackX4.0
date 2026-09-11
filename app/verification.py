"""Optional external verification lookups.

This is the last stage wired into confidence scoring, added only after the
core pipeline (extraction -> geolocation -> clustering -> corroboration ->
scoring) already works end to end. It queries an external feed for hits that
corroborate a cluster's claimed hazard near a landmark - an official
disaster feed, a news search API, anything reachable over HTTP that returns
`{"hits": <int>}`.

The feature is opt-in (unset `CDIS_VERIFICATION_URL` disables it outright) and
every failure mode - disabled, unreachable, slow, malformed response - must
degrade to "no signal" rather than break the pipeline. `calculate_confidence`
already treats a `None` `external_verification_hits` as contributing zero,
which is exactly what an unverifiable claim deserves: neither corroborated
nor penalized.
"""

from __future__ import annotations

import json
import logging
import os
import urllib.error
import urllib.parse
import urllib.request

logger = logging.getLogger(__name__)

VERIFICATION_URL = os.getenv("CDIS_VERIFICATION_URL", "").strip()
VERIFICATION_TIMEOUT_S = float(os.getenv("CDIS_VERIFICATION_TIMEOUT_S", "3.0"))
MAX_HITS = 3


def verification_enabled() -> bool:
    """The feature is off unless an endpoint is explicitly configured."""
    return bool(VERIFICATION_URL)


def check_external_verification(event_type: str, landmark: str | None) -> int | None:
    """Return 0-`MAX_HITS` corroborating hits from the external feed, or None.

    None means "no signal available." That covers the feature being disabled,
    a missing landmark to query, a network error, a timeout, a non-200
    response, and a response that isn't the expected shape - every one of
    those is handled here so a caller never has to distinguish "verification
    said no" from "verification could not be reached."
    """
    if not verification_enabled() or not landmark:
        return None

    query = urllib.parse.urlencode({"event_type": event_type, "landmark": landmark})
    url = f"{VERIFICATION_URL}?{query}"
    try:
        request = urllib.request.Request(url, headers={"Accept": "application/json"})
        with urllib.request.urlopen(request, timeout=VERIFICATION_TIMEOUT_S) as resp:
            if resp.status != 200:
                raise ValueError(f"unexpected status {resp.status}")
            payload = json.loads(resp.read().decode("utf-8"))
        hits = payload.get("hits") if isinstance(payload, dict) else None
        if not isinstance(hits, int) or isinstance(hits, bool) or hits < 0:
            raise ValueError("malformed verification response")
        return min(hits, MAX_HITS)
    except (
        urllib.error.URLError,
        urllib.error.HTTPError,
        TimeoutError,
        ValueError,
        json.JSONDecodeError,
        OSError,
    ) as exc:
        logger.info(
            "External verification unavailable for %s near %s (%s)",
            event_type,
            landmark,
            type(exc).__name__,
        )
        return None
