"""External verification must never break the pipeline when it is unreachable."""

import pytest

from app import verification
from app.verification import check_external_verification, verification_enabled


def test_disabled_by_default_returns_none():
    assert verification_enabled() is False
    assert check_external_verification("FLOOD", "Metro Pillar 42") is None


def test_missing_landmark_returns_none(monkeypatch):
    monkeypatch.setattr(verification, "VERIFICATION_URL", "https://example.invalid")
    assert check_external_verification("FLOOD", None) is None


@pytest.mark.parametrize(
    "opener",
    [
        pytest.param(
            lambda *a, **k: (_ for _ in ()).throw(TimeoutError()), id="timeout"
        ),
        pytest.param(
            lambda *a, **k: (_ for _ in ()).throw(OSError("connection refused")),
            id="connection_error",
        ),
    ],
)
def test_network_failures_degrade_to_none(monkeypatch, opener):
    monkeypatch.setattr(verification, "VERIFICATION_URL", "https://example.invalid")
    monkeypatch.setattr(verification.urllib.request, "urlopen", opener)
    assert check_external_verification("FLOOD", "Metro Pillar 42") is None


def test_malformed_response_degrades_to_none(monkeypatch):
    class _FakeResponse:
        status = 200

        def read(self):
            return b"not json"

        def __enter__(self):
            return self

        def __exit__(self, *exc):
            return False

    monkeypatch.setattr(verification, "VERIFICATION_URL", "https://example.invalid")
    monkeypatch.setattr(
        verification.urllib.request, "urlopen", lambda *a, **k: _FakeResponse()
    )
    assert check_external_verification("FLOOD", "Metro Pillar 42") is None


def test_non_200_status_degrades_to_none(monkeypatch):
    class _FakeResponse:
        status = 503

        def read(self):
            return b"{}"

        def __enter__(self):
            return self

        def __exit__(self, *exc):
            return False

    monkeypatch.setattr(verification, "VERIFICATION_URL", "https://example.invalid")
    monkeypatch.setattr(
        verification.urllib.request, "urlopen", lambda *a, **k: _FakeResponse()
    )
    assert check_external_verification("FLOOD", "Metro Pillar 42") is None


def test_successful_response_is_capped_at_max_hits(monkeypatch):
    class _FakeResponse:
        status = 200

        def read(self):
            return b'{"hits": 9}'

        def __enter__(self):
            return self

        def __exit__(self, *exc):
            return False

    monkeypatch.setattr(verification, "VERIFICATION_URL", "https://example.invalid")
    monkeypatch.setattr(
        verification.urllib.request, "urlopen", lambda *a, **k: _FakeResponse()
    )
    assert check_external_verification("FLOOD", "Metro Pillar 42") == 3
