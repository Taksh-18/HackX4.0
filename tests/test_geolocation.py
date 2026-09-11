from datetime import UTC, datetime

import pytest

from app import geolocation
from app.geolocation import resolve_all, resolve_location


@pytest.fixture(autouse=True)
def offline_geocoder(monkeypatch):
    monkeypatch.setattr(geolocation, "NOMINATIM_DISABLED", True)
    monkeypatch.setattr(geolocation, "_save_cache", lambda _cache: None)
    geolocation._CACHE.clear()


def report(report_id, **changes):
    return {
        "id": report_id,
        "timestamp": "2026-09-11T14:00:00+05:30",
        "gps_lat": None,
        "gps_lon": None,
        "extracted_json": {
            "relevant": True,
            "disaster_type": "FLOOD",
            "landmark": None,
        },
        **changes,
    }


def test_nested_extraction_gps_and_cluster_adapter():
    original = report("rep_1", gps_lat=28.6083, gps_lon=77.2952)
    result = resolve_location(original)
    adapted = result.to_report(original)

    assert result.resolution_method == "gps"
    assert adapted["resolved_lat"] == 28.6083
    assert adapted["resolved_lon"] == 77.2952
    assert adapted["uncertainty_radius_m"] == 15.0
    assert adapted["extracted_json"] is original["extracted_json"]
    assert "resolved_lat" not in original


def test_irrelevant_report_does_not_use_its_gps():
    item = report(
        "noise",
        gps_lat=28.6083,
        gps_lon=77.2952,
        extracted_json={"relevant": False, "disaster_type": None, "landmark": None},
    )
    result = resolve_location(item)
    assert result.resolution_method == "unresolved"
    assert result.detail == "irrelevant_report"


def test_offline_landmark_resolution_uses_specific_match():
    item = report(
        "landmark",
        extracted_json={
            "relevant": True,
            "disaster_type": "FLOOD",
            "landmark": "near Mayur Vihar metro",
        },
    )
    result = resolve_location(item)
    assert result.resolution_method == "landmark_geocode"
    assert result.uncertainty_radius_meters == 90.0


def test_nearby_inference_handles_naive_and_aware_times():
    reports = [
        report("gps_1", gps_lat=28.6083, gps_lon=77.2952),
        report(
            "gps_2",
            gps_lat=28.6085,
            gps_lon=77.2952,
            timestamp=datetime(2026, 9, 11, 8, 35, tzinfo=UTC),
        ),
        report("vague", timestamp=datetime(2026, 9, 11, 8, 40)),
    ]
    result = {item.report_id: item for item in resolve_all(reports)}["vague"]
    assert result.resolution_method == "nearby_inference"
    assert result.uncertainty_radius_meters >= 150.0


def test_distant_direct_pin_does_not_poison_tight_neighbor_group():
    reports = [
        report("gps_1", gps_lat=28.6083, gps_lon=77.2952),
        report("gps_2", gps_lat=28.6085, gps_lon=77.2952),
        report("outlier", gps_lat=28.62, gps_lon=77.31),
        report("vague"),
    ]
    result = {item.report_id: item for item in resolve_all(reports)}["vague"]
    assert result.resolution_method == "nearby_inference"
    assert result.lat == pytest.approx(28.6084)


def test_nearby_inference_does_not_cross_event_types():
    fire = {"relevant": True, "disaster_type": "FIRE", "landmark": None}
    reports = [
        report("gps_1", gps_lat=28.6083, gps_lon=77.2952),
        report("gps_2", gps_lat=28.6085, gps_lon=77.2952),
        report("vague", extracted_json=fire),
    ]
    result = {item.report_id: item for item in resolve_all(reports)}["vague"]
    assert result.resolution_method == "unresolved"


def test_duplicate_ids_are_rejected():
    with pytest.raises(ValueError, match="Duplicate report id"):
        resolve_all([report("same"), report("same")])
