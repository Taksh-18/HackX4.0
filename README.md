# Crowdsourced Disaster Intelligence System

CDIS turns citizen disaster reports into clustered, scored incidents for
responders. The repository contains a FastAPI and SQLite processing pipeline
plus a React dashboard with separate citizen and responder views.

```text
citizen report → extraction → geolocation → clustering → corroboration → scoring
                                                                       ↓
React citizen view ← FastAPI + SQLite → responder feed, map, and evidence
```

## Project structure

```text
app/                     FastAPI routes, database, and processing pipeline
data/                    Synthetic 50-report scenario and local data files
media/                   Four checked-in demo images; uploads are ignored
scripts/                 Dataset and media utilities
src/                     React + TypeScript frontend
tests/                   Offline unit, API, and pipeline tests
```

## Run locally

Python 3.11 and a recent Node.js release are required.

```bash
python3.11 -m venv .venv
source .venv/bin/activate
python -m pip install -e ".[dev]"
python -m app.seed
uvicorn app.main:app --reload
```

In a second terminal:

```bash
npm install
npm run dev
```

Open the URL printed by Vite. During development, Vite proxies `/api` to
`http://127.0.0.1:8000`, so reports, media, incidents, and responder actions are
stored by FastAPI. Set `VITE_API_BASE_URL` when the API lives at another origin.

For a deterministic demo without an LLM key or network geocoder:

```bash
export CDIS_OFFLINE_EXTRACTION=1
export CDIS_OFFLINE_GEOCODE=1
```

## Main routes

| Audience | Routes |
| --- | --- |
| Citizen | `/`, `/map`, `/report`, `/reports`, `/incidents/:id` |
| Responder | `/responder`, `/responder/map`, `/responder/feed`, `/responder/reports`, `/responder/analytics`, `/responder/settings` |

The role switch is a hackathon demonstration control stored in local storage.
It is not authentication; production authorization must be enforced by the
backend.

The API is documented at `http://127.0.0.1:8000/docs`. Important endpoints are:

- `POST /reports` and `GET /reports`
- `POST /media` for one validated JPEG, PNG, or WebP image up to 10 MB
- `GET /incidents?status=active|resolved|all`
- `GET /incidents/{id}` and `/incidents/{id}/evidence`
- `POST /incidents/{id}/acknowledge|dispatch|resolve`

## Verify

```bash
npm run build
npm run lint
pytest
ruff check .
```

The pipeline and tests default to offline operation. Responder state moves only
forward: `UNACKNOWLEDGED → ACKNOWLEDGED → DISPATCHED → RESOLVED`; invalid
regressions return HTTP 409.
