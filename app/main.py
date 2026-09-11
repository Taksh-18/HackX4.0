"""FastAPI application wiring the API surface to the processing pipeline.

Every route below reads or writes through `app.pipeline`, which is the single
place extraction, geolocation, clustering, corroboration, and scoring are
connected together (see that module's docstring for the stage diagram).
"""

from contextlib import asynccontextmanager
from io import BytesIO
from pathlib import Path
from typing import Literal
from uuid import uuid4

from fastapi import Depends, FastAPI, HTTPException, Request
from fastapi.staticfiles import StaticFiles
from PIL import Image, UnidentifiedImageError
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.db import get_db, init_db
from app.models import Incident, Media, Report
from app.pipeline import ingest_report, run_pipeline, set_responder_state
from app.schemas import (
    ActionRead,
    EvidenceRead,
    IncidentDetailRead,
    IncidentRead,
    LinkedReportRead,
    MapIncidentRead,
    MediaRead,
    MediaUploadRead,
    ReportCreate,
    ReportRead,
)


@asynccontextmanager
async def lifespan(app: FastAPI):
    init_db()
    yield


app = FastAPI(
    title="Crowdsourced Disaster Intelligence System",
    description=(
        "API for crowdsourced disaster reports and incidents, backed by the "
        "extraction -> geolocation -> clustering -> corroboration -> scoring "
        "pipeline."
    ),
    version="0.1.0",
    lifespan=lifespan,
)

STATIC_DIR = Path(__file__).resolve().parent / "static"
PROJECT_ROOT = Path(__file__).resolve().parents[1]
MEDIA_DIR = PROJECT_ROOT / "media"
UPLOAD_DIR = MEDIA_DIR / "uploads"
MAX_MEDIA_BYTES = 10 * 1024 * 1024
ALLOWED_IMAGE_TYPES = {
    "image/jpeg": ("JPEG", ".jpg"),
    "image/png": ("PNG", ".png"),
    "image/webp": ("WEBP", ".webp"),
}

MEDIA_DIR.mkdir(parents=True, exist_ok=True)
app.mount("/dashboard", StaticFiles(directory=STATIC_DIR, html=True), name="dashboard")
app.mount("/media", StaticFiles(directory=MEDIA_DIR), name="media")


@app.get("/health", tags=["system"])
def health_check():
    return {"status": "ok"}


@app.post("/reports", response_model=ReportRead)
def create_report(payload: ReportCreate, db: Session = Depends(get_db)):
    """Persist a citizen report and run the full pipeline against it.

    The response reflects this report's own extracted facts immediately;
    whether it was folded into a new or existing incident is visible via
    `GET /incidents` right after this call returns.
    """
    report, _incident_id = ingest_report(db, payload)
    return ReportRead.model_validate(report)


@app.get("/reports", response_model=list[ReportRead])
def list_reports(
    source_user: str | None = None,
    db: Session = Depends(get_db),
):
    """List reports, optionally restricted to one submitting user."""
    query = select(Report)
    if source_user:
        query = query.where(Report.source_user == source_user)
    rows = db.scalars(query.order_by(Report.timestamp.desc(), Report.id)).all()
    return [ReportRead.model_validate(report) for report in rows]


@app.post("/media", response_model=MediaUploadRead, status_code=201)
async def upload_media(request: Request):
    """Store one verified image sent as the raw request body."""
    content_type = request.headers.get("content-type", "").split(";", 1)[0].lower()
    expected = ALLOWED_IMAGE_TYPES.get(content_type)
    if expected is None:
        raise HTTPException(
            status_code=415,
            detail="Only JPEG, PNG, and WebP images are supported.",
        )

    body = bytearray()
    async for chunk in request.stream():
        body.extend(chunk)
        if len(body) > MAX_MEDIA_BYTES:
            raise HTTPException(
                status_code=413, detail="Image must be 10 MB or smaller."
            )
    if not body:
        raise HTTPException(status_code=400, detail="Image body is empty.")

    try:
        with Image.open(BytesIO(body)) as image:
            image.verify()
            actual_format = image.format
    except (UnidentifiedImageError, OSError, SyntaxError, ValueError) as exc:
        raise HTTPException(status_code=400, detail="Image data is invalid.") from exc

    expected_format, extension = expected
    if actual_format != expected_format:
        raise HTTPException(
            status_code=400,
            detail="Image content does not match its Content-Type.",
        )

    UPLOAD_DIR.mkdir(parents=True, exist_ok=True)
    filename = f"{uuid4().hex}{extension}"
    (UPLOAD_DIR / filename).write_bytes(body)
    return MediaUploadRead(media_url=f"media/uploads/{filename}")


