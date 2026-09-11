"""End-to-end pipeline wiring every processing stage to the database.

    reports ─▶ extraction ─▶ geolocation ─▶ clustering ─▶ corroboration
                                                             │
            incidents ◀─ persistence ◀─ scoring ◀────────────┘

`run_pipeline` is idempotent: it reuses stored extractions and media hashes,
re-derives clusters from every resolvable report, and upserts the resulting
incidents so an incident keeps its ID, its responder state, and its responder
timeline entries across runs.

Stage ownership:
  * app.extraction / app.offline_extraction - relevance + structured facts
  * app.geolocation                         - GPS, landmark, nearby inference
  * app.cluster                             - distance/time/type clustering
  * app.corroboration                       - pHash dedup, witness counting
  * app.scoring                             - confidence, severity, priority
"""

from __future__ import annotations

import argparse
import json
import logging
import os
import re
from collections import Counter
from dataclasses import dataclass, field
from datetime import UTC, datetime
from pathlib import Path
from typing import Any
from uuid import uuid4

from sqlalchemy import delete, select
from sqlalchemy.orm import Session

from app.cluster import cluster_reports, haversine
from app.corroboration import (
    KNOWN_OLD_HASHES,
    calculate_corroboration,
    compute_phash,
    is_duplicate,
)
from app.db import SessionLocal, init_db
from app.extraction import ExtractedReport, filter_and_extract
from app.geolocation import resolve_all
from app.models import Incident, IncidentReport, Media, Report
from app.offline_extraction import heuristic_extract
from app.scoring import (
    aggregate_victim_count,
    calculate_confidence,
    calculate_severity,
    get_action_priority,
)
from app.verification import check_external_verification

logger = logging.getLogger(__name__)

PROJECT_ROOT = Path(__file__).resolve().parents[1]

# Geographic agreement decays linearly with each report's distance from the
# cluster centroid and reaches zero at this range.
GEO_AGREEMENT_SCALE_M = 500.0

# Verified historical image hashes; see scripts/generate_demo_media.py.
KNOWN_HASHES_FILE = Path("data") / "known_old_hashes.json"

# A cluster is only called CORROBORATED with this many independent witnesses.
CORROBORATION_MIN_SOURCES = 3

# Resources that should lead the responder-facing priority list.
URGENT_RESOURCES = (
    "rescue_boat",
    "medical_evac",
    "ambulance",
    "fire_engine",
    "life_jackets",
)

HAZARD_LABELS = {
    "FLOOD": "Flooding",
    "FIRE": "Fire",
    "COLLAPSE": "Structural collapse",
    "OTHER": "Hazard",
}

# A denial of the cluster's own claim. Detected on text only; it lowers
# confidence and flags the incident for a scout, it does not decide the truth.
CONTRADICTION_PATTERN = re.compile(
    r"\b(not\s+collaps\w*|has\s+not\s+collaps\w*|did\s+not\s+collapse|"
    r"no\s+(?:flood\w*|fire|collapse|damage)\b|is\s+fine\b|are\s+fine\b|"
    r"false\s+alarm|rumou?r|fake\s+news|nothing\s+happened|"
    r"only\s+waterlogged|safe\s+and\s+intact)\b",
    re.IGNORECASE,
)

# Responder-authored timeline entries survive re-derivation of an incident.
RESPONDER_EVENT_PREFIX = "Responder"

RESPONDER_ORDER = {
    "UNACKNOWLEDGED": 0,
    "ACKNOWLEDGED": 1,
    "DISPATCHED": 2,
    "RESOLVED": 3,
}

_UNSET = object()
_CLIENT_CACHE: list[Any] = []


@dataclass
class PipelineResult:
    """Counters describing one full pipeline run."""

    reports_total: int = 0
    reports_extracted: int = 0
    reports_relevant: int = 0
    reports_located: int = 0
    media_hashed: int = 0
    clusters: int = 0
    incidents_created: list[str] = field(default_factory=list)
    incidents_updated: list[str] = field(default_factory=list)
    report_to_incident: dict[str, str] = field(default_factory=dict)

    def as_dict(self) -> dict[str, Any]:
        return {
            "reports_total": self.reports_total,
            "reports_extracted": self.reports_extracted,
            "reports_relevant": self.reports_relevant,
            "reports_located": self.reports_located,
            "media_hashed": self.media_hashed,
            "clusters": self.clusters,
            "incidents_created": self.incidents_created,
            "incidents_updated": self.incidents_updated,
        }


