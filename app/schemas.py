from datetime import UTC, datetime
from typing import Literal

from pydantic import BaseModel, ConfigDict, Field


class Schema(BaseModel):
    model_config = ConfigDict(from_attributes=True, allow_inf_nan=False)


class Extraction(Schema):
    disaster_type: str | None = None
    landmark: str | None = None
    trapped_count: int | None = Field(default=None, ge=0)
    resources: list[str] = Field(default_factory=list)
    severity: float | None = Field(default=None, ge=0, le=10)
    relevant: bool | None = None


class Evidence(Schema):
    total_reports: int = Field(default=0, ge=0)
    independent_sources: int = Field(default=0, ge=0)
    unique_images: int = Field(default=0, ge=0)


class AggregatedNeeds(Schema):
    # Pipeline must use max(report trapped_count), never the sum.
    estimated_trapped_total: int = Field(default=0, ge=0)
    confirmed_by_sources: int = Field(default=0, ge=0)
    priority_resources: list[str] = Field(default_factory=list)


class TimelineEntry(Schema):
    time: datetime
    event: str


class ReportCreate(Schema):
    source_user: str = Field(min_length=1)
    raw_text: str = Field(min_length=1)
    media_url: str | None = None
    timestamp: datetime = Field(default_factory=lambda: datetime.now(UTC))
    gps_lat: float | None = Field(default=None, ge=-90, le=90)
    gps_lon: float | None = Field(default=None, ge=-180, le=180)


class ReportRead(ReportCreate):
    id: str
    extracted_json: Extraction = Field(default_factory=Extraction)


class IncidentCreate(Schema):
    id: str = Field(min_length=1)
    event_type: str
    title: str
    center_lat: float = Field(ge=-90, le=90)
    center_lon: float = Field(ge=-180, le=180)
    uncertainty_radius_m: float = Field(ge=0)
    severity_score: float = Field(ge=0, le=10)
    confidence_score: float = Field(ge=0, le=100)
    # Plain strings; Literal validates the allowed values without Python Enums.
    verification_status: Literal["CORROBORATED", "DEVELOPING", "CONTRADICTED"]
    action_priority: Literal[
        "CRITICAL_DISPATCH", "DEPLOY_SCOUT", "MONITOR", "SUPPRESSED"
    ]
    responder_state: Literal[
        "UNACKNOWLEDGED", "ACKNOWLEDGED", "DISPATCHED", "RESOLVED"
    ] = "UNACKNOWLEDGED"
    evidence_json: Evidence = Field(default_factory=Evidence)
    aggregated_needs_json: AggregatedNeeds = Field(default_factory=AggregatedNeeds)
    timeline_json: list[TimelineEntry] = Field(default_factory=list)


class IncidentRead(IncidentCreate):
    pass


class IncidentReportCreate(Schema):
    incident_id: str
    report_id: str
    distance_m: float = Field(ge=0)
    time_delta_s: float = Field(ge=0)  # Absolute time separation.


class IncidentReportRead(IncidentReportCreate):
    pass


class LinkedReportRead(IncidentReportRead):
    report: ReportRead


class IncidentDetailRead(IncidentRead):
    report_links: list[LinkedReportRead] = Field(default_factory=list)


class MediaCreate(Schema):
    id: str
    report_id: str
    phash: str
    is_duplicate_of: str | None = None


class MediaRead(MediaCreate):
    pass


class EvidenceRead(Schema):
    incident_id: str
    evidence_json: Evidence = Field(default_factory=Evidence)
    reports: list[LinkedReportRead] = Field(default_factory=list)
    media: list[MediaRead] = Field(default_factory=list)


class MapIncidentRead(Schema):
    id: str
    center_lat: float
    center_lon: float
    uncertainty_radius_m: float
    action_priority: Literal[
        "CRITICAL_DISPATCH", "DEPLOY_SCOUT", "MONITOR", "SUPPRESSED"
    ]


class ActionRead(Schema):
    incident_id: str
    responder_state: Literal["UNACKNOWLEDGED", "ACKNOWLEDGED", "DISPATCHED", "RESOLVED"]
    stub: bool = True
    message: str = "Mock response only; no database changes were made."
