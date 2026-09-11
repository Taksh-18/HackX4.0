# Crowdsourced Disaster Intelligence System

A FastAPI backend for turning citizen reports into responder-ready disaster
incidents. Every API route is now backed by one pipeline that connects
extraction, geolocation, deterministic clustering, media corroboration, and
scoring straight through to the SQLite data model:

```text
citizen reports ──▶ extraction ──▶ geolocation ──▶ clustering ──▶ corroboration
                                                                        │
                     incidents ◀── persistence ◀── scoring ◀───────────┘
```

`app/pipeline.py` is the module that wires this together. It is idempotent:
re-running it (after loading more reports, or on a schedule) reuses stored
extractions and media hashes, re-derives clusters from every resolvable
report, and upserts incidents in place — an incident keeps its ID, its
responder state, and any responder-authored timeline entries across runs.

## Project structure

```text
.
├── app/
│   ├── __init__.py
│   ├── cluster.py             # Deterministic distance/time/type clustering
│   ├── corroboration.py       # pHash deduplication and witness counting
│   ├── db.py                  # SQLite engine, sessions, and table initialization
│   ├── extraction.py          # Strict LLM relevance and fact extraction
│   ├── offline_extraction.py  # Deterministic keyword extraction (no API key needed)
│   ├── geolocation.py         # GPS, landmark, and nearby location resolution
│   ├── pipeline.py            # Orchestrates every stage end to end; API entry points
│   ├── verification.py        # Optional external-verification lookup (fails gracefully)
│   ├── main.py                # FastAPI application and routes
│   ├── models.py              # SQLAlchemy table models
│   ├── scoring.py             # Confidence, severity, priority, and victim totals
│   ├── schemas.py             # Pydantic request and response schemas
│   ├── seed.py                # Idempotent demo-data seed
│   └── static/index.html      # Responder dashboard (feed, map, evidence drawer, actions)
├── data/              # Dataset, geocode cache, known-image-hash registry, and the SQLite database
├── media/             # Local report images (generate with scripts/generate_demo_media.py)
├── scripts/           # Offline smoke-test and demo-data utilities
├── tests/             # Unit, API, and offline pipeline contract tests
├── .github/workflows/ # GitHub Actions checks
├── .env.example
├── .gitignore
└── pyproject.toml
```

## Quick start

Python 3.11 or newer is required.

```bash
python -m venv .venv
source .venv/bin/activate
python -m pip install -e ".[dev]"
python scripts/generate_demo_media.py   # synthetic images the dataset references
python -m app.seed
uvicorn app.main:app --reload
```

On Windows PowerShell, activate the environment with:

```powershell
.venv\Scripts\Activate.ps1
```

The API is available at <http://127.0.0.1:8000>. Use the interactive documentation at <http://127.0.0.1:8000/docs>, inspect the seeded incident at <http://127.0.0.1:8000/incidents/INC_042>, or open the responder dashboard at <http://127.0.0.1:8000/dashboard/>.

To see the pipeline turn the bundled 50-report scenario into incidents from the command line:

```bash
export CDIS_OFFLINE_GEOCODE=1
python -m app.pipeline --load data/simulated_reports.json --offline
```

Drop `--offline` once an LLM provider key is configured (see Configuration) to
use real relevance filtering and fact extraction instead of the keyword
fallback.

## API surface

| Method | Path | Purpose |
| --- | --- | --- |
| `GET` | `/health` | Service health check |
| `POST` | `/reports` | Persist a citizen report and run the pipeline against it |
| `GET` | `/incidents` | List incidents (`?status=active\|resolved\|all`) |
| `GET` | `/incidents/{id}` | Read an incident and its linked reports |
| `GET` | `/incidents/{id}/evidence` | Read an evidence breakdown, linked reports, and media |
| `GET` | `/map/incidents` | Return map-ready markers for unresolved incidents |
| `POST` | `/incidents/{id}/acknowledge` | Acknowledge an incident |
| `POST` | `/incidents/{id}/dispatch` | Dispatch responders |
| `POST` | `/incidents/{id}/resolve` | Resolve an incident |
| `POST` | `/pipeline/run` | Re-run the full pipeline over every stored report |
| `GET` | `/dashboard/` | The responder dashboard (static; talks to the API above) |

