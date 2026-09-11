"""Deterministic, explainable misinformation-RISK signals for one cluster.

This module never determines truth. It combines bounded, individually named
signals into one risk score and level a responder can weigh alongside
confidence - it does not decide which claim is real. `proven_false` is
always `False` here and nothing in this module can set it otherwise: only an
actual human verification workflow (not implemented) could ever justify that
field being `True`.

Confidence (app.scoring.calculate_confidence) and misinformation risk are
kept conceptually separate on purpose: this function's score is not
subtracted from confidence anywhere in the pipeline. They are two different
questions - "how strong is the evidence for this claim" and "how much does
this cluster look like it might contain misleading content" - and conflating
them would make either one harder to explain on its own.
"""

from __future__ import annotations

from typing import Literal

from pydantic import BaseModel, ConfigDict, Field

RiskLevel = Literal["LOW", "MEDIUM", "HIGH"]

# Bounded, documented per-signal weights. The sum of every signal that fires
# is clamped to [0, 1] to become risk_score - this table is the entire
# formula, so "why is this HIGH" always has a one-line answer per signal.
_WEIGHTS = {
    "contradiction": 0.35,
    "recycled_media": 0.20,
    "image_text_mismatch": 0.15,
    "duplicate_concentration": 0.15,
    "low_independent_ratio": 0.10,
    "weak_geo_agreement": 0.10,
    "labeled_rumour": 0.15,
}

_LEVEL_FLOORS: tuple[tuple[RiskLevel, float], ...] = (
    ("LOW", 0.0),
    ("MEDIUM", 0.34),
    ("HIGH", 0.67),
)


class MisinformationRisk(BaseModel):
    model_config = ConfigDict(extra="forbid")

    risk_score: float = Field(default=0.0, ge=0, le=1)
    risk_level: RiskLevel = "LOW"
    signals: list[str] = Field(default_factory=list)
    contradiction_groups: int = Field(default=0, ge=0)
    image_text_mismatches: int = Field(default=0, ge=0)
    recycled_media_reports: int = Field(default=0, ge=0)
    duplicate_claim_groups: int = Field(default=0, ge=0)
    assessment: str = "No material misinformation signals detected."
    proven_false: bool = False


def _risk_level(score: float) -> RiskLevel:
    level: RiskLevel = "LOW"
    for name, floor in _LEVEL_FLOORS:
        if score >= floor:
            level = name
    return level


def assess_misinformation_risk(
    *,
    has_contradiction: bool,
    contradiction_group_count: int,
    recycled_media_detected: int,
    total_reports: int,
    image_text_mismatches: int,
    duplicate_text_groups: int,
    independent_sources: int,
    geo_agreement: float,
    rumour_labeled_reports: int,
) -> MisinformationRisk:
    """Combine bounded, documented signals into one explainable risk score.

    Every signal that fires is named in `signals` with the count behind it.
    Correlated signals (e.g. a contradiction that a report also labels as
    rumour) are allowed to co-occur - they describe different evidence about
    the same cluster, not duplicate copies of one fact, so nothing here
    tries to suppress a signal because another already fired.
    """
    signals: list[str] = []
    score = 0.0

    if has_contradiction or contradiction_group_count > 0:
        score += _WEIGHTS["contradiction"]
        signals.append(
            f"{max(contradiction_group_count, 1)} contradicting claim group(s) detected"
        )

    if recycled_media_detected > 0 and total_reports > 0:
        score += _WEIGHTS["recycled_media"]
        signals.append(f"{recycled_media_detected} report(s) carry recycled/old media")

    if image_text_mismatches > 0:
        score += _WEIGHTS["image_text_mismatch"]
        signals.append(
            f"{image_text_mismatches} image(s) appear to conflict with their own "
            "report text"
        )

    if total_reports > 0 and duplicate_text_groups > 0:
        concentration = duplicate_text_groups / total_reports
        if concentration <= 0.5:
            score += _WEIGHTS["duplicate_concentration"]
            signals.append(
                f"{total_reports} reports concentrate into only "
                f"{duplicate_text_groups} distinct text origin(s)"
            )

    if total_reports >= 3 and independent_sources > 0:
        ratio = independent_sources / total_reports
        if ratio < 0.4:
            score += _WEIGHTS["low_independent_ratio"]
            signals.append(
                f"independent sources ({independent_sources}) are a small share of "
                f"total reports ({total_reports})"
            )

    if geo_agreement < 0.4:
        score += _WEIGHTS["weak_geo_agreement"]
        signals.append(f"weak geographic agreement ({geo_agreement:.0%})")

    if rumour_labeled_reports > 0:
        score += _WEIGHTS["labeled_rumour"]
        signals.append(
            f"{rumour_labeled_reports} report(s) explicitly label another claim as "
            "rumour/unverified"
        )

    score = max(0.0, min(1.0, score))
    level = _risk_level(score)

    if not signals:
        assessment = "No material misinformation signals detected."
    else:
        assessment = (
            f"{level.title()} misinformation risk from {len(signals)} signal(s): "
            + "; ".join(signals)
            + ". This is a heuristic risk estimate, not proof that any claim is false."
        )

    return MisinformationRisk(
        risk_score=round(score, 4),
        risk_level=level,
        signals=signals,
        contradiction_groups=contradiction_group_count,
        image_text_mismatches=image_text_mismatches,
        recycled_media_reports=recycled_media_detected,
        duplicate_claim_groups=duplicate_text_groups,
        assessment=assessment,
        proven_false=False,
    )