# ---------------------------------------------------------------------------
# Stage 1: extraction
# ---------------------------------------------------------------------------


def offline_extraction_forced() -> bool:
    return os.getenv("CDIS_OFFLINE_EXTRACTION", "").strip().lower() in (
        "1",
        "true",
        "yes",
        "on",
    )


def get_extraction_client():
    """Return a cached OpenAI-compatible client, or None to run offline.

    A missing key is a normal demo configuration, not an error: the pipeline
    then falls back to the deterministic keyword extractor.
    """
    if _CLIENT_CACHE:
        return _CLIENT_CACHE[0]
    client = None
    if not offline_extraction_forced():
        try:
            from app.extraction import _client_from_env

            client = _client_from_env()
        except Exception as exc:  # missing key, bad URL, SDK import failure
            logger.info(
                "LLM extraction unavailable (%s); using offline keyword rules",
                type(exc).__name__,
            )
    _CLIENT_CACHE.append(client)
    return client


def reset_extraction_client() -> None:
    """Drop the cached client so environment changes take effect."""
    _CLIENT_CACHE.clear()


def extract_one(report: dict, client) -> ExtractedReport:
    return filter_and_extract(report, client) if client else heuristic_extract(report)


def _has_extraction(extracted: Any) -> bool:
    return isinstance(extracted, dict) and "relevant" in extracted


def _extract_missing(session: Session, rows: list[Report], client) -> int:
    """Extract facts for rows that have none yet; store the result."""
    extracted = 0
    for row in rows:
        if _has_extraction(row.extracted_json):
            continue
        row.extracted_json = extract_one(_row_to_dict(row), client).model_dump(
            mode="json"
        )
        extracted += 1
    if extracted:
        session.flush()
    return extracted


# ---------------------------------------------------------------------------
# Stage 2: media hashing
# ---------------------------------------------------------------------------


def load_known_old_hashes() -> dict[str, str]:
    """Load verified historical image hashes into the corroboration registry.

    Defaults to data/known_old_hashes.json; override with CDIS_KNOWN_HASHES.
    A missing or malformed file simply leaves recycled-media detection off.
    """
    path = Path(os.getenv("CDIS_KNOWN_HASHES", PROJECT_ROOT / KNOWN_HASHES_FILE))
    try:
        entries = json.loads(path.read_text())
    except (OSError, ValueError):
        return KNOWN_OLD_HASHES
    if not isinstance(entries, dict):
        logger.warning("Ignoring %s: expected an object of source -> pHash", path)
        return KNOWN_OLD_HASHES
    for source, phash in entries.items():
        if isinstance(source, str) and isinstance(phash, str):
            KNOWN_OLD_HASHES[source] = phash
    return KNOWN_OLD_HASHES


def _local_media_path(media_url: str) -> Path | None:
    """Return a readable local path, or None for remote or missing media."""
    if "://" in media_url:
        return None
    path = Path(media_url)
    if not path.is_absolute():
        path = PROJECT_ROOT / path
    return path if path.is_file() else None


def _sync_media(session: Session, rows: list[Report]) -> dict[str, str]:
    """Hash new local media, link near-duplicates, and return report -> pHash."""
    stored = {
        media.report_id: media
        for media in session.scalars(select(Media).order_by(Media.id)).all()
    }
    hashes: dict[str, str] = {
        report_id: media.phash for report_id, media in stored.items()
    }
    for row in rows:
        if not row.media_url or row.id in stored:
            continue
        path = _local_media_path(row.media_url)
        if path is None:
            logger.info("Skipping unhashable media for %s: %s", row.id, row.media_url)
            continue
        try:
            phash = compute_phash(str(path))
        except Exception as exc:
            logger.warning("pHash failed for %s (%s)", row.id, type(exc).__name__)
            continue
        # Point at the earliest near-duplicate already on record so the
        # evidence view can show which upload is the original.
        original = next(
            (
                media.id
                for report_id, media in sorted(stored.items())
                if is_duplicate(phash, media.phash)
            ),
            None,
        )
        media = Media(
            id=f"med_{row.id}", report_id=row.id, phash=phash, is_duplicate_of=original
        )
        session.add(media)
        stored[row.id] = media
        hashes[row.id] = phash
    session.flush()
    return hashes


