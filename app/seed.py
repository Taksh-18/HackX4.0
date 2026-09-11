from datetime import UTC, datetime, timedelta

from app.db import SessionLocal, init_db
from app.models import Incident, IncidentReport, Report


def seed():
    init_db()
    incident_id = "INC_042"
    start = datetime(2026, 9, 11, 8, 30, tzinfo=UTC)
    # Synthetic Chennai flood scenario; these are not live citizen reports.
    samples = [
        (
            "rep_0001",
            "demo_citizen_01",
            6,
            13.0418,
            80.2341,
            "Floodwater near the T. Nagar community hall. Six people are "
            "stranded; need a rescue boat.",
        ),
        (
            "rep_0002",
            "demo_citizen_02",
            4,
            13.0420,
            80.2343,
            "Four people visible on the community hall steps. Water is rising; "
            "need life jackets.",
        ),
        (
            "rep_0003",
            "demo_citizen_03",
            5,
            13.0416,
            80.2339,
            "At least five people waiting for rescue near the hall. Need a boat "
            "and first aid.",
        ),
    ]
    with SessionLocal.begin() as db:
        if db.get(Incident, incident_id) is not None:
            print(f"{incident_id} already exists; seed left unchanged.")
            return

        reports = [
            Report(
                id=report_id,
                source_user=user,
                raw_text=text,
                timestamp=start + timedelta(minutes=i * 2),
                gps_lat=lat,
                gps_lon=lon,
                extracted_json={
                    "disaster_type": "FLOOD",
                    "landmark": "T. Nagar community hall",
                    "trapped_count": trapped,
                    "resources": ["rescue_boat", "life_jackets", "first_aid"],
                    "severity": 8.5,
                    "relevant": True,
                },
            )
            for i, (report_id, user, trapped, lat, lon, text) in enumerate(samples)
        ]
        incident = Incident(
            id=incident_id,
            event_type="FLOOD",
            title="DEMO: People stranded near T. Nagar community hall",
            center_lat=13.0418,
            center_lon=80.2341,
            uncertainty_radius_m=150.0,
            severity_score=8.5,
            confidence_score=88.0,
            verification_status="CORROBORATED",
            action_priority="CRITICAL_DISPATCH",
            responder_state="UNACKNOWLEDGED",
            evidence_json={
                "total_reports": 3,
                "independent_sources": 3,
                "unique_images": 0,
            },
            aggregated_needs_json={
                "estimated_trapped_total": 6,  # max(6, 4, 5), not the sum.
                "confirmed_by_sources": 3,
                "priority_resources": ["rescue_boat", "life_jackets", "first_aid"],
            },
            timeline_json=[
                {"time": start.isoformat(), "event": "First citizen report received"},
                {
                    "time": (start + timedelta(minutes=4)).isoformat(),
                    "event": "Three independent reports; incident corroborated",
                },
            ],
        )
        db.add_all([incident, *reports])
        db.flush()
        db.add_all(
            [
                IncidentReport(
                    incident_id=incident_id,
                    report_id=report.id,
                    distance_m=distance,
                    time_delta_s=float(i * 120),
                )
                for i, (report, distance) in enumerate(zip(reports, [0.0, 31.0, 31.0]))
            ]
        )
    print(f"Seeded {incident_id} with 3 reports. GET /incidents/{incident_id}")


if __name__ == "__main__":
    seed()
