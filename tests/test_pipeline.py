"""Offline contract test across the completed processing chunks."""

from app import geolocation
from app.cluster import cluster_reports
from app.corroboration import calculate_corroboration
from app.geolocation import resolve_all
from app.scoring import (
    aggregate_victim_count,
    calculate_confidence,
    calculate_severity,
    get_action_priority,
)


def extracted(trapped_count):
    return {
        "relevant": True,
        "disaster_type": "FLOOD",
        "claim": "Floodwater is blocking movement near Metro Pillar 42.",
        "landmark": "Metro Pillar 42",
        "trapped_count": trapped_count,
        "resource_demands": ["rescue_boat"],
        "access_impediment": True,
        "severity": 8,
        "event_time_hint": None,
    }


def test_completed_chunks_share_a_working_report_contract(monkeypatch):
    monkeypatch.setattr(geolocation, "NOMINATIM_DISABLED", True)
    monkeypatch.setattr(geolocation, "_save_cache", lambda _cache: None)
    geolocation._CACHE.clear()
    reports = [
        {
            "id": "rep_1",
            "source_user": "@source_1",
            "raw_text": "Three people trapped near Pillar 42.",
            "media_url": "media/flood_scene_1.jpg",
            "timestamp": "2026-09-11T14:00:00+05:30",
            "gps_lat": 28.6083,
            "gps_lon": 77.2952,
            "extracted_json": extracted(3),
        },
        {
            "id": "rep_2",
            "source_user": "@source_2",
            "raw_text": "Five people waiting for rescue near Pillar 42.",
            "media_url": None,
            "timestamp": "2026-09-11T14:05:00+05:30",
            "gps_lat": 28.6085,
            "gps_lon": 77.2952,
            "extracted_json": extracted(5),
        },
        {
            "id": "rep_3",
            "source_user": "@source_3",
            "raw_text": "Floodwater is blocking the metro lane.",
            "media_url": None,
            "timestamp": "2026-09-11T14:08:00+05:30",
            "gps_lat": None,
            "gps_lon": None,
            "extracted_json": extracted(None),
        },
    ]

    locations = resolve_all(reports)
    geolocated = [
        result.to_report(report) for result, report in zip(locations, reports)
    ]
    resolved = [report for report in geolocated if report["resolved_lat"] is not None]
    clusters = cluster_reports(resolved)

    assert len(clusters) == 1
    assert clusters[0]["report_ids"] == ["rep_1", "rep_2", "rep_3"]
    evidence = calculate_corroboration(
        clusters[0], resolved, {"rep_1": "0000000000000000"}
    )
    evidence.update(
        {
            "geo_agreement": 1.0,
            "fresh_media_ratio": 1.0,
            "external_verification_hits": 3,
            "has_contradiction": False,
        }
    )
    confidence = calculate_confidence(evidence)
    severity = max(calculate_severity(report["extracted_json"]) for report in resolved)
    victims = aggregate_victim_count(resolved)

    assert evidence["independent_sources"] == 3
    assert victims == {"estimated_trapped_total": 5, "confirmed_by_sources": 2}
    assert confidence == 88.0
    assert severity >= 7
    assert get_action_priority(confidence, severity) == "CRITICAL_DISPATCH"