# ---------------------------------------------------------------------------
# Stage 4/5: evidence and scoring for one cluster
# ---------------------------------------------------------------------------


def _corroboration_view(report: dict, media_hashes: dict[str, str]) -> dict:
    """Hide media we could not hash so it is never counted as evidence."""
    if report.get("media_url") and not media_hashes.get(report["id"]):
        return {**report, "media_url": None}
    return report


def detect_contradiction(members: list[dict]) -> bool:
    """True when a cluster member explicitly denies the shared claim."""
    if len(members) < 2:
        return False
    return any(
        CONTRADICTION_PATTERN.search(member.get("raw_text") or "")
        for member in members
    )


def geo_agreement(cluster: dict, members: list[dict]) -> float:
    """Mean agreement in [0, 1]; decays to zero at GEO_AGREEMENT_SCALE_M."""
    if not members:
        return 0.0
    total = 0.0
    for member in members:
        distance = haversine(
            member["resolved_lat"],
            member["resolved_lon"],
            cluster["center_lat"],
            cluster["center_lon"],
        )
        total += max(0.0, 1.0 - distance / GEO_AGREEMENT_SCALE_M)
    return round(total / len(members), 4)


def build_evidence(
    cluster: dict,
    members: list[dict],
    media_hashes: dict[str, str],
    *,
    external_verification_hits: int | None = None,
) -> dict:
    """Corroboration counts plus the derived signals the scorer consumes."""
    views = [_corroboration_view(member, media_hashes) for member in members]
    evidence = calculate_corroboration(cluster, views, media_hashes)
    unique_images = evidence["unique_images"]
    recycled = evidence["recycled_media_detected"]
    fresh_ratio = (
        max(0.0, min(1.0, (unique_images - recycled) / unique_images))
        if unique_images
        else 0.0
    )
    evidence.update(
        {
            "geo_agreement": geo_agreement(cluster, members),
            "fresh_media_ratio": round(fresh_ratio, 4),
            # No external feed is wired in; None contributes zero confidence
            # rather than pretending an unchecked claim was verified.
            "external_verification_hits": external_verification_hits,
            "has_contradiction": detect_contradiction(members),
        }
    )
    return evidence


def _verification_status(evidence: dict, confidence: float) -> str:
    if evidence["has_contradiction"]:
        return "CONTRADICTED"
    if (
        evidence["independent_sources"] >= CORROBORATION_MIN_SOURCES
        and confidence >= 70.0
    ):
        return "CORROBORATED"
    return "DEVELOPING"


def _priority_resources(members: list[dict]) -> list[str]:
    counts: Counter[str] = Counter()
    for member in members:
        for resource in member["extracted_json"].get("resource_demands") or []:
            if isinstance(resource, str) and resource.strip():
                counts[resource.strip().lower()] += 1
    return sorted(
        counts,
        key=lambda name: (
            URGENT_RESOURCES.index(name) if name in URGENT_RESOURCES else len(
                URGENT_RESOURCES
            ),
            -counts[name],
            name,
        ),
    )


def _most_common_landmark(members: list[dict]) -> str | None:
    landmarks = Counter(
        member["extracted_json"].get("landmark")
        for member in members
        if member["extracted_json"].get("landmark")
    )
    return landmarks.most_common(1)[0][0] if landmarks else None


def _title(members: list[dict], event_type: str, trapped_total: int) -> str:
    label = HAZARD_LABELS.get(event_type, event_type.title())
    where = _most_common_landmark(members)
    headline = f"{label} near {where}" if where else f"{label} reported"
    if trapped_total:
        headline += f": {trapped_total} people reported trapped"
    return headline


