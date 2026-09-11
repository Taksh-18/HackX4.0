from datetime import UTC, datetime
from io import BytesIO

import pytest
from fastapi.testclient import TestClient
from PIL import Image
from sqlalchemy import select
from sqlalchemy.orm import sessionmaker

from app.db import Base, create_sqlite_engine, get_db
from app.main import app
from app.models import Report
from app.seed import seed


@pytest.fixture
def api(tmp_path, monkeypatch):
    engine = create_sqlite_engine(tmp_path / "test.db")
    Base.metadata.create_all(engine)
    sessions = sessionmaker(bind=engine, expire_on_commit=False)
    monkeypatch.setattr("app.main.init_db", lambda: None)
    monkeypatch.setattr("app.main.UPLOAD_DIR", tmp_path / "uploads")

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


def test_health_check(api):
    client, _ = api
    response = client.get("/health")
    assert response.status_code == 200
    assert response.json() == {"status": "ok"}


def test_seeded_incident_detail_uses_current_extraction_contract(api):
    client, sessions = api
    assert seed(sessions, initialize=False) is True
    assert seed(sessions, initialize=False) is False

    response = client.get("/incidents/INC_042")
    assert response.status_code == 200
    incident = response.json()
    assert incident["severity_score"] == 8.5
    assert incident["confidence_score"] == 88.0
    assert incident["action_priority"] == "CRITICAL_DISPATCH"
    assert incident["aggregated_needs_json"]["estimated_trapped_total"] == 6
    assert len(incident["report_links"]) == 3
    extracted = incident["report_links"][0]["report"]["extracted_json"]
    assert extracted["claim"]
    assert extracted["resource_demands"] == [
        "rescue_boat",
        "life_jackets",
        "first_aid",
    ]
    assert "resources" not in extracted


def test_report_stub_validates_and_normalizes_input(api):
    client, _ = api
    valid = client.post(
        "/reports",
        json={
            "source_user": "citizen_1",
            "raw_text": "Flooding near bridge",
            "timestamp": "2026-09-11T14:00:00+05:30",
        },
    )
    blank = client.post(
        "/reports",
        json={"source_user": "citizen_1", "raw_text": "   "},
    )
    invalid_gps = client.post(
        "/reports",
        json={"source_user": "citizen_1", "raw_text": "Flood", "gps_lat": 91},
    )

    assert valid.status_code == 200
    assert valid.json()["id"].startswith("rep_")
    assert valid.json()["timestamp"] == "2026-09-11T08:30:00Z"
    assert blank.status_code == 422
    assert invalid_gps.status_code == 422


def test_sqlite_round_trip_restores_utc_timestamp(api):
    _, sessions = api
    local_time = datetime.fromisoformat("2026-09-11T14:00:00+05:30")
    with sessions.begin() as session:
        session.add(
            Report(
                id="utc_test",
                source_user="@tester",
                raw_text="Concrete flood report",
                timestamp=local_time,
                extracted_json={},
            )
        )
    with sessions() as session:
        stored = session.scalar(select(Report).where(Report.id == "utc_test"))
        assert stored.timestamp == datetime(2026, 9, 11, 8, 30, tzinfo=UTC)


def test_reports_can_be_filtered_by_source_user(api):
    client, _ = api
    for source in ("@alex_johnson", "@another_witness"):
        response = client.post(
            "/reports",
            json={"source_user": source, "raw_text": "Flood near Metro Pillar 42"},
        )
        assert response.status_code == 200

    response = client.get("/reports", params={"source_user": "@alex_johnson"})
    assert response.status_code == 200
    assert [report["source_user"] for report in response.json()] == ["@alex_johnson"]


def test_media_upload_validates_and_stores_an_image(api, tmp_path):
    client, _ = api
    image_bytes = BytesIO()
    Image.new("RGB", (8, 8), "blue").save(image_bytes, format="JPEG")

    uploaded = client.post(
        "/media",
        content=image_bytes.getvalue(),
        headers={"Content-Type": "image/jpeg"},
    )
    invalid = client.post(
        "/media",
        content=b"not-an-image",
        headers={"Content-Type": "image/jpeg"},
    )

    assert uploaded.status_code == 201
    media_url = uploaded.json()["media_url"]
    assert media_url.startswith("media/uploads/")
    assert (tmp_path / "uploads" / media_url.rsplit("/", 1)[1]).is_file()
    assert invalid.status_code == 400