Responder state only moves forward (`UNACKNOWLEDGED → ACKNOWLEDGED → DISPATCHED
→ RESOLVED`); a request that would move it backwards returns `409`. A missing
incident ID returns `404`. Posting a new report re-derives every incident's
scoring from the accumulated evidence, so submitting more reports can change
an existing incident's severity, confidence, or priority as corroboration
strengthens or a contradiction appears.

## Configuration

The application writes to `data/disaster.db` by default. Set `DISASTER_DB_PATH` to use another SQLite file:

```bash
export DISASTER_DB_PATH=/absolute/path/to/disaster.db
```

Tables are created automatically at application startup. Running `python -m app.seed` multiple times is safe.

LLM extraction supports OpenAI, Groq, or another OpenAI-compatible endpoint.
Copy `.env.example` values into your shell environment and set the matching API
key. Geolocation uses the local Mayur Vihar gazetteer first; set
`CDIS_OFFLINE_GEOCODE=1` to prevent live Nominatim fallback during a demo.

When no LLM key is configured (or `CDIS_OFFLINE_EXTRACTION=1` is set), the
pipeline automatically falls back to `app/offline_extraction.py`, a
deterministic keyword extractor. It shares the same `ExtractedReport` contract
as the LLM path, so clustering, corroboration, and scoring behave identically
either way — this is what keeps the test suite and CI network-independent.

The dataset references four local media files. Generate synthetic
placeholders for them (and a matching recycled-media hash registry) with:

```bash
python scripts/generate_demo_media.py
```

This writes `media/flood_scene_1.jpg`, `media/flood_scene_2.jpg`,
`media/bridge_incident.jpg`, `media/reused_flood_image.jpg`, and
`data/known_old_hashes.json`. Add real verified historical images to that JSON
file (as `source -> pHash`) to flag other recycled uploads in a live demo.

## Responder dashboard

`app/static/index.html` is a single-file, dependency-free-to-build dashboard
(vanilla JS + Leaflet from a CDN, no build step) served straight off the
running API at `/dashboard/`. It gives a responder:

- an **incident feed** (left) ranked by severity, with active/resolved/all tabs;
- **map markers** (right) colored by action priority, sized to each incident's
  uncertainty radius;
- an **evidence drawer** that opens on click, showing the corroboration
  breakdown, the contradiction flag, every linked report and its media hash;
- the incident's **timeline**; and
- **Acknowledge / Dispatch / Resolve** buttons that call the responder-state
  endpoints directly and re-render on success (a backwards transition is
  rejected by the API and surfaced as a status message, not silently ignored).

It polls `/incidents` and `/map/incidents` every 8 seconds, so it picks up
incidents created or re-scored by new reports without a manual refresh.

## External verification (optional)

`app/verification.py` adds one more confidence signal on top of the working
core pipeline: it can query an external feed (a news search API, an official
disaster feed - anything reachable over HTTP that answers
`{"hits": <int>}`) for corroboration of a cluster's hazard near its landmark.

It is opt-in and off by default. Point it at a real endpoint with:

```bash
export CDIS_VERIFICATION_URL=https://your-verification-service.example/search
export CDIS_VERIFICATION_TIMEOUT_S=3.0   # optional, defaults to 3 seconds
```

Every failure mode - the feature disabled, no landmark to query, a timeout, a
connection error, a non-200 response, or a malformed body - degrades to `None`
rather than raising. `calculate_confidence` already treats a missing external
signal as contributing zero, so an unreachable verification service never
blocks or crashes the pipeline; it just means that one incident's confidence
score has one fewer corroborating signal until the service comes back.
`tests/test_verification.py` exercises each of these failure paths.

## Development checks

```bash
ruff check .
pytest
```

GitHub Actions runs both checks on every push and pull request. The test
suite (via `tests/conftest.py`) forces offline geocoding and offline
extraction for every test, so it never depends on network access or an API
key.

## Roadmap

- Point `CDIS_VERIFICATION_URL` at a real news/official disaster feed
- Add authentication and rate limiting ahead of a public-facing deployment
- Stream incident updates to connected clients instead of polling `/incidents`