def _derived_timeline(members: list[dict], evidence: dict, priority: str) -> list[dict]:
    times = sorted(member["timestamp"] for member in members)
    entries = [{"time": times[0], "event": "First citizen report received"}]
    if len(times) >= CORROBORATION_MIN_SOURCES:
        entries.append(
            {
                "time": times[CORROBORATION_MIN_SOURCES - 1],
                "event": (
                    f"{evidence['independent_sources']} independent sources; "
                    f"{evidence['total_reports']} reports linked"
                ),
            }
        )
    if evidence["has_contradiction"]:
        entries.append(
            {"time": times[-1], "event": "Conflicting report detected in cluster"}
        )
    if evidence["recycled_media_detected"]:
        entries.append(
            {
                "time": times[-1],
                "event": (
                    f"{evidence['recycled_media_detected']} reports carry recycled "
                    "media"
                ),
            }
        )
    entries.append({"time": times[-1], "event": f"Action priority set to {priority}"})
    return [
        {"time": _isoformat(entry["time"]), "event": entry["event"]}
        for entry in entries
    ]


def score_cluster(
    cluster: dict, members: list[dict], media_hashes: dict[str, str]
) -> dict:
    """Return every derived incident field for one cluster of reports."""
    external_hits = check_external_verification(
        cluster["event_type"], _most_common_landmark(members)
    )
    evidence = build_evidence(
        cluster, members, media_hashes, external_verification_hits=external_hits
    )
    confidence = calculate_confidence(evidence)
    severity = max(
        calculate_severity(member["extracted_json"]) for member in members
    )
    priority = get_action_priority(confidence, severity)
    victims = aggregate_victim_count(members)
    needs = {
        **victims,
        "priority_resources": _priority_resources(members),
    }
    return {
        "event_type": cluster["event_type"],
        "title": _title(
            members, cluster["event_type"], victims["estimated_trapped_total"]
        ),
        "center_lat": cluster["center_lat"],
        "center_lon": cluster["center_lon"],
        "uncertainty_radius_m": cluster["uncertainty_radius_m"],
        "severity_score": round(severity, 2),
        "confidence_score": round(confidence, 2),
        "verification_status": _verification_status(evidence, confidence),
        "action_priority": priority,
        "evidence_json": evidence,
        "aggregated_needs_json": needs,
        "timeline_json": _derived_timeline(members, evidence, priority),
    }


# ---------------------------------------------------------------------------
# Stage 6: persistence
# ---------------------------------------------------------------------------


def _isoformat(value: Any) -> str:
    if isinstance(value, datetime):
        return value.astimezone(UTC).isoformat()
    return str(value)


def _row_to_dict(row: Report) -> dict:
    return {
        "id": row.id,
        "source_user": row.source_user,
        "raw_text": row.raw_text,
        "media_url": row.media_url,
        "timestamp": row.timestamp,
        "gps_lat": row.gps_lat,
        "gps_lon": row.gps_lon,
        "extracted_json": row.extracted_json or {},
    }


def _match_existing_incident(
    session: Session, report_ids: list[str], taken: set[str]
) -> str | None:
    """Reuse the incident that already holds most of this cluster's reports.

    Cluster IDs are only stable within a batch, so identity has to come from
    report membership; otherwise every run would create duplicate incidents.
    """
    links = session.scalars(
        select(IncidentReport).where(IncidentReport.report_id.in_(report_ids))
    ).all()
    overlap = Counter(link.incident_id for link in links)
    for incident_id in sorted(overlap, key=lambda key: (-overlap[key], key)):
        if incident_id not in taken:
            return incident_id
    return None


def _next_incident_id(session: Session, taken: set[str]) -> str:
    highest = 0
    for existing in session.scalars(select(Incident.id)).all():
        match = re.fullmatch(r"INC_(\d+)", existing)
        if match:
            highest = max(highest, int(match.group(1)))
    for existing in taken:
        match = re.fullmatch(r"INC_(\d+)", existing)
        if match:
            highest = max(highest, int(match.group(1)))
    return f"INC_{highest + 1:03d}"


