"""Deterministic geographic clustering using only the Python standard library."""

from datetime import UTC, datetime, timedelta
from math import asin, cos, isfinite, radians, sin, sqrt

DISTANCE_THRESHOLD_M = 2_000.0
TIME_WINDOW = timedelta(hours=2)
MIN_RADIUS_M = 50.0
EARTH_RADIUS_M = 6_371_008.8


def _coordinate(value, minimum: float, maximum: float) -> float:
    if isinstance(value, bool):
        raise ValueError("coordinates must be finite numbers, not booleans")
    value = float(value)
    if not isfinite(value) or not minimum <= value <= maximum:
        raise ValueError("coordinates are non-finite or out of range")
    return value


def haversine(lat1, lon1, lat2, lon2) -> float:
    """Return great-circle distance in meters; reject invalid coordinates."""
    lat1, lat2 = (_coordinate(lat, -90, 90) for lat in (lat1, lat2))
    lon1, lon2 = (_coordinate(lon, -180, 180) for lon in (lon1, lon2))
    phi1, phi2 = radians(lat1), radians(lat2)
    delta_phi = phi2 - phi1
    delta_lambda = radians(lon2 - lon1)
    a = sin(delta_phi / 2) ** 2 + cos(phi1) * cos(phi2) * sin(delta_lambda / 2) ** 2
    return 2 * EARTH_RADIUS_M * asin(sqrt(max(0.0, min(1.0, a))))


def _timestamp(value) -> datetime:
    """Parse ISO8601 or datetime values; interpret naive timestamps as UTC."""
    value = datetime.fromisoformat(value) if isinstance(value, str) else value
    if not isinstance(value, datetime):
        raise ValueError("timestamp must be an ISO8601 string or datetime")
    if value.tzinfo is None:
        value = value.replace(tzinfo=UTC)
    return value.astimezone(UTC)


def cluster_reports(reports: list[dict]) -> list[dict]:
    """Cluster resolved reports without modifying the input.

    Process by UTC timestamp, then report ID, independently of input order.
    Compare distance to each cluster's current centroid and time to its latest
    report. This is an inactivity-based sliding window: a continuing incident
    may span more than two hours if successive reports remain within the window.
    Pick the nearest eligible cluster; break distance ties by cluster creation
    order. IDs are deterministic for the same batch, not stable across batches.

    Inputs must have unique string IDs, finite resolved coordinates, nonnegative
    uncertainty, a timestamp, and a nonempty disaster_type. Invalid input raises
    ValueError; unresolved/noise reports should be filtered before this function.
    """
    prepared = []
    seen_ids = set()
    for report in reports:
        try:
            report_id = report["id"]
            event_type = report["extracted_json"]["disaster_type"]
            lat = _coordinate(report["resolved_lat"], -90, 90)
            lon = _coordinate(report["resolved_lon"], -180, 180)
            if isinstance(report["uncertainty_radius_m"], bool):
                raise ValueError("uncertainty must be a number, not a boolean")
            radius = float(report["uncertainty_radius_m"])
            time = _timestamp(report["timestamp"])
            if not isinstance(report_id, str) or not report_id.strip():
                raise ValueError("id must be a nonempty string")
            if report_id in seen_ids:
                raise ValueError(f"duplicate report id: {report_id}")
            if not isinstance(event_type, str) or not event_type.strip():
                raise ValueError("disaster_type must be a nonempty string")
            if not all(isfinite(v) for v in (lat, lon, radius)):
                raise ValueError("coordinates and uncertainty must be finite")
            if not (-90 <= lat <= 90 and -180 <= lon <= 180 and radius >= 0):
                raise ValueError("invalid coordinates or negative uncertainty")
        except (KeyError, TypeError, ValueError, OverflowError) as exc:
            raise ValueError(f"Invalid report at index {len(prepared)}: {exc}") from exc
        seen_ids.add(report_id)
        prepared.append((time, report_id, event_type, lat, lon, radius))

    prepared.sort(key=lambda item: (item[0], item[1]))
    clusters = []
    for time, report_id, event_type, lat, lon, radius in prepared:
        best = None
        best_distance = float("inf")
        for cluster in clusters:
            if cluster["event_type"] != event_type:
                continue
            if time - cluster["latest_time"] > TIME_WINDOW:
                continue
            distance = haversine(lat, lon, cluster["center_lat"], cluster["center_lon"])
            if distance <= DISTANCE_THRESHOLD_M and distance < best_distance:
                best, best_distance = cluster, distance

        if best is None:
            best = {
                "cluster_id": f"CLU_{len(clusters) + 1:04d}",
                "report_ids": [],
                "event_type": event_type,
                "center_lat": lat,
                "center_lon": lon,
                "uncertainty_radius_m": MIN_RADIUS_M,
                "lat_sum": 0.0,
                "lon_sum": 0.0,
                "lon_reference": lon,
                "max_radius": 0.0,
                "latest_time": time,
            }
            clusters.append(best)

        best["report_ids"].append(report_id)
        best["lat_sum"] += lat
        # Unwrap around the first longitude so a cluster straddling +/-180
        # keeps its centroid near the dateline rather than jumping to zero.
        reference = best["lon_reference"]
        best["lon_sum"] += reference + (lon - reference + 180.0) % 360.0 - 180.0
        best["max_radius"] = max(best["max_radius"], radius)
        best["latest_time"] = time
        count = len(best["report_ids"])
        best["center_lat"] = best["lat_sum"] / count
        best["center_lon"] = (best["lon_sum"] / count + 180.0) % 360.0 - 180.0
        best["uncertainty_radius_m"] = max(
            MIN_RADIUS_M, best["max_radius"] / sqrt(count)
        )

    fields = (
        "cluster_id",
        "report_ids",
        "event_type",
        "center_lat",
        "center_lon",
        "uncertainty_radius_m",
    )
    return [{key: cluster[key] for key in fields} for cluster in clusters]


if __name__ == "__main__":
    examples = [
        {
            "id": "rep_0001",
            "extracted_json": {"disaster_type": "FLOOD", "landmark": "Pillar 42"},
            "resolved_lat": 28.6083,
            "resolved_lon": 77.2952,
            "uncertainty_radius_m": 200.0,
            "timestamp": "2026-09-11T14:00:00+05:30",
        },
        {
            "id": "rep_0002",
            "extracted_json": {"disaster_type": "FLOOD", "landmark": "Metro lane"},
            "resolved_lat": 28.6101,  # About 200 m north of report 1.
            "resolved_lon": 77.2952,
            "uncertainty_radius_m": 200.0,
            "timestamp": "2026-09-11T14:05:00+05:30",
        },
        {
            "id": "rep_0003",
            "extracted_json": {"disaster_type": "FLOOD", "landmark": "Other market"},
            "resolved_lat": 28.6533,  # About 5 km north; same type tests distance.
            "resolved_lon": 77.2952,
            "uncertainty_radius_m": 150.0,
            "timestamp": "2026-09-11T14:07:00+05:30",
        },
    ]
    result = cluster_reports(examples)
    assert len(result) == 2
    assert result[0]["report_ids"] == ["rep_0001", "rep_0002"]
    assert result[1]["report_ids"] == ["rep_0003"]
    for incident in result:
        print(incident)
