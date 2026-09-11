from datetime import UTC, datetime
from typing import Literal

from pydantic import AliasChoices, BaseModel, ConfigDict, Field, field_validator


class Schema(BaseModel):
    model_config = ConfigDict(from_attributes=True, allow_inf_nan=False)


class Extraction(Schema):
    """Read both current extraction output and older/unprocessed stored reports."""

    relevant: bool | None = None
    disaster_type: Literal["FLOOD", "FIRE", "COLLAPSE", "OTHER"] | None = None
    claim: str | None = None
    landmark: str | None = None
    trapped_count: int | None = Field(default=None, ge=0)
    resource_demands: list[str] = Field(
        default_factory=list,
        validation_alias=AliasChoices("resource_demands", "resources"),
    )
    access_impediment: bool = False
    # Current extractions use integers; retain legacy seed values such as 8.5.
    severity: int | float | None = Field(default=None, ge=0, le=10)
    event_time_hint: str | None = None


class Evidence(Schema):
    total_reports: int = Field(default=0, ge=0)
    independent_sources: int = Field(default=0, ge=0)
    unique_images: int = Field(default=0, ge=0)
    recycled_media_detected: int = Field(default=0, ge=0)
    geo_agreement: float = Field(default=0.0, ge=0, le=1)
    fresh_media_ratio: float = Field(default=0.0, ge=0, le=1)
    external_verification_hits: int | None = Field(default=0, ge=0)
    has_contradiction: bool = False


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

    @field_validator("source_user", "raw_text")
    @classmethod
    def reject_blank_text(cls, value: str) -> str:
        if not value.strip():
            raise ValueError("must not be blank")
        return value

    @field_validator("timestamp")
    @classmethod
    def normalize_timestamp(cls, value: datetime) -> datetime:
        if value.tzinfo is None:
            value = value.replace(tzinfo=UTC)
        return value.astimezone(UTC)


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