def _merge_timeline(existing: list, derived: list[dict]) -> list[dict]:
    """Keep responder-authored entries and re-derive everything else."""
    preserved = [
        entry
        for entry in existing or []
        if isinstance(entry, dict)
        and str(entry.get("event", "")).startswith(RESPONDER_EVENT_PREFIX)
    ]
    merged = derived + preserved
    return sorted(merged, key=lambda entry: (str(entry.get("time")), entry["event"]))


def _persist_incident(
    session: Session,
    incident_id: str,
    fields: dict,
    cluster: dict,
    members: list[dict],
) -> bool:
    """Upsert one incident and its report links. Returns True when created."""
    incident = session.get(Incident, incident_id)
    created = incident is None
    if created:
        incident = Incident(id=incident_id, responder_state="UNACKNOWLEDGED")
        session.add(incident)

    previous_timeline = [] if created else list(incident.timeline_json or [])
    for key, value in fields.items():
        setattr(incident, key, value)
    incident.timeline_json = _merge_timeline(previous_timeline, fields["timeline_json"])
    session.flush()

    member_ids = {member["id"] for member in members}
    session.execute(
        delete(IncidentReport)
        .where(IncidentReport.incident_id == incident_id)
        .where(IncidentReport.report_id.notin_(member_ids))
    )
    earliest = min(member["timestamp"] for member in members)
    for member in members:
        link = session.get(IncidentReport, (incident_id, member["id"]))
        distance = haversine(
            member["resolved_lat"],
            member["resolved_lon"],
            cluster["center_lat"],
            cluster["center_lon"],
        )
        delta = abs((member["timestamp"] - earliest).total_seconds())
        if link is None:
            session.add(
                IncidentReport(
                    incident_id=incident_id,
                    report_id=member["id"],
                    distance_m=round(distance, 2),
                    time_delta_s=round(delta, 2),
                )
            )
        else:
            link.distance_m = round(distance, 2)
            link.time_delta_s = round(delta, 2)
    session.flush()
    return created


# ---------------------------------------------------------------------------
# Orchestration
# ---------------------------------------------------------------------------


def run_pipeline(session: Session, *, client: Any = _UNSET) -> PipelineResult:
    """Process every stored report and upsert the incidents they support.

    Pass `client=None` to force the offline keyword extractor, or an
    OpenAI-compatible client to override provider auto-detection.
    """
    if client is _UNSET:
        client = get_extraction_client()

    result = PipelineResult()
    rows = session.scalars(
        select(Report).order_by(Report.timestamp, Report.id)
    ).all()
    result.reports_total = len(rows)
    if not rows:
        return result

    result.reports_extracted = _extract_missing(session, rows, client)
    load_known_old_hashes()
    media_hashes = _sync_media(session, rows)
    result.media_hashed = len(media_hashes)

    reports = [_row_to_dict(row) for row in rows]
    relevant = [
        report for report in reports if report["extracted_json"].get("relevant")
    ]
    result.reports_relevant = len(relevant)

    located = [
        location.to_report(report)
        for location, report in zip(resolve_all(relevant), relevant)
        if location.lat is not None
    ]
    result.reports_located = len(located)
    if not located:
        return result

    clusters = cluster_reports(located)
    result.clusters = len(clusters)
    by_id = {report["id"]: report for report in located}

    taken: set[str] = set()
    for cluster in clusters:
        members = [by_id[report_id] for report_id in cluster["report_ids"]]
        members.sort(key=lambda member: (member["timestamp"], member["id"]))
        fields = score_cluster(cluster, members, media_hashes)
        incident_id = _match_existing_incident(
            session, cluster["report_ids"], taken
        ) or _next_incident_id(session, taken)
        taken.add(incident_id)
        created = _persist_incident(session, incident_id, fields, cluster, members)
        (result.incidents_created if created else result.incidents_updated).append(
            incident_id
        )
        for member in members:
            result.report_to_incident[member["id"]] = incident_id

    session.flush()
    return result


def new_report_id() -> str:
    return f"rep_{uuid4().hex[:12]}"


