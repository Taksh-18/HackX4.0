# Crowdsourced Disaster Intelligence System

A FastAPI backend for turning citizen reports into responder-ready disaster
incidents. It includes the SQLite data model, validated API contracts, route
stubs, extraction, geolocation, deterministic clustering, media corroboration,
scoring, realistic seed data, and offline regression tests.

## Project structure

```text
.
├── app/
│   ├── __init__.py
│   ├── cluster.py     # Deterministic distance/time/type clustering
│   ├── corroboration.py # pHash deduplication and witness counting
│   ├── db.py          # SQLite engine, sessions, and table initialization
│   ├── extraction.py  # Strict LLM relevance and fact extraction
│   ├── geolocation.py # GPS, landmark, and nearby location resolution
│   ├── main.py        # FastAPI application and route stubs
│   ├── models.py      # SQLAlchemy table models
│   ├── scoring.py     # Confidence, severity, priority, and victim totals
│   ├── schemas.py     # Pydantic request and response schemas
│   └── seed.py        # Idempotent demo-data seed
├── data/              # Dataset and local SQLite database
├── media/             # Local report images
├── scripts/           # Offline smoke-test utilities
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
python -m app.seed
uvicorn app.main:app --reload
```

On Windows PowerShell, activate the environment with:

```powershell
.venv\Scripts\Activate.ps1
```

The API is available at <http://127.0.0.1:8000>. Use the interactive documentation at <http://127.0.0.1:8000/docs>, or inspect the seeded incident at <http://127.0.0.1:8000/incidents/INC_042>.

## API surface

| Method | Path | Purpose |
| --- | --- | --- |
| `GET` | `/health` | Service health check |
| `POST` | `/reports` | Accept a citizen report |
| `GET` | `/incidents` | List incidents |
| `GET` | `/incidents/{id}` | Read an incident and its linked reports |
| `GET` | `/incidents/{id}/evidence` | Read an evidence breakdown |
| `GET` | `/map/incidents` | Return map-ready incident markers |
| `POST` | `/incidents/{id}/acknowledge` | Acknowledge an incident |
| `POST` | `/incidents/{id}/dispatch` | Dispatch responders |
| `POST` | `/incidents/{id}/resolve` | Resolve an incident |

Except for seeded incident lookup, routes intentionally return mock or empty data. This keeps the public API stable while clustering, scoring, and workflow logic are developed.

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

The dataset references four local files which must be supplied before media
hashing: `media/flood_scene_1.jpg`, `media/flood_scene_2.jpg`,
`media/bridge_incident.jpg`, and `media/reused_flood_image.jpg`.

## Development checks

```bash
ruff check .
pytest
```

GitHub Actions runs both checks on every push and pull request.

## Roadmap

- Persist and enrich incoming citizen reports
- Connect the completed processing modules to persistence and API routes
- Add cross-type contradiction detection after clustering
- Implement responder state transitions
