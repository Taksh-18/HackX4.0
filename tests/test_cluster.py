from math import isclose, sqrt

import pytest

from app.cluster import cluster_reports, haversine


def report(
    report_id,
    *,
    lat=28.6083,
    lon=77.2952,
    time="2026-09-11T10:00:00Z",
    event="FLOOD",
    radius=200,
):
    return {
        "id": report_id,
        "extracted_json": {"disaster_type": event},
        "resolved_lat": lat,
        "resolved_lon": lon,
        "uncertainty_radius_m": radius,
        "timestamp": time,
    }


def test_haversine_and_merge_rules():
    assert haversine(28.6083, 77.2952, 28.6083, 77.2952) == 0
    assert isclose(haversine(0, 0, 0, 1), 111_195.08, abs_tol=0.1)

    inputs = [
        report("near_1"),
        report("near_2", lat=28.6101, time="2026-09-11T10:05:00Z"),
        report("far", lat=28.6533, time="2026-09-11T10:07:00Z"),
        report("wrong_type", lat=28.6084, event="FIRE"),
    ]
    clusters = cluster_reports(list(reversed(inputs)))
    assert len(clusters) == 3
    assert clusters[0]["report_ids"] == ["near_1", "near_2"]
    assert isclose(clusters[0]["uncertainty_radius_m"], 200 / sqrt(2))


def test_two_hour_boundary_is_inclusive_and_sliding():
    reports = [
        report("a", time="2026-09-11T08:00:00Z", radius=60),
        report("b", time="2026-09-11T10:00:00Z", radius=60),
        report("c", time="2026-09-11T11:00:00Z", radius=60),
    ]
    cluster = cluster_reports(reports)[0]
    assert cluster["report_ids"] == ["a", "b", "c"]
    assert cluster["uncertainty_radius_m"] == 50.0
    assert (
        len(
            cluster_reports(
                [reports[0], {**reports[1], "timestamp": "2026-09-11T10:00:01Z"}]
            )
        )
        == 2
    )


@pytest.mark.parametrize(
    "changes",
    [
        {"resolved_lat": None},
        {"resolved_lat": True},
        {"resolved_lon": 181},
        {"uncertainty_radius_m": -1},
        {"timestamp": "not-a-time"},
        {"extracted_json": {"disaster_type": None}},
    ],
)
def test_invalid_or_unresolved_reports_are_rejected(changes):
    with pytest.raises(ValueError, match="Invalid report"):
        cluster_reports([{**report("bad"), **changes}])
