"""FastAPI application wiring the API surface to the processing pipeline.

Every route below reads or writes through `app.pipeline`, which is the single
place extraction, geolocation, clustering, corroboration, and scoring are
connected together (see that module's docstring for the stage diagram).
"""

import io
import uuid
from contextlib import asynccontextmanager
from datetime import UTC, datetime
from pathlib import Path
from typing import Literal

from fastapi import Depends, FastAPI, File, HTTPException, UploadFile
from fastapi.staticfiles import StaticFiles
from PIL import Image
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.db import get_db, init_db
from app.image_analysis import MAX_IMAGE_BYTES, SUPPORTED_EXTENSIONS
from app.models import Incident, Media
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

MEDIA_DIR = Path(__file__).resolve().parents[1] / "media"


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
app.mount("/dashboard", StaticFiles(directory=STATIC_DIR, html=True), name="dashboard")


@app.get("/health", tags=["system"])
def health_check():
    return {"status": "ok"}


@app.post("/media", response_model=MediaUploadRead, tags=["media"])
async def upload_media(file: UploadFile = File(...)):
    """Save an uploaded image to disk and return a `media_url` for `POST /reports`.

    This is what actually makes citizen-submitted photos hashable and
    analyzable: without it, a report's `media_url` is just a filename the
    backend can't read, and the media pipeline silently skips it. Applies
    the same format/size/readability checks `app.image_analysis` uses
    before ever touching a vision model.
    """
    suffix = Path(file.filename or "").suffix.lower()
    if suffix not in SUPPORTED_EXTENSIONS:
        raise HTTPException(
            status_code=400,
            detail=f"Unsupported file type: {suffix or 'unknown'}. "
            f"Use one of: {', '.join(sorted(SUPPORTED_EXTENSIONS))}",
        )

    data = await file.read()
    if not data:
        raise HTTPException(status_code=400, detail="Empty file")
    if len(data) > MAX_IMAGE_BYTES:
        raise HTTPException(
            status_code=400,
            detail=f"File too large (max {MAX_IMAGE_BYTES // (1024 * 1024)} MB)",
        )

    try:
        with Image.open(io.BytesIO(data)) as image:
            image.verify()
    except Exception as exc:
        raise HTTPException(
            status_code=400, detail="File is not a readable image"
        ) from exc

    MEDIA_DIR.mkdir(parents=True, exist_ok=True)
    filename = f"upload_{uuid.uuid4().hex[:16]}{suffix}"
    (MEDIA_DIR / filename).write_bytes(data)

    return MediaUploadRead(media_url=f"media/{filename}")


@app.post("/reports", response_model=ReportRead)
def create_report(payload: ReportCreate, db: Session = Depends(get_db)):
    """Persist a citizen report and run the full pipeline against it.

    The response reflects this report's own extracted facts immediately;
    whether it was folded into a new or existing incident is visible via
    `GET /incidents` right after this call returns.
    """
    report, _incident_id = ingest_report(db, payload)
    return ReportRead.model_validate(report)


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


@app.get("/incidents/updates", response_model=list[IncidentRead])
def incidents_updates(since: datetime, db: Session = Depends(get_db)):
    """Poll for incidents changed since `since` (ISO 8601, e.g. `2026-09-11T12:00Z`).

    A dependency-free alternative to a websocket/SSE stream for
    this single-process demo: a client re-polls with the newest `updated_at`
    it has already seen. `updated_at` is set on every pipeline (re)computation
    of an incident and on every responder-state change, so this catches both
    newly created incidents and re-scored or re-acknowledged existing ones.
    Declared ahead of `/incidents/{id}` so the literal path wins the match.
    """
    if since.tzinfo is None:
        since = since.replace(tzinfo=UTC)
    incidents = db.scalars(
        select(Incident)
        .where(Incident.updated_at.isnot(None))
        .where(Incident.updated_at >= since)
        .order_by(Incident.updated_at.desc())
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
