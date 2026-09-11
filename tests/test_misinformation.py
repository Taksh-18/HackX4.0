"""app.misinformation: deterministic, explainable, never-claims-proof risk scoring."""

from app.misinformation import assess_misinformation_risk


def _base_kwargs(**overrides):
    kwargs = dict(
        has_contradiction=False,
        contradiction_group_count=0,
        recycled_media_detected=0,
        total_reports=5,
        image_text_mismatches=0,
        duplicate_text_groups=0,
        independent_sources=5,
        geo_agreement=0.9,
        rumour_labeled_reports=0,
    )
    kwargs.update(overrides)
    return kwargs


def test_clean_cluster_is_low_risk_with_no_signals():
    result = assess_misinformation_risk(**_base_kwargs())
    assert result.risk_level == "LOW"
    assert result.risk_score == 0.0
    assert result.signals == []
    assert "No material misinformation signals" in result.assessment


def test_contradiction_raises_risk_and_is_explained():
    result = assess_misinformation_risk(
        **_base_kwargs(has_contradiction=True, contradiction_group_count=1)
    )
    assert result.risk_score > 0
    assert result.contradiction_groups == 1
    assert any("contradicting" in signal for signal in result.signals)


def test_recycled_media_is_a_named_signal():
    result = assess_misinformation_risk(
        **_base_kwargs(recycled_media_detected=2, total_reports=6)
    )
    assert result.recycled_media_reports == 2
    assert any("recycled" in signal for signal in result.signals)


def test_image_text_mismatch_is_a_named_signal():
    result = assess_misinformation_risk(**_base_kwargs(image_text_mismatches=1))
    assert result.image_text_mismatches == 1
    assert any("conflict with their own" in signal for signal in result.signals)


def test_weak_geo_agreement_is_a_named_signal():
    result = assess_misinformation_risk(**_base_kwargs(geo_agreement=0.1))
    assert any("geographic agreement" in signal for signal in result.signals)


def test_low_independent_ratio_is_a_named_signal():
    result = assess_misinformation_risk(
        **_base_kwargs(total_reports=10, independent_sources=2)
    )
    assert any("small share" in signal for signal in result.signals)


def test_rumour_label_alone_does_not_trigger_contradiction_signal():
    """A report calling something a rumour is its own, separate, weaker signal."""
    result = assess_misinformation_risk(**_base_kwargs(rumour_labeled_reports=1))
    assert result.contradiction_groups == 0
    assert any("rumour" in signal for signal in result.signals)
    assert not any("contradicting" in signal for signal in result.signals)


def test_everything_combined_reaches_high_risk_and_stays_explainable():
    result = assess_misinformation_risk(
        **_base_kwargs(
            has_contradiction=True,
            contradiction_group_count=2,
            recycled_media_detected=3,
            total_reports=10,
            image_text_mismatches=2,
            duplicate_text_groups=2,
            independent_sources=2,
            geo_agreement=0.1,
            rumour_labeled_reports=1,
        )
    )
    assert result.risk_level == "HIGH"
    assert 0.0 <= result.risk_score <= 1.0
    assert len(result.signals) == 7  # every configured signal fired exactly once


def test_score_is_clamped_to_one_even_with_every_signal_active():
    result = assess_misinformation_risk(
        **_base_kwargs(
            has_contradiction=True,
            contradiction_group_count=5,
            recycled_media_detected=10,
            total_reports=10,
            image_text_mismatches=5,
            duplicate_text_groups=1,
            independent_sources=1,
            geo_agreement=0.0,
            rumour_labeled_reports=5,
        )
    )
    assert result.risk_score <= 1.0


def test_proven_false_is_always_false_regardless_of_signal_strength():
    """No combination of heuristic signals may ever set proven_false=True."""
    weak = assess_misinformation_risk(**_base_kwargs())
    strong = assess_misinformation_risk(
        **_base_kwargs(
            has_contradiction=True,
            contradiction_group_count=10,
            recycled_media_detected=10,
            image_text_mismatches=10,
            duplicate_text_groups=1,
            independent_sources=1,
            total_reports=10,
            geo_agreement=0.0,
            rumour_labeled_reports=10,
        )
    )
    assert weak.proven_false is False
    assert strong.proven_false is False


def test_zero_total_reports_never_raises():
    result = assess_misinformation_risk(
        **_base_kwargs(total_reports=0, independent_sources=0, duplicate_text_groups=0)
    )
    assert result.risk_level == "LOW"
