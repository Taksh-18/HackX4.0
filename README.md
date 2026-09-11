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

## Problem-statement compliance

The demo scenario is an urban flash flood in Mayur Vihar Phase 1, Delhi
(`data/simulated_reports.json`, 50 synthetic citizen/social reports). This
maps each required capability to what actually runs, and is explicit about
what is heuristic rather than proven:

| PS requirement | Status | What actually implements it |
| --- | --- | --- |
| Relevance filtering | **Implemented** | `app/extraction.py` (LLM) or `app/offline_extraction.py` (deterministic keyword rules) — both produce the same `ExtractedReport` contract |
| Geolocation without explicit GPS | **Implemented** | `app/geolocation.py`: GPS → landmark geocoding (local Mayur Vihar gazetteer, optional Nominatim) → nearby-report inference |
| Image analysis — duplicate/reused detection | **Implemented** | `app/corroboration.py`: pHash + Hamming distance, `data/known_old_hashes.json` registry |
| Image analysis — visual damage assessment | **Implemented, optional** | `app/image_analysis.py`: vision-LLM content analysis (hazard type, visible damage, people-at-risk framing, supports/conflicts with the text). Requires a vision-capable provider; degrades to `analyzed=false` otherwise — see [Image-content analysis](#image-content-analysis-optional) |
| Corroboration via independent reports | **Implemented, estimated** | `app/corroboration.py` witness counting (usernames, explicit repost attribution, image similarity) — see [Independent-source estimation](#independent-source-estimation) for the honest caveat |
| Misinformation detection | **Implemented, heuristic** | `app/pipeline.py::detect_contradiction` / `build_contradiction_groups` (explicit denials) + `app/misinformation.py` (bounded, explainable risk score). See [Misinformation risk vs. proof of falsehood](#misinformation-risk-vs-proof-of-falsehood) |
| Operational output (prioritized feed) | **Implemented** | `GET /incidents` sorted by severity, `action_priority` (CRITICAL_DISPATCH/DEPLOY_SCOUT/MONITOR/SUPPRESSED), `/dashboard/` |
| Bonus: transparent confidence layer | **Implemented** | `confidence_score` plus `evidence_json.confidence_breakdown` (named weighted components) on every incident |
| High-volume ingestion (social connectors, queues) | **Out of scope, simulated** | `scripts/simulate_stream.py` replays the dataset against `POST /reports`; no real platform connectors, queues, or workers (deliberately, per hackathon scope) |
| Real-time streaming to clients | **Polling, not streaming** | `GET /incidents/updates?since=` — see [Polling for updates](#polling-for-incident-updates) |



## Project structure

```text
.
├── app/
│   ├── __init__.py
│   ├── cluster.py             # Deterministic distance/time/type clustering
│   ├── corroboration.py       # pHash deduplication and witness counting
│   ├── db.py                  # SQLite engine, sessions, and table initialization
│   ├── dedup.py                # Deterministic duplicate/near-duplicate report-text grouping
│   ├── extraction.py          # Strict LLM relevance and fact extraction
│   ├── offline_extraction.py  # Deterministic keyword extraction (no API key needed)
│   ├── geolocation.py         # GPS, landmark, and nearby location resolution
│   ├── image_analysis.py       # Vision-based image-CONTENT analysis (optional, capped, cached)
│   ├── misinformation.py       # Deterministic, explainable misinformation-risk scoring
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
├── scripts/           # Offline smoke-test, demo-data, and stream-simulator utilities
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
| `GET` | `/incidents/updates` | Poll for incidents changed at/after `?since=<ISO8601>` |
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

## Image-content analysis (optional)

`app/image_analysis.py` is separate from `app/corroboration.py`'s perceptual
hashing on purpose: pHash tells you two images are the same *bytes*, never
what is *in* them. When a vision-capable OpenAI-compatible provider is
configured, this module looks at a photo's actual content — apparent hazard
type, visible damage, whether people appear at risk, and whether the image
supports or conflicts with its report's own text (treated throughout as an
**untrusted claim**, not ground truth).

It is capped and safe by design:

- Local JPEG/PNG/WebP only, ≤ 8 MB (`MAX_IMAGE_BYTES`); remote URLs are never fetched.
- Results are cached by pHash, so one physical image (including an explicit
  repost) is analyzed **at most once**, no matter how many reports reference it.
- It never infers an exact victim count from a photo, never performs facial
  recognition or identifies anyone, and only names an image as possibly
  manipulated when the image itself shows a describable inconsistency.
- Every failure mode — no provider configured, offline mode forced, missing
  file, unsupported/oversized/corrupt file, API failure, schema-invalid
  output — returns a safe `analyzed: false` result and never raises into the
  pipeline.

Enable it the same way as extraction (same client, `CDIS_VISION_MODEL` to
override the model):

```bash
export GROQ_API_KEY=...           # or OPENAI_API_KEY
export CDIS_VISION_MODEL=gpt-4o-mini   # optional override
```

Set `CDIS_OFFLINE_IMAGE_ANALYSIS=1` to force it off (this is always set in
tests — no test run ever calls a vision model). With no provider configured
and the flag unset, it also degrades to `analyzed: false` automatically.

**How it feeds scoring (deliberately narrow):** a supporting, high-confidence
image raises `fresh_media_ratio` the same way "not recycled" already does; a
conflicting image lowers it and adds an `image_text_mismatch` signal to the
misinformation assessment. It does **not** adjust `severity_score` — that
would touch `app.scoring.calculate_severity`'s well-tested contract, which
this change deliberately left alone. Recycled/old images are excluded from
positive signal entirely, and one unique image (by pHash) can only ever
count once, even across several reports that reused it.

## Misinformation risk vs. proof of falsehood

`app/misinformation.py` computes a **deterministic, explainable risk
estimate** — never a determination of truth. `proven_false` is hard-coded to
`False` in every code path; nothing in this codebase can set it otherwise,
because nothing here is a verification workflow.

The score sums bounded, individually named weights for whichever signals
actually fire (see `_WEIGHTS` in that module): an explicit contradiction, a
recycled image, an image that conflicts with its own report's text, reports
concentrating into very few distinct text origins, a low independent-source
ratio, weak geographic agreement, and a report that itself labels another
claim a rumour. Every signal that fires is named in `signals`, so a `HIGH`
risk_level always has a one-line answer per contributing signal. Risk score
is **not** subtracted from `confidence_score` anywhere — the two are kept
conceptually and numerically separate, on the view that conflating "how
strong is the evidence" with "how much does this look like it might be
misleading" makes both harder to explain.

Structured contradiction detection (`app/pipeline.py::build_contradiction_groups`)
groups a cluster's members by their *exact extracted landmark text* and
splits each group into reports affirming vs. explicitly denying the same
claim — the finer-grained view behind the single `has_contradiction`
boolean. A word like "rumour" appearing in one report is tracked as its own
weaker, separate `labeled_rumour` signal; it does not by itself flip
`verification_status` to `CONTRADICTED` (only an explicit denial pattern
does, via the original `CONTRADICTION_PATTERN` regex, unchanged). A known
limitation: because grouping is by *exact* landmark string, a denial
extracted with a differently worded landmark than its affirming reports
will not automatically join their contradiction group.

## Duplicate and near-duplicate report text

`app/dedup.py` normalizes report text (lowercased, repost prefixes/URLs/
@mentions/punctuation stripped) and groups exact or near-identical reports
transitively using `difflib.SequenceMatcher` at a conservative 0.85
similarity threshold, standard library only. This is a **transparency and
misinformation-risk signal**, not a witness-counting mechanism —
`app.corroboration`'s independent-source counting is left untouched and
still owns that number. Two reports about the same landmark are never
merged just because they share words; only near-identical wording is.

## Independent-source estimation

A unique `source_user` does not guarantee a unique human witness, and this
system does not pretend otherwise. `evidence_json.limitations` says so
explicitly on every incident: *"independent_sources is an estimate from
usernames, explicit repost attribution, and image similarity — not verified
unique-human identity."* Treat `independent_sources` as a lower-bound
estimate, not a certified headcount.

## Polling for incident updates

`GET /incidents/updates?since=<ISO8601>` returns every incident whose
`updated_at` is at or after the supplied timestamp — set on every pipeline
(re)computation of an incident and on every responder-state change. This is
the chosen lightweight alternative to a websocket/SSE stream for a
single-process demo: a client re-polls with the newest `updated_at` it has
already seen.

```bash
curl "http://127.0.0.1:8000/incidents/updates?since=2026-09-11T14:00:00Z"
```

`updated_at` is `null` for incidents persisted before this column existed;
`db.py` adds the column to an existing database automatically and
non-destructively (see below) rather than requiring a fresh database.

## Simulating a report stream

`scripts/simulate_stream.py` stands in for the social-platform ingestion
connectors that are explicitly out of scope for this hackathon: it replays
`data/simulated_reports.json` against a running API, one `POST /reports`
per report.

```bash
uvicorn app.main:app &
python scripts/simulate_stream.py --api-url http://127.0.0.1:8000 --delay 0.5
python scripts/simulate_stream.py --immediate          # as fast as possible
python scripts/simulate_stream.py --shuffle --seed 7   # deterministic out-of-order replay
```

It preserves the dataset's own timestamps by default (capped by
`--max-delay`), continues past a failed submission, and prints a summary of
any failures at the end.

## Reddit connector (built, not live)

`scripts/reddit_connector.py` is a real, working ingestion connector: it
searches a configurable list of subreddits for disaster-keyword posts,
uploads any attached image through `POST /media`, and submits each post
through the normal `POST /reports` pipeline — same code path as any citizen
report.

**It is intentionally not run against live Reddit data.** Reddit's
[Responsible Builder
Policy](https://support.reddithelp.com/hc/en-us/articles/42728983564564-Responsible-Builder-Policy)
requires **explicit prior approval before any API data access**, and
separately restricts using Reddit data for "mining... or... to train
machine learning or AI models" — broad enough to plausibly cover this
pipeline's LLM-based extraction step, even though that's inference, not
training. Given "zero tolerance" enforcement language (token revocation,
account suspension), this repo does not run the connector against real
Reddit data without that approval in hand. The code, and its tests
(`tests/test_reddit_connector.py`), exist to demonstrate the integration is
built and understood, not to circumvent the policy.

## Database compatibility

There is no migration framework here (SQLite, single file, hackathon
scope). `app/db.py::init_db()` runs `Base.metadata.create_all` (safe/
idempotent for new tables) and then an additive, idempotent column check
(`_ensure_columns`) that adds any column introduced after the initial schema
— currently `media.analysis_json` and `incidents.updated_at` — to an
existing database via `ALTER TABLE ... ADD COLUMN`. It never drops, renames,
or rewrites existing data, and running it against an already-migrated or a
brand-new database is a no-op beyond the check itself.

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
- Replace `/incidents/updates` polling with an SSE or websocket push stream
- Widen `app/geolocation.py`'s landmark gazetteer beyond Mayur Vihar for other scenarios
- Fuzzy (not exact-string) landmark matching in `build_contradiction_groups`
- A real ingestion connector to replace `scripts/simulate_stream.py`'s local replay
