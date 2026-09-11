import pytest

from app import corroboration

ZERO = "0000000000000000"
NEAR = "000000000000001f"  # Hamming distance 5 from ZERO.
FAR = "ffffffffffffffff"


def test_hash_distance_boundaries_and_validation():
    assert corroboration.is_duplicate(ZERO, NEAR)
    assert not corroboration.is_duplicate(ZERO, NEAR, threshold=4)
    assert not corroboration.is_duplicate(ZERO, FAR)
    with pytest.raises(ValueError):
        corroboration.is_duplicate("bad", ZERO)


def test_duplicate_images_and_explicit_reposts_merge_witnesses():
    reports = [
        {
            "id": "a",
            "source_user": "@original",
            "media_url": "one.jpg",
            "raw_text": "Flood here",
        },
        {
            "id": "b",
            "source_user": "@other",
            "media_url": "copy.jpg",
            "raw_text": "Same flood",
        },
        {
            "id": "c",
            "source_user": "@third",
            "media_url": "other.jpg",
            "raw_text": "Distinct view",
        },
        {
            "id": "d",
            "source_user": "@forwarder",
            "media_url": None,
            "raw_text": "RT @original: Flood here",
        },
    ]
    result = corroboration.calculate_corroboration(
        {"report_ids": ["a", "b", "c", "d"]},
        reports,
        {"a": ZERO, "b": NEAR, "c": FAR},
    )
    assert result == {
        "total_reports": 4,
        "independent_sources": 2,
        "unique_images": 2,
        "recycled_media_detected": 0,
    }


def test_recycled_media_counts_flagged_reports(monkeypatch):
    monkeypatch.setitem(corroboration.KNOWN_OLD_HASHES, "verified_old", ZERO)
    reports = [
        {"id": "a", "source_user": "@a", "media_url": "one.jpg"},
        {"id": "b", "source_user": "@b", "media_url": "copy.jpg"},
    ]
    result = corroboration.calculate_corroboration(
        {"report_ids": ["a", "b"]}, reports, {"a": ZERO, "b": NEAR}
    )
    assert result["recycled_media_detected"] == 2


def test_invalid_cluster_membership_and_missing_hash_are_not_silent():
    report = {"id": "a", "source_user": "@a", "media_url": "one.jpg"}
    with pytest.raises(ValueError, match="duplicate report IDs"):
        corroboration.calculate_corroboration(
            {"report_ids": ["a", "a"]}, [report], {"a": ZERO}
        )
    with pytest.raises(ValueError, match="Missing media hash"):
        corroboration.calculate_corroboration({"report_ids": ["a"]}, [report], {})
