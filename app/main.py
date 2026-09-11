from contextlib import asynccontextmanager
from typing import Literal
from uuid import uuid4

from fastapi import Depends, FastAPI, HTTPException
from sqlalchemy.orm import Session

from app.db import get_db, init_db
from app.models import Incident
from app.schemas import (
    ActionRead,
    EvidenceRead,
    IncidentDetailRead,
    IncidentRead,
    MapIncidentRead,
    ReportCreate,
    ReportRead,
)


@asynccontextmanager
async def lifespan(app: FastAPI):
    init_db()
    yield


app = FastAPI(
    title="Crowdsourced Disaster Intelligence System",
    description="API skeleton for crowdsourced disaster reports and incidents.",
    version="0.1.0",
    lifespan=lifespan,
)


@app.get("/health", tags=["system"])
def health_check():
    return {"status": "ok"}


@app.post("/reports", response_model=ReportRead)
def create_report(payload: ReportCreate):
    """Stub: return a mock report without persisting or processing it."""
    return ReportRead(id=f"rep_{uuid4().hex[:12]}", **payload.model_dump())


@app.get("/incidents", response_model=list[IncidentRead])
def list_incidents(status: Literal["active", "resolved", "all"] = "active"):
    """Stub: status filtering and incident listing will be plugged in later."""
    return []


@app.get("/incidents/{id}", response_model=IncidentDetailRead)
def get_incident(id: str, db: Session = Depends(get_db)):
    """Minimal DB read so the seeded incident and linked reports are inspectable."""
    incident = db.get(Incident, id)
    if incident is None:
        raise HTTPException(status_code=404, detail="Incident not found")
    return IncidentDetailRead.model_validate(incident)


@app.get("/incidents/{id}/evidence", response_model=EvidenceRead)
def get_evidence(id: str):
    """Stub: return an empty evidence breakdown."""
    return EvidenceRead(incident_id=id)


@app.get("/map/incidents", response_model=list[MapIncidentRead])
def map_incidents():
    """Stub: map data will be plugged in later."""
    return []


@app.post("/incidents/{id}/acknowledge", response_model=ActionRead)
def acknowledge_incident(id: str):
    """Stub: echo the requested state without updating the database."""
    return ActionRead(incident_id=id, responder_state="ACKNOWLEDGED")


@app.post("/incidents/{id}/dispatch", response_model=ActionRead)
def dispatch_incident(id: str):
    """Stub: echo the requested state without updating the database."""
    return ActionRead(incident_id=id, responder_state="DISPATCHED")


@app.post("/incidents/{id}/resolve", response_model=ActionRead)
def resolve_incident(id: str):
    """Stub: echo the requested state without updating the database."""
    return ActionRead(incident_id=id, responder_state="RESOLVED")
