"""Deterministic disaster scoring. Python standard library only."""

from math import isfinite


def _number(value, default: float = 0.0) -> float:
    """Treat missing, invalid, or non-finite numeric signals as unavailable."""
    try:
        result = float(value)
    except (TypeError, ValueError, OverflowError):
        return default
    return result if isfinite(result) else default


def _clamp(value: float, low: float, high: float) -> float:
    return max(low, min(high, value))


def _source_score(independent_sources) -> float:
    """Interpolate through (0, 0), (1, 25), (3, 60), (5, 100)."""
    count = _clamp(_number(independent_sources), 0.0, 5.0)
    if count <= 1:
        return 25.0 * count
    if count <= 3:
        return 25.0 + (count - 1.0) * 17.5
    return 60.0 + (count - 3.0) * 20.0


def calculate_confidence(evidence: dict) -> float:
    """Return confidence in [0, 100]; absent numeric signals contribute zero."""
    sources = _source_score(evidence.get("independent_sources"))
    geo = 100.0 * _clamp(_number(evidence.get("geo_agreement")), 0.0, 1.0)
    media = 100.0 * _clamp(_number(evidence.get("fresh_media_ratio")), 0.0, 1.0)

    # 0/1/2/3+ external hits contribute 0/33.33/66.67/100 respectively.
    # None and a missing field both contribute zero.
    hits = _clamp(_number(evidence.get("external_verification_hits")), 0.0, 3.0)
    external = 100.0 * hits / 3.0
    penalty = 45.0 if evidence.get("has_contradiction", False) is True else 0.0

    score = 0.30 * sources + 0.25 * geo + 0.20 * media + 0.25 * external - penalty
    return float(_clamp(score, 0.0, 100.0))


def calculate_severity(extracted_facts: dict) -> float:
    """Return a 1–10 heuristic score based on this report's extracted claims."""
    # Weights:
    # Base 1; FLOOD +2, FIRE/COLLAPSE +3, OTHER +1, unknown +0.
    # A positive trapped count adds 2, plus 0.2 per person capped at another 2.
    # Access impediment +2.
    # Each distinct urgent resource +1; each other resource +0.25; total cap +2.
    # Clamp the final result to [1, 10]. Confidence is scored separately.
    hazard_weight = {"FLOOD": 2.0, "FIRE": 3.0, "COLLAPSE": 3.0, "OTHER": 1.0}
    event_type = str(extracted_facts.get("disaster_type") or "").upper()
    score = 1.0 + hazard_weight.get(event_type, 0.0)

    trapped = max(0.0, _number(extracted_facts.get("trapped_count")))
    if trapped > 0:
        score += 2.0 + min(2.0, 0.2 * trapped)
    if extracted_facts.get("access_impediment", False) is True:
        score += 2.0

    resources = {
        resource.strip().lower()
        for resource in (extracted_facts.get("resource_demands") or [])
        if isinstance(resource, str) and resource.strip()
    }
    urgent_resources = {"rescue_boat", "medical_evac", "ambulance", "fire_engine"}
    resource_score = sum(
        1.0 if resource in urgent_resources else 0.25 for resource in resources
    )
    score += min(2.0, resource_score)
    return float(_clamp(score, 1.0, 10.0))


def get_action_priority(confidence: float, severity: float) -> str:
    """Apply inclusive confidence >= 70 and severity >= 7 thresholds."""
    if severity >= 7.0:
        return "CRITICAL_DISPATCH" if confidence >= 70.0 else "DEPLOY_SCOUT"
    return "MONITOR" if confidence >= 70.0 else "SUPPRESSED"


def aggregate_victim_count(reports: list[dict]) -> dict:
    """Use the maximum count; count reports mentioning a number, including zero.

    confirmed_by_sources is a report count here, as specified. It does not
    deduplicate authors or images; independent-source evidence is separate.
    """
    maximum = 0
    mentions = 0
    for report in reports:
        facts = report.get("extracted_json") or {}
        count = facts.get("trapped_count")
        if count is None:
            continue
        if isinstance(count, bool) or not isinstance(count, int) or count < 0:
            raise ValueError("trapped_count must be a nonnegative integer or None")
        maximum = max(maximum, count)
        mentions += 1
    return {"estimated_trapped_total": maximum, "confirmed_by_sources": mentions}


if __name__ == "__main__":
    facts = {
        "disaster_type": "FLOOD",
        "trapped_count": 3,
        "access_impediment": True,
        "resource_demands": ["rescue_boat", "medical_evac"],
    }
    severity = calculate_severity(facts)
    strong_evidence = {
        "independent_sources": 5,
        "geo_agreement": 0.9,
        "fresh_media_ratio": 1.0,
        "external_verification_hits": 3,
        "has_contradiction": False,
    }
    weak_evidence = {
        "independent_sources": 1,
        "geo_agreement": 0.4,
        "fresh_media_ratio": 0.0,
        "external_verification_hits": None,
        "has_contradiction": False,
    }

    high = calculate_confidence(strong_evidence)
    low = calculate_confidence(weak_evidence)
    contradicted = calculate_confidence({**strong_evidence, "has_contradiction": True})

    assert get_action_priority(high, severity) == "CRITICAL_DISPATCH"
    assert get_action_priority(low, severity) == "DEPLOY_SCOUT"
    assert get_action_priority(high, 3.0) == "MONITOR"
    assert get_action_priority(low, 3.0) == "SUPPRESSED"
    assert high - contradicted == 45.0
    missing_external = dict(weak_evidence)
    del missing_external["external_verification_hits"]
    assert calculate_confidence(missing_external) == low

    print(
        f"High: {high:.2f}, severity: {severity:.2f} -> "
        f"{get_action_priority(high, severity)}"
    )
    print(
        f"Low: {low:.2f}, severity: {severity:.2f} -> "
        f"{get_action_priority(low, severity)}"
    )
    print(f"Contradiction: confidence falls from {high:.2f} to {contradicted:.2f}")
    print(f"Missing/None external verification: both return {low:.2f}")

    reports = [
        {"id": "rep_0001", "extracted_json": {"trapped_count": 3}},
        {"id": "rep_0002", "extracted_json": {"trapped_count": 5}},
        {"id": "rep_0003", "extracted_json": {"trapped_count": None}},
    ]
    counts = aggregate_victim_count(reports)
    assert counts == {"estimated_trapped_total": 5, "confirmed_by_sources": 2}
    print("Victim estimate:", counts)
