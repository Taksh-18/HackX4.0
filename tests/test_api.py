from fastapi.testclient import TestClient

from app.main import app
from app.seed import seed


def test_health_check():
    with TestClient(app) as client:
        response = client.get("/health")

    assert response.status_code == 200
    assert response.json() == {"status": "ok"}


def test_seeded_incident_detail():
    seed()
    with TestClient(app) as client:
        response = client.get("/incidents/INC_042")

    assert response.status_code == 200
    incident = response.json()
    assert incident["severity_score"] == 8.5
    assert incident["confidence_score"] == 88.0
    assert incident["action_priority"] == "CRITICAL_DISPATCH"
    assert incident["aggregated_needs_json"]["estimated_trapped_total"] == 6
    assert len(incident["report_links"]) == 3


def test_report_stub_validates_input():
    with TestClient(app) as client:
        valid = client.post(
            "/reports",
            json={"source_user": "citizen_1", "raw_text": "Flooding near bridge"},
        )
        invalid = client.post(
            "/reports",
            json={"source_user": "citizen_1", "raw_text": "", "gps_lat": 91},
        )

    assert valid.status_code == 200
    assert valid.json()["id"].startswith("rep_")
    assert invalid.status_code == 422
