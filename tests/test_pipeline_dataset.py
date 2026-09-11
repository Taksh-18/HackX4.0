"""Offline integration test: the full 50-report dataset through the pipeline.

Extraction is mocked at the LLM-client boundary (`filter_and_extract`'s
`client.chat.completions.create`), not by swapping in the keyword fallback -
this exercises the real extraction/validation code path in `app.extraction`
end to end while guaranteeing the test never needs, and never consumes, a
real LLM API key.
"""

import json
from pathlib import Path

import pytest
from sqlalchemy.orm import sessionmaker

from app.db import Base, create_sqlite_engine
from app.models import Incident, IncidentReport, Media, Report
from app.offline_extraction import heuristic_extract
from app.pipeline import load_reports, run_pipeline

DATA_PATH = Path(__file__).resolve().parents[1] / "data" / "simulated_reports.json"
MEDIA_DIR = Path(__file__).resolve().parents[1] / "media"
REQUIRED_MEDIA = [
    "flood_scene_1.jpg",
    "flood_scene_2.jpg",
    "bridge_incident.jpg",
    "reused_flood_image.jpg",
]


@pytest.fixture(scope="module", autouse=True)
def ensure_demo_media():
    """Generate the synthetic demo images on a fresh checkout, if needed."""
    if all((MEDIA_DIR / name).is_file() for name in REQUIRED_MEDIA):
        return
    import importlib.util

    script_path = (
        Path(__file__).resolve().parents[1] / "scripts" / "generate_demo_media.py"
    )
    spec = importlib.util.spec_from_file_location("generate_demo_media", script_path)
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    module.main()


class _FakeMessage:
    def __init__(self, content: str):
        self.content = content
        self.refusal = None


class _FakeChoice:
    def __init__(self, content: str):
        self.message = _FakeMessage(content)
        self.finish_reason = "stop"


class _FakeResponse:
    def __init__(self, content: str):
        self.choices = [_FakeChoice(content)]


class _FakeCompletions:
    """Stands in for `client.chat.completions`, returning canned extractions.

    Each call inspects the user message this pipeline always sends (the
    report's own JSON payload, embedded by `filter_and_extract`) to find the
    report id, then returns a pre-computed, deterministic extraction for it -
    no network call, no API key, ever.
    """

    def __init__(self, canned: dict[str, str]):
        self._canned = canned

    def create(self, *, model, messages, response_format, temperature):
        del model, response_format, temperature  # part of the real call shape only
        user_message = messages[-1]["content"]
        payload = json.loads(user_message.split("\n", 1)[1])
        report_id = payload["id"]
        return _FakeResponse(self._canned[report_id])


class _FakeChat:
    def __init__(self, canned: dict[str, str]):
        self.completions = _FakeCompletions(canned)


class MockedExtractionClient:
    """A mocked stand-in for an OpenAI-compatible client."""

    def __init__(self, canned: dict[str, str]):
        self.base_url = "https://mocked.example/v1"
        self.chat = _FakeChat(canned)


def _build_canned_extractions(reports: list[dict]) -> dict[str, str]:
    """Deterministic, hand-verifiable mock extraction per report id.

    Built once from the same rule-based logic the offline fallback uses, so
    the mocked "LLM" output is realistic (relevant flood/collapse reports,
    irrelevant noise) without hand-authoring fifty JSON blobs.
    """
    return {
        report["id"]: heuristic_extract(report).model_dump_json()
        for report in reports
    }


@pytest.fixture
def sessions(tmp_path):
    engine = create_sqlite_engine(tmp_path / "dataset.db")
    Base.metadata.create_all(engine)
    factory = sessionmaker(bind=engine, expire_on_commit=False)
    try:
        yield factory
    finally:
        engine.dispose()


def test_fifty_report_dataset_flows_through_the_entire_pipeline(sessions):
    reports = json.loads(DATA_PATH.read_text())
    assert len(reports) == 50

    client = MockedExtractionClient(_build_canned_extractions(reports))

    with sessions.begin() as session:
        added = load_reports(session, reports)
        assert added == 50
        result = run_pipeline(session, client=client)

    # Extraction ran for every report, through the mocked LLM-client path.
    assert result.reports_total == 50
    assert result.reports_extracted == 50
    assert result.reports_relevant > 0
    assert result.reports_relevant < result.reports_total  # noise was filtered

    # Irrelevant/unresolved reports never reach clustering.
    assert result.reports_located <= result.reports_relevant
    assert result.clusters >= 1
    assert len(result.incidents_created) == result.clusters

    with sessions() as session:
        incidents = session.query(Incident).all()
        links = session.query(IncidentReport).all()
        media = session.query(Media).all()
        report_rows = session.query(Report).all()

        assert len(report_rows) == 50
        assert len(incidents) == result.clusters
        assert len(links) == result.reports_located

        # Every persisted incident has real scoring, not placeholder values.
        for incident in incidents:
            assert incident.event_type in {"FLOOD", "FIRE", "COLLAPSE", "OTHER"}
            assert 1.0 <= incident.severity_score <= 10.0
            assert 0.0 <= incident.confidence_score <= 100.0
            assert incident.verification_status in {
                "CORROBORATED",
                "DEVELOPING",
                "CONTRADICTED",
            }
            assert incident.action_priority in {
                "CRITICAL_DISPATCH",
                "DEPLOY_SCOUT",
                "MONITOR",
                "SUPPRESSED",
            }
            assert incident.responder_state == "UNACKNOWLEDGED"

        # Media hashing ran: local report images produced pHash rows, and the
        # dataset's reused flood photo was linked to an earlier duplicate.
        assert len(media) > 0
        reused = next(m for m in media if m.report_id == "rep_0050")
        assert reused.is_duplicate_of is not None

        # The dataset's explicit denial ("The Sector 4 bridge is fine, it has
        # NOT collapsed...") must land in the same cluster as the collapse
        # reports and flip that incident to CONTRADICTED.
        contradicted = [i for i in incidents if i.verification_status == "CONTRADICTED"]
        assert len(contradicted) == 1
        assert contradicted[0].event_type == "COLLAPSE"


def test_rerunning_the_dataset_pipeline_is_idempotent(sessions):
    reports = json.loads(DATA_PATH.read_text())
    client = MockedExtractionClient(_build_canned_extractions(reports))

    with sessions.begin() as session:
        load_reports(session, reports)
        first = run_pipeline(session, client=client)

    with sessions.begin() as session:
        second = run_pipeline(session, client=client)

    assert second.incidents_created == []
    assert sorted(second.incidents_updated) == sorted(first.incidents_created)
    assert second.reports_extracted == 0  # already stored; not re-extracted

    with sessions() as session:
        assert session.query(Incident).count() == len(first.incidents_created)