def ingest_report(
    session: Session, payload, *, client: Any = _UNSET
) -> tuple[Report, str | None]:
    """Persist one citizen report, reprocess, and return it with its incident.

    `payload` is a `schemas.ReportCreate` or any object exposing the same
    fields. The returned incident ID is None when the report was filtered as
    noise or could not be located.
    """
    data = payload.model_dump() if hasattr(payload, "model_dump") else dict(payload)
    row = Report(
        id=data.get("id") or new_report_id(),
        source_user=data["source_user"],
        raw_text=data["raw_text"],
        media_url=data.get("media_url"),
        timestamp=data.get("timestamp") or datetime.now(UTC),
        gps_lat=data.get("gps_lat"),
        gps_lon=data.get("gps_lon"),
        extracted_json={},
    )
    session.add(row)
    session.flush()
    result = run_pipeline(session, client=client)
    session.commit()
    session.refresh(row)
    return row, result.report_to_incident.get(row.id)


def load_reports(session: Session, reports: list[dict]) -> int:
    """Insert dataset rows that are not stored yet; return the insert count."""
    existing = set(session.scalars(select(Report.id)).all())
    added = 0
    for report in reports:
        report_id = report.get("id") or new_report_id()
        if report_id in existing:
            continue
        timestamp = report.get("timestamp")
        if isinstance(timestamp, str):
            timestamp = datetime.fromisoformat(timestamp)
        if timestamp is None:
            timestamp = datetime.now(UTC)
        session.add(
            Report(
                id=report_id,
                source_user=report["source_user"],
                raw_text=report["raw_text"],
                media_url=report.get("media_url"),
                timestamp=timestamp,
                gps_lat=report.get("gps_lat"),
                gps_lon=report.get("gps_lon"),
                extracted_json=report.get("extracted_json") or {},
            )
        )
        existing.add(report_id)
        added += 1
    session.flush()
    return added


def set_responder_state(session: Session, incident_id: str, state: str) -> Incident:
    """Advance an incident's responder state and record it on the timeline."""
    if state not in RESPONDER_ORDER:
        raise ValueError(f"Unknown responder state: {state}")
    incident = session.get(Incident, incident_id)
    if incident is None:
        raise LookupError(incident_id)
    current = incident.responder_state or "UNACKNOWLEDGED"
    if RESPONDER_ORDER[state] < RESPONDER_ORDER[current]:
        raise ValueError(f"Cannot move from {current} back to {state}")
    if state != current:
        incident.responder_state = state
        incident.timeline_json = [
            *(incident.timeline_json or []),
            {
                "time": datetime.now(UTC).isoformat(),
                "event": f"{RESPONDER_EVENT_PREFIX} state changed to {state}",
            },
        ]
    session.flush()
    return incident


def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser(description=__doc__.splitlines()[0])
    parser.add_argument(
        "--load",
        metavar="PATH",
        help="JSON array of citizen reports to ingest before processing",
    )
    parser.add_argument(
        "--offline",
        action="store_true",
        help="Skip the LLM and use deterministic keyword extraction",
    )
    parser.add_argument("--json", action="store_true", help="Print the summary as JSON")
    args = parser.parse_args(argv)

    logging.basicConfig(level=logging.INFO, format="%(levelname)s %(message)s")
    init_db()
    client = None if args.offline else _UNSET
    with SessionLocal.begin() as session:
        if args.load:
            loaded = load_reports(session, json.loads(Path(args.load).read_text()))
            logger.info("Ingested %d new reports from %s", loaded, args.load)
        result = run_pipeline(session, client=client)
        incidents = session.scalars(
            select(Incident).order_by(Incident.id)
        ).all()
        summary = result.as_dict()
        rows = [
            (
                incident.id,
                incident.event_type,
                f"{incident.severity_score:.1f}",
                f"{incident.confidence_score:.1f}",
                incident.verification_status,
                incident.action_priority,
                incident.title,
            )
            for incident in incidents
        ]

    if args.json:
        print(json.dumps(summary, indent=2))
    else:
        print(json.dumps(summary, indent=2))
        print()
        print(f"{'ID':<9}{'TYPE':<10}{'SEV':<6}{'CONF':<7}{'STATUS':<14}{'PRIORITY':<19}TITLE")
        for row in rows:
            print(
                f"{row[0]:<9}{row[1]:<10}{row[2]:<6}{row[3]:<7}{row[4]:<14}"
                f"{row[5]:<19}{row[6]}"
            )
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
