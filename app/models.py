from datetime import UTC, datetime

from sqlalchemy import JSON, Float, ForeignKey, String, Text
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db import Base, UTCDateTime


class Report(Base):
    __tablename__ = "reports"

    id: Mapped[str] = mapped_column(String, primary_key=True)
    source_user: Mapped[str] = mapped_column(String)
    raw_text: Mapped[str] = mapped_column(Text)
    media_url: Mapped[str | None] = mapped_column(String, nullable=True)
    timestamp: Mapped[datetime] = mapped_column(
        UTCDateTime(), default=lambda: datetime.now(UTC)
    )
    gps_lat: Mapped[float | None] = mapped_column(Float, nullable=True)
    gps_lon: Mapped[float | None] = mapped_column(Float, nullable=True)
    extracted_json: Mapped[dict] = mapped_column(JSON, default=dict)


class Incident(Base):
    __tablename__ = "incidents"

    id: Mapped[str] = mapped_column(String, primary_key=True)
    event_type: Mapped[str] = mapped_column(String)
    title: Mapped[str] = mapped_column(String)
    center_lat: Mapped[float] = mapped_column(Float)
    center_lon: Mapped[float] = mapped_column(Float)
    uncertainty_radius_m: Mapped[float] = mapped_column(Float)
    severity_score: Mapped[float] = mapped_column(Float)
    confidence_score: Mapped[float] = mapped_column(Float)
    # CORROBORATED | DEVELOPING | CONTRADICTED
    verification_status: Mapped[str] = mapped_column(String)
    # CRITICAL_DISPATCH | DEPLOY_SCOUT | MONITOR | SUPPRESSED
    action_priority: Mapped[str] = mapped_column(String)
    # UNACKNOWLEDGED | ACKNOWLEDGED | DISPATCHED | RESOLVED
    responder_state: Mapped[str] = mapped_column(
        String, default="UNACKNOWLEDGED", server_default="UNACKNOWLEDGED"
    )
    evidence_json: Mapped[dict] = mapped_column(JSON, default=dict)
    aggregated_needs_json: Mapped[dict] = mapped_column(JSON, default=dict)
    timeline_json: Mapped[list] = mapped_column(JSON, default=list)
    # Set on every pipeline (re)computation and every responder-state change;
    # backs the GET /incidents/updates polling endpoint. Nullable so rows
    # written before this column existed remain valid (see db.py's idempotent
    # column migration).
    updated_at: Mapped[datetime | None] = mapped_column(UTCDateTime(), nullable=True)
    report_links: Mapped[list["IncidentReport"]] = relationship()


class IncidentReport(Base):
    __tablename__ = "incident_reports"

    incident_id: Mapped[str] = mapped_column(
        ForeignKey("incidents.id"), primary_key=True
    )
    report_id: Mapped[str] = mapped_column(ForeignKey("reports.id"), primary_key=True)
    distance_m: Mapped[float] = mapped_column(Float)
    time_delta_s: Mapped[float] = mapped_column(Float)
    report: Mapped[Report] = relationship()


class Media(Base):
    __tablename__ = "media"

    id: Mapped[str] = mapped_column(String, primary_key=True)
    report_id: Mapped[str] = mapped_column(ForeignKey("reports.id"), index=True)
    phash: Mapped[str] = mapped_column(String)
    is_duplicate_of: Mapped[str | None] = mapped_column(
        ForeignKey("media.id"), nullable=True
    )
    # Validated app.image_analysis.ImageAnalysis, stored as JSON. Nullable:
    # no analysis has run yet, or none was available (offline/no provider).
    # See db.py's idempotent column migration for existing databases.
    analysis_json: Mapped[dict | None] = mapped_column(JSON, nullable=True)
