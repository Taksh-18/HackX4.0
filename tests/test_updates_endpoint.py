"""GET /incidents/updates: timestamp-based polling for changed incidents."""

from datetime import UTC, datetime, timedelta

import pytest
from fastapi.testclient import TestClient
from sqlalchemy.orm import sessionmaker

from app.db import Base, create_sqlite_engine, get_db
from app.main import app
from app.pipeline import load_reports, run_pipeline

FLOOD_REPORTS = [
    {
        "id": "rep_u1",
        "source_user": "@u1",
        "raw_text": "Three people trapped near Metro Pillar 42, water rising fast.",
        "media_url": None,
        "timestamp": "2026-09-11T14:00:00+05:30",
        "gps_lat": 28.6083,
        "gps_lon": 77.2952,
    },
    {
        "id": "rep_u2",
        "source_user": "@u2",
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
        "id": "rep_u3",
        "source_user": "@u3",
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


def test_updates_since_epoch_returns_every_incident(api):
    client, sessions = api
    with sessions.begin() as session:
        load_reports(session, FLOOD_REPORTS)
        run_pipeline(session)

    response = client.get(
        "/incidents/updates", params={"since": "2020-01-01T00:00:00Z"}
    )
    assert response.status_code == 200
    body = response.json()
    assert len(body) == 1
    assert body[0]["updated_at"] is not None


def test_updates_since_the_future_returns_nothing(api):
    client, sessions = api
    with sessions.begin() as session:
        load_reports(session, FLOOD_REPORTS)
        run_pipeline(session)

    future = (datetime.now(UTC) + timedelta(days=1)).isoformat()
    response = client.get("/incidents/updates", params={"since": future})
    assert response.status_code == 200
    assert response.json() == []


def test_responder_action_bumps_updated_at_and_is_visible_to_a_new_poll(api):
    client, sessions = api
    with sessions.begin() as session:
        load_reports(session, FLOOD_REPORTS)
        result = run_pipeline(session)
    incident_id = result.incidents_created[0]

    checkpoint = client.get(
        "/incidents/updates", params={"since": "2020-01-01T00:00:00Z"}
    ).json()[0]["updated_at"]

    ack = client.post(f"/incidents/{incident_id}/acknowledge")
    assert ack.status_code == 200

    response = client.get("/incidents/updates", params={"since": checkpoint})
    body = response.json()
    assert len(body) == 1
    assert body[0]["id"] == incident_id
    assert body[0]["responder_state"] == "ACKNOWLEDGED"


def test_naive_since_is_treated_as_utc(api):
    client, sessions = api
    with sessions.begin() as session:
        load_reports(session, FLOOD_REPORTS)
        run_pipeline(session)

    response = client.get("/incidents/updates", params={"since": "2020-01-01T00:00:00"})
    assert response.status_code == 200
    assert len(response.json()) == 1
