from datetime import UTC, datetime, timedelta

from app.db import SessionLocal, init_db
from app.models import Incident, IncidentReport, Report


def seed(session_factory=SessionLocal, *, initialize: bool = True) -> bool:
    """Insert demo data once; return True only when rows were created."""
    if initialize:
        init_db()
    incident_id = "INC_042"
    start = datetime(2026, 9, 11, 8, 30, tzinfo=UTC)
    # Synthetic Mayur Vihar flood scenario; these are not live citizen reports.
    samples = [
        (
            "demo_rep_0001",
            "demo_citizen_01",
            6,
            28.6084,
            77.2951,
            "Floodwater near Metro Pillar 42. Six people are stranded inside a "
            "ground-floor shop and need a rescue boat.",
        ),
        (
            "demo_rep_0002",
            "demo_citizen_02",
            4,
            28.6081,
            77.2954,
            "Four people are stuck by Metro Pillar 42. Water is rising; they "
            "need life jackets.",
        ),
        (
            "demo_rep_0003",
            "demo_citizen_03",
            5,
            28.6086,
            77.2949,
            "Five people are waiting for rescue near Mayur Vihar metro. They "
            "need a boat and first aid.",
        ),
    ]
    with session_factory.begin() as db:
        if db.get(Incident, incident_id) is not None:
            print(f"{incident_id} already exists; seed left unchanged.")
            return False

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
                    "landmark": "Metro Pillar 42",
                    "trapped_count": trapped,
                    "claim": text,
                    "resource_demands": ["rescue_boat", "life_jackets", "first_aid"],
                    "access_impediment": True,
                    "event_time_hint": None,
                    "severity": 9,
                    "relevant": True,
                },
            )
            for i, (report_id, user, trapped, lat, lon, text) in enumerate(samples)
        ]
        incident = Incident(
            id=incident_id,
            event_type="FLOOD",
            title="DEMO: People stranded near Metro Pillar 42",
            center_lat=28.6084,
            center_lon=77.2951,
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
    return True


if __name__ == "__main__":
    seed()
