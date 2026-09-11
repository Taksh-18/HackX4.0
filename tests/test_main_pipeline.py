"""Integration tests for the endpoints wired to app.pipeline."""

import pytest
from fastapi.testclient import TestClient
from sqlalchemy.orm import sessionmaker

from app.db import Base, create_sqlite_engine, get_db
from app.main import app
from app.pipeline import load_reports, run_pipeline


@pytest.fixture
def api(tmp_path, monkeypatch):
    engine = create_sqlite_engine(tmp_path / "test.db")
    Base.metadata.create_all(engine)
    sessions = sessionmaker(bind=engine, expire_on_commit=False)
    monkeypatch.setattr("app.main.init_db", lambda: None)

    def test_db():
        with sessions() as session:
            yield session

    app.dependency_overrides[get_db] = test_db
    try:
        with TestClient(app) as client:
            yield client, sessions
    finally:
        app.dependency_overrides.clear()
        engine.dispose()


FLOOD_REPORTS = [
    {
        "id": "rep_a1",
        "source_user": "@a1",
        "raw_text": "Three people trapped near Metro Pillar 42, water rising fast.",
        "media_url": None,
        "timestamp": "2026-09-11T14:00:00+05:30",
        "gps_lat": 28.6083,
        "gps_lon": 77.2952,
    },
    {
        "id": "rep_a2",
        "source_user": "@a2",
        "raw_text": (
            "Five people waiting for rescue in floodwater near Metro Pillar 42, "
            "need a boat."
        ),
        "media_url": None,
        "timestamp": "2026-09-11T14:05:00+05:30",
        "gps_lat": 28.6085,
        "gps_lon": 77.2952,
    },
    {
        "id": "rep_a3",
        "source_user": "@a3",
        "raw_text": (
            "Floodwater is blocking the lane near Metro Pillar 42, road access "
            "cut off."
        ),
        "media_url": None,
        "timestamp": "2026-09-11T14:08:00+05:30",
        "gps_lat": 28.6084,
        "gps_lon": 77.2951,
    },
]

NOISE_REPORT = {
    "id": "rep_noise",
    "source_user": "@noise",
    "raw_text": "Thoughts and prayers for everyone 🙏",
    "media_url": None,
    "timestamp": "2026-09-11T14:09:00+05:30",
    "gps_lat": None,
    "gps_lon": None,
}


def test_pipeline_run_creates_an_incident_from_flood_cluster(api):
    _, sessions = api
    with sessions.begin() as session:
        added = load_reports(session, FLOOD_REPORTS + [NOISE_REPORT])
        assert added == 4
        result = run_pipeline(session)

    assert result.reports_relevant == 3
    assert result.clusters == 1
    assert len(result.incidents_created) == 1
    incident_id = result.incidents_created[0]
    assert result.report_to_incident["rep_a1"] == incident_id
    assert "rep_noise" not in result.report_to_incident


def test_pipeline_run_is_idempotent_and_updates_in_place(api):
    _, sessions = api
    with sessions.begin() as session:
        load_reports(session, FLOOD_REPORTS)
        first = run_pipeline(session)
    incident_id = first.incidents_created[0]

    with sessions.begin() as session:
        second = run_pipeline(session)
    assert second.incidents_created == []
    assert second.incidents_updated == [incident_id]

    with sessions() as session:
        from app.models import Incident, IncidentReport

        assert session.get(Incident, incident_id) is not None
        links = session.query(IncidentReport).filter_by(incident_id=incident_id).all()
        assert len(links) == 3


def test_create_report_endpoint_runs_the_pipeline(api):
    client, sessions = api
    for payload in FLOOD_REPORTS:
        response = client.post(
            "/reports",
            json={
                "source_user": payload["source_user"],
                "raw_text": payload["raw_text"],
                "timestamp": payload["timestamp"],
                "gps_lat": payload["gps_lat"],
                "gps_lon": payload["gps_lon"],
            },
        )
        assert response.status_code == 200
        body = response.json()
        assert body["id"].startswith("rep_")
        assert body["extracted_json"]["relevant"] is True
        assert body["extracted_json"]["disaster_type"] == "FLOOD"

    listing = client.get("/incidents")
    assert listing.status_code == 200
    incidents = listing.json()
    assert len(incidents) == 1
    assert incidents[0]["aggregated_needs_json"]["estimated_trapped_total"] == 5

    incident_id = incidents[0]["id"]
    evidence = client.get(f"/incidents/{incident_id}/evidence")
    assert evidence.status_code == 200
    assert evidence.json()["evidence_json"]["total_reports"] == 3
    assert len(evidence.json()["reports"]) == 3

    markers = client.get("/map/incidents")
    assert markers.status_code == 200
    assert markers.json()[0]["id"] == incident_id


def test_responder_state_transitions_and_rejections(api):
    client, sessions = api
    with sessions.begin() as session:
        load_reports(session, FLOOD_REPORTS)
        result = run_pipeline(session)
    incident_id = result.incidents_created[0]

    ack = client.post(f"/incidents/{incident_id}/acknowledge")
    assert ack.status_code == 200
    assert ack.json()["responder_state"] == "ACKNOWLEDGED"
    assert ack.json()["stub"] is False

    dispatch = client.post(f"/incidents/{incident_id}/dispatch")
    assert dispatch.status_code == 200
    assert dispatch.json()["responder_state"] == "DISPATCHED"

    # Cannot move backwards.
    regress = client.post(f"/incidents/{incident_id}/acknowledge")
    assert regress.status_code == 409

    resolve = client.post(f"/incidents/{incident_id}/resolve")
    assert resolve.status_code == 200
    assert resolve.json()["responder_state"] == "RESOLVED"

    # A resolved incident drops out of the active listing and the live map.
    active = client.get("/incidents", params={"status": "active"})
    assert active.json() == []
    resolved = client.get("/incidents", params={"status": "resolved"})
    assert len(resolved.json()) == 1
    markers = client.get("/map/incidents")
    assert markers.json() == []

    missing = client.post("/incidents/INC_missing/acknowledge")
    assert missing.status_code == 404


def test_trigger_pipeline_run_endpoint(api):
    client, sessions = api
    with sessions.begin() as session:
        load_reports(session, FLOOD_REPORTS)

    response = client.post("/pipeline/run")
    assert response.status_code == 200
    summary = response.json()
    assert summary["reports_total"] == 3
    assert len(summary["incidents_created"]) == 1
