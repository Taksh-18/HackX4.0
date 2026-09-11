import pytest

from app.scoring import (
    aggregate_victim_count,
    calculate_confidence,
    calculate_severity,
    get_action_priority,
)


def test_confidence_weights_missing_external_and_contradiction():
    evidence = {
        "independent_sources": 5,
        "geo_agreement": 0.9,
        "fresh_media_ratio": 1.0,
        "external_verification_hits": 3,
        "has_contradiction": False,
    }
    assert calculate_confidence(evidence) == 97.5
    assert calculate_confidence({**evidence, "has_contradiction": True}) == 52.5
    assert calculate_confidence({"external_verification_hits": None}) == 0.0
    assert calculate_confidence({}) == 0.0


def test_severity_priorities_and_boundaries():
    severity = calculate_severity(
        {
            "disaster_type": "FLOOD",
            "trapped_count": 3,
            "access_impediment": True,
            "resource_demands": ["rescue_boat", "medical_evac"],
        }
    )
    assert severity == 9.6
    assert get_action_priority(70, 7) == "CRITICAL_DISPATCH"
    assert get_action_priority(69.9, severity) == "DEPLOY_SCOUT"
    assert get_action_priority(70, 6.9) == "MONITOR"
    assert get_action_priority(69.9, 6.9) == "SUPPRESSED"
    with pytest.raises(ValueError):
        get_action_priority(float("nan"), severity)


def test_victim_count_uses_max_and_counts_numeric_mentions():
    reports = [
        {"extracted_json": {"trapped_count": 3}},
        {"extracted_json": {"trapped_count": 5}},
        {"extracted_json": {"trapped_count": 0}},
        {"extracted_json": {"trapped_count": None}},
    ]
    assert aggregate_victim_count(reports) == {
        "estimated_trapped_total": 5,
        "confirmed_by_sources": 3,
    }
