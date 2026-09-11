"""scripts/reddit_connector.py: the parts testable without live Reddit access."""

import importlib.util
import json
import sys
from pathlib import Path
from types import SimpleNamespace

import pytest

SCRIPT_PATH = Path(__file__).resolve().parents[1] / "scripts" / "reddit_connector.py"


def _load_module():
    spec = importlib.util.spec_from_file_location("reddit_connector", SCRIPT_PATH)
    module = importlib.util.module_from_spec(spec)
    # The module's @dataclass needs to resolve its module via sys.modules
    # (annotations are strings under `from __future__ import annotations`).
    sys.modules[spec.name] = module
    spec.loader.exec_module(module)
    return module


@pytest.fixture(scope="module")
def module():
    return _load_module()


def test_image_url_prefers_direct_image_link(module):
    submission = SimpleNamespace(url="https://i.redd.it/scene.jpg", preview=None)
    assert module._image_url(submission) == "https://i.redd.it/scene.jpg"


def test_image_url_falls_back_to_preview(module):
    submission = SimpleNamespace(
        url="https://reddit.com/r/india/comments/abc123",
        preview={"images": [{"source": {"url": "https://preview.redd.it/scene.jpg"}}]},
    )
    assert module._image_url(submission) == "https://preview.redd.it/scene.jpg"


def test_image_url_returns_none_for_non_image_link_post(module):
    submission = SimpleNamespace(
        url="https://reddit.com/r/india/comments/abc123", preview=None
    )
    assert module._image_url(submission) is None


def test_image_url_handles_malformed_preview_gracefully(module):
    submission = SimpleNamespace(url="https://example.com/post", preview={"images": []})
    assert module._image_url(submission) is None


def test_seen_ids_round_trip(module, tmp_path):
    path = tmp_path / "seen.json"
    assert module._load_seen_ids(path) == set()

    module._save_seen_ids(path, {"a1", "b2", "c3"})
    assert module._load_seen_ids(path) == {"a1", "b2", "c3"}


def test_seen_ids_missing_file_returns_empty_set(module, tmp_path):
    assert module._load_seen_ids(tmp_path / "does_not_exist.json") == set()


def test_seen_ids_corrupt_file_returns_empty_set_not_a_crash(module, tmp_path):
    path = tmp_path / "seen.json"
    path.write_text("not valid json{{{")
    assert module._load_seen_ids(path) == set()


def test_seen_ids_cap_keeps_only_recent_5000(module, tmp_path):
    path = tmp_path / "seen.json"
    many = {f"id_{i:06d}" for i in range(6000)}
    module._save_seen_ids(path, many)
    saved = json.loads(path.read_text())
    assert len(saved) == 5000


def test_reddit_client_requires_all_three_env_vars(module, monkeypatch):
    monkeypatch.delenv("REDDIT_CLIENT_ID", raising=False)
    monkeypatch.delenv("REDDIT_CLIENT_SECRET", raising=False)
    monkeypatch.delenv("REDDIT_USER_AGENT", raising=False)
    with pytest.raises(RuntimeError, match="REDDIT_CLIENT_ID"):
        module._reddit_client()


def test_main_exits_cleanly_without_credentials(module, monkeypatch, tmp_path):
    monkeypatch.delenv("REDDIT_CLIENT_ID", raising=False)
    seen_ids_file = str(tmp_path / "seen.json")
    exit_code = module.main(["--dry-run", "--seen-ids-file", seen_ids_file])
    assert exit_code == 1