@app.get("/incidents", response_model=list[IncidentRead])
def list_incidents(
    status: Literal["active", "resolved", "all"] = "active",
    db: Session = Depends(get_db),
):
    """List incidents, most severe first, filtered by responder state."""
    query = select(Incident)
    if status == "active":
        query = query.where(Incident.responder_state != "RESOLVED")
    elif status == "resolved":
        query = query.where(Incident.responder_state == "RESOLVED")
    incidents = db.scalars(
        query.order_by(Incident.severity_score.desc(), Incident.id)
    ).all()
    return [IncidentRead.model_validate(incident) for incident in incidents]


@app.get("/incidents/{id}", response_model=IncidentDetailRead)
def get_incident(id: str, db: Session = Depends(get_db)):
    """Read an incident and its linked reports."""
    incident = db.get(Incident, id)
    if incident is None:
        raise HTTPException(status_code=404, detail="Incident not found")
    return IncidentDetailRead.model_validate(incident)


@app.get("/incidents/{id}/evidence", response_model=EvidenceRead)
def get_evidence(id: str, db: Session = Depends(get_db)):
    """Read the evidence breakdown, linked reports, and media for an incident."""
    incident = db.get(Incident, id)
    if incident is None:
        raise HTTPException(status_code=404, detail="Incident not found")
    report_ids = [link.report_id for link in incident.report_links]
    media = (
        db.scalars(select(Media).where(Media.report_id.in_(report_ids)))
        .all()
        if report_ids
        else []
    )
    return EvidenceRead(
        incident_id=id,
        evidence_json=incident.evidence_json,
        reports=[
            LinkedReportRead.model_validate(link) for link in incident.report_links
        ],
        media=[MediaRead.model_validate(item) for item in media],
    )


@app.get("/map/incidents", response_model=list[MapIncidentRead])
def map_incidents(db: Session = Depends(get_db)):
    """Return map-ready markers for every incident not yet resolved."""
    incidents = db.scalars(
        select(Incident).where(Incident.responder_state != "RESOLVED")
    ).all()
    return [MapIncidentRead.model_validate(incident) for incident in incidents]


def _apply_state(id: str, db: Session, state: str) -> ActionRead:
    try:
        incident = set_responder_state(db, id, state)
    except LookupError:
        raise HTTPException(status_code=404, detail="Incident not found") from None
    except ValueError as exc:
        raise HTTPException(status_code=409, detail=str(exc)) from exc
    db.commit()
    return ActionRead(
        incident_id=id,
        responder_state=incident.responder_state,
        stub=False,
        message=f"Responder state updated to {incident.responder_state}.",
    )


@app.post("/incidents/{id}/acknowledge", response_model=ActionRead)
def acknowledge_incident(id: str, db: Session = Depends(get_db)):
    """Acknowledge an incident, moving it out of UNACKNOWLEDGED."""
    return _apply_state(id, db, "ACKNOWLEDGED")


@app.post("/incidents/{id}/dispatch", response_model=ActionRead)
def dispatch_incident(id: str, db: Session = Depends(get_db)):
    """Record that responders have been dispatched to an incident."""
    return _apply_state(id, db, "DISPATCHED")


@app.post("/incidents/{id}/resolve", response_model=ActionRead)
def resolve_incident(id: str, db: Session = Depends(get_db)):
    """Mark an incident resolved."""
    return _apply_state(id, db, "RESOLVED")


@app.post("/pipeline/run", tags=["system"])
def trigger_pipeline_run(db: Session = Depends(get_db)):
    """Re-run extraction/geolocation/clustering/scoring over all stored reports.

    Useful after bulk-loading a dataset, or to re-derive incidents once new
    extraction rules or scoring weights are in place.
    """
    result = run_pipeline(db)
    db.commit()
    return result.as_dict()
