# Crowdsourced Disaster Intelligence System

A FastAPI backend skeleton for turning citizen reports into responder-ready disaster incidents. The repository currently defines the SQLite data model, validated API contracts, route stubs, and realistic seed data. Incident processing and clustering logic can be added behind these interfaces later.

## Project structure

```text
.
├── app/
│   ├── __init__.py
│   ├── db.py          # SQLite engine, sessions, and table initialization
│   ├── main.py        # FastAPI application and route stubs
│   ├── models.py      # SQLAlchemy table models
│   ├── schemas.py     # Pydantic request and response schemas
│   └── seed.py        # Idempotent demo-data seed
├── data/              # Local SQLite database (ignored by Git)
├── tests/             # API smoke tests
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

## Development checks

```bash
ruff check .
pytest
```

GitHub Actions runs both checks on every push and pull request.

## Roadmap

- Persist and enrich incoming citizen reports
- Cluster related reports into incidents
- Add geolocation, confidence, and severity scoring
- Detect duplicate media using perceptual hashes
- Implement responder state transitions
