"""scripts/simulate_stream.py: immediate-mode replay against a live API."""

import importlib.util
import json
import threading
from pathlib import Path

import pytest
import uvicorn
from sqlalchemy.orm import sessionmaker

from app.db import Base, create_sqlite_engine, get_db
from app.main import app

SCRIPT_PATH = Path(__file__).resolve().parents[1] / "scripts" / "simulate_stream.py"


def _load_module():
    spec = importlib.util.spec_from_file_location("simulate_stream", SCRIPT_PATH)
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    return module


@pytest.fixture
def running_server(tmp_path, monkeypatch):
    """A real uvicorn server on a background thread, backed by a temp SQLite db."""
    engine = create_sqlite_engine(tmp_path / "stream_test.db")
    Base.metadata.create_all(engine)
    sessions = sessionmaker(bind=engine, expire_on_commit=False)
    monkeypatch.setattr("app.main.init_db", lambda: None)

    def test_db():
        with sessions() as session:
            yield session

    app.dependency_overrides[get_db] = test_db

    config = uvicorn.Config(app, host="127.0.0.1", port=0, log_level="error")
    server = uvicorn.Server(config)
    thread = threading.Thread(target=server.run, daemon=True)
    thread.start()
    while not server.started:
        pass
    port = server.servers[0].sockets[0].getsockname()[1]

    try:
        yield f"http://127.0.0.1:{port}"
    finally:
        server.should_exit = True
        thread.join(timeout=5)
        app.dependency_overrides.clear()
        engine.dispose()


def test_immediate_mode_submits_every_report(tmp_path, running_server):
    module = _load_module()
    dataset = tmp_path / "mini.json"
    dataset.write_text(
        json.dumps(
            [
                {
                    "id": "rep_sim_1",
                    "source_user": "@sim1",
                    "raw_text": "Three people trapped near Pillar 42, water rising.",
                    "media_url": None,
                    "timestamp": "2026-09-11T14:00:00+05:30",
                    "gps_lat": 28.6083,
                    "gps_lon": 77.2952,
                },
                {
                    "id": "rep_sim_2",
                    "source_user": "@sim2",
                    "raw_text": "Thoughts and prayers for everyone.",
                    "media_url": None,
                    "timestamp": "2026-09-11T14:01:00+05:30",
                    "gps_lat": None,
                    "gps_lon": None,
                },
            ]
        )
    )
    reports = module._load_reports(dataset)

    ok, failures = module.run(
        reports,
        api_url=running_server,
        delay=None,
        immediate=True,
        max_delay=5.0,
    )

    assert ok == 2
    assert failures == []


def test_run_reports_and_summarizes_failures_after_a_bad_url(tmp_path):
    module = _load_module()
    reports = [
        {
            "id": "rep_x",
            "source_user": "@x",
            "raw_text": "Fire near the market.",
            "timestamp": "2026-09-11T14:00:00+05:30",
        }
    ]
    ok, failures = module.run(
        reports,
        api_url="http://127.0.0.1:1",  # nothing listens here
        delay=None,
        immediate=True,
        max_delay=5.0,
    )
    assert ok == 0
    assert len(failures) == 1
