"""Structured contradiction grouping, evidence backward-compatibility, image
evidence dedup, and the idempotent SQLite column migration in app.db.
"""

import sqlite3

from app.db import _ensure_columns, create_sqlite_engine
from app.pipeline import build_contradiction_groups, image_evidence_signals
from app.schemas import Evidence


def _member(report_id, landmark, disaster_type, raw_text):
    return {
        "id": report_id,
        "raw_text": raw_text,
        "extracted_json": {"landmark": landmark, "disaster_type": disaster_type},
    }


def test_contradiction_group_names_affirming_and_denying_reports():
    members = [
        _member("a1", "Sector 4 Bridge", "COLLAPSE", "The Sector 4 bridge collapsed."),
        _member(
            "a2", "Sector 4 Bridge", "COLLAPSE", "Sector 4 bridge partially down."
        ),
        _member(
            "d1",
            "Sector 4 Bridge",
            "COLLAPSE",
            "The Sector 4 bridge is fine, it has NOT collapsed.",
        ),
    ]
    groups = build_contradiction_groups(members)
    assert len(groups) == 1
    group = groups[0]
    assert group["landmark"] == "Sector 4 Bridge"
    assert group["affirming_report_ids"] == ["a1", "a2"]
    assert group["denying_report_ids"] == ["d1"]


def test_no_group_when_only_affirming_reports_present():
    members = [
        _member("a1", "Metro Pillar 42", "FLOOD", "Water rising near Pillar 42."),
        _member("a2", "Metro Pillar 42", "FLOOD", "Flooding confirmed at Pillar 42."),
    ]
    assert build_contradiction_groups(members) == []


def test_no_group_when_only_an_isolated_denial_present():
    """A lone denial with nothing to contradict is not a contradiction group."""
    members = [
        _member("d1", "Metro Pillar 42", "FLOOD", "No flooding here, false alarm."),
    ]
    assert build_contradiction_groups(members) == []


def test_different_landmarks_never_share_a_group():
    members = [
        _member("a1", "Pillar 42", "FLOOD", "Water rising near Pillar 42."),
        _member("d1", "Sector 9 Market", "FLOOD", "No flooding here, false alarm."),
    ]
    assert build_contradiction_groups(members) == []


def test_evidence_schema_accepts_a_pre_upgrade_dict():
    """An evidence_json written before the new fields existed still validates."""
    legacy = {
        "total_reports": 3,
        "independent_sources": 2,
        "unique_images": 1,
        "recycled_media_detected": 0,
        "geo_agreement": 0.8,
        "fresh_media_ratio": 1.0,
        "external_verification_hits": None,
        "has_contradiction": False,
    }
    evidence = Evidence.model_validate(legacy)
    assert evidence.contradiction_groups == []
    assert evidence.image_analyses == []
    assert evidence.misinformation.risk_level == "LOW"
    assert evidence.confidence_breakdown == {}
    assert evidence.limitations == []


def test_image_evidence_signals_counts_a_repeated_phash_once():
    members = [
        {"id": "r1", "raw_text": ""},
        {"id": "r2", "raw_text": ""},
    ]
    media_hashes = {"r1": "same_hash", "r2": "same_hash"}
    media_analyses = {
        "r1": {"analyzed": True, "supports_text_claim": False, "confidence": 90},
        "r2": {"analyzed": True, "supports_text_claim": False, "confidence": 90},
    }
    mismatches, analyzed_unique, analyses_out = image_evidence_signals(
        members, media_hashes, media_analyses, recycled_ids=set()
    )
    assert analyzed_unique == 1  # second copy of the same image is not re-counted
    assert mismatches == 1
    assert len(analyses_out) == 1


def test_recycled_media_never_contributes_positive_image_signal():
    members = [{"id": "r1", "raw_text": ""}]
    media_hashes = {"r1": "old_hash"}
    media_analyses = {
        "r1": {"analyzed": True, "supports_text_claim": True, "confidence": 95}
    }
    mismatches, analyzed_unique, _analyses = image_evidence_signals(
        members, media_hashes, media_analyses, recycled_ids={"r1"}
    )
    # Recycled media is skipped for positive-signal purposes; it's still
    # "analyzed" (informational), just never treated as supporting evidence.
    assert mismatches == 0
    assert analyzed_unique == 1


def test_missing_analysis_is_neutral_not_a_mismatch():
    members = [{"id": "r1", "raw_text": ""}]
    mismatches, analyzed_unique, analyses_out = image_evidence_signals(
        members, media_hashes={}, media_analyses={}, recycled_ids=set()
    )
    assert mismatches == 0
    assert analyzed_unique == 0
    assert analyses_out == []


def test_db_migration_adds_missing_columns_to_an_existing_database(tmp_path):
    """Simulate a database created before analysis_json/updated_at existed."""
    db_path = tmp_path / "legacy.db"
    conn = sqlite3.connect(db_path)
    conn.execute(
        "CREATE TABLE media (id TEXT PRIMARY KEY, report_id TEXT, phash TEXT, "
        "is_duplicate_of TEXT)"
    )
    conn.execute(
        "CREATE TABLE incidents (id TEXT PRIMARY KEY, event_type TEXT, title TEXT)"
    )
    conn.execute(
        "INSERT INTO media (id, report_id, phash, is_duplicate_of) "
        "VALUES ('m1', 'r1', 'hash', NULL)"
    )
    conn.commit()
    conn.close()

    engine = create_sqlite_engine(db_path)
    _ensure_columns(engine)
    _ensure_columns(engine)  # calling twice must stay a no-op, not error

    with engine.connect() as connection:
        media_columns = {
            row[1] for row in connection.exec_driver_sql("PRAGMA table_info(media)")
        }
        incident_columns = {
            row[1]
            for row in connection.exec_driver_sql("PRAGMA table_info(incidents)")
        }
        preserved = connection.exec_driver_sql(
            "SELECT id, report_id, phash FROM media WHERE id = 'm1'"
        ).fetchone()

    assert "analysis_json" in media_columns
    assert "updated_at" in incident_columns
    assert preserved == ("m1", "r1", "hash")  # existing row untouched
    engine.dispose()
