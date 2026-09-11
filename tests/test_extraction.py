"""Offline extraction contract tests; fake outputs do not evaluate LLM accuracy."""

import json
from datetime import UTC, datetime
from types import SimpleNamespace

import pytest
from pydantic import ValidationError

from app.extraction import (
    EXTRACTION_RESPONSE_FORMAT,
    ExtractedReport,
    _client_from_env,
    _model_for_client,
    filter_and_extract,
    process_reports,
)


def extraction(**changes):
    return {
        "relevant": True,
        "disaster_type": "FLOOD",
        "claim": "Three people are trapped near Pillar 42 in rising floodwater.",
        "landmark": "Pillar 42 wali gali mein",
        "trapped_count": 3,
        "resource_demands": ["rescue_boat"],
        "access_impediment": True,
        "severity": 8,
        "event_time_hint": None,
        **changes,
    }


def report(report_id="rep_0001", **changes):
    return {
        "id": report_id,
        "source_user": "@demo_citizen",
        "raw_text": "Pillar 42 wali gali mein 3 people trapped. Need a rescue boat.",
        "timestamp": "2026-09-11T14:00:00+05:30",
        "media_url": None,
        "gps_lat": None,
        "gps_lon": None,
        **changes,
    }


def completion(content=None, finish_reason="stop", refusal=None):
    return SimpleNamespace(
        choices=[
            SimpleNamespace(
                finish_reason=finish_reason,
                message=SimpleNamespace(content=content, refusal=refusal),
            )
        ]
    )


class FakeClient:
    base_url = "https://api.openai.com/v1"

    def __init__(self, *responses):
        self.responses = iter(responses)
        self.calls = []
        self.chat = SimpleNamespace(completions=SimpleNamespace(create=self.create))

    def create(self, **kwargs):
        self.calls.append(kwargs)
        response = next(self.responses)
        if isinstance(response, Exception):
            raise response
        return response


def assert_noise(result):
    assert result.model_dump() == {
        "relevant": False,
        "disaster_type": None,
        "claim": None,
        "landmark": None,
        "trapped_count": None,
        "resource_demands": [],
        "access_impediment": False,
        "severity": None,
        "event_time_hint": None,
    }


def test_strict_output_schema_and_datetime_input():
    client = FakeClient(completion(json.dumps(extraction())))
    timestamp = datetime(2026, 9, 11, 8, 30, tzinfo=UTC)
    result = filter_and_extract(report(timestamp=timestamp), client)
    assert result.trapped_count == 3
    assert result.landmark == "Pillar 42 wali gali mein"
    request = client.calls[0]
    assert request["response_format"] == EXTRACTION_RESPONSE_FORMAT
    schema = request["response_format"]["json_schema"]
    assert schema["strict"] is True
    assert schema["schema"]["additionalProperties"] is False
    assert set(schema["schema"]["required"]) == set(ExtractedReport.model_fields)
    sent = json.loads(request["messages"][1]["content"].split("\n", 1)[1])
    assert sent["timestamp"] == timestamp.isoformat()


def test_noisy_output_clears_all_claims():
    client = FakeClient(completion(json.dumps(extraction(relevant=False))))
    assert_noise(filter_and_extract(report(raw_text="Thoughts and prayers 🙏"), client))


@pytest.mark.parametrize(
    "changes",
    [
        {"trapped_count": True},
        {"trapped_count": "3"},
        {"trapped_count": 3.5},
        {"trapped_count": -1},
        {"relevant": "false"},
        {"severity": 11},
        {"severity": 8.5},
        {"claim": "   "},
        {"disaster_type": None},
        {"extra_key": "not in the contract"},
    ],
)
def test_invalid_facts_are_rejected_instead_of_coerced(changes):
    with pytest.raises(ValidationError):
        ExtractedReport.model_validate(extraction(**changes))


@pytest.mark.parametrize(
    "response",
    [
        completion("malformed JSON"),
        completion("{}"),
        completion(json.dumps(extraction()), finish_reason="length"),
        completion(json.dumps(extraction()), refusal="Cannot comply"),
        completion(None),
        SimpleNamespace(choices=[]),
        RuntimeError("upstream connection failed"),
    ],
)
def test_api_and_response_failures_produce_logged_empty_fallback(response, caplog):
    assert_noise(filter_and_extract(report(), FakeClient(response)))
    assert "Extraction failed for report rep_0001" in caplog.text


def test_batch_continues_after_failure_without_mutating_reports(caplog):
    inputs = [report("rep_0001"), report("rep_0002")]
    original = json.loads(json.dumps(inputs))
    client = FakeClient(
        RuntimeError("credential or private payload must not enter logs"),
        completion(json.dumps(extraction())),
    )
    outputs = process_reports(inputs, client)
    assert inputs == original
    assert outputs[0]["extracted_json"]["relevant"] is False
    assert outputs[1]["extracted_json"]["relevant"] is True
    assert outputs[1]["extracted_json"]["trapped_count"] == 3
    assert "credential or private payload" not in caplog.text


def test_conflicting_claims_are_passed_through_in_separate_requests():
    collapse = extraction(
        disaster_type="COLLAPSE",
        claim="Sector 4 bridge has collapsed.",
        landmark="Sector 4 bridge",
        trapped_count=None,
    )
    denial = extraction(
        claim="Sector 4 bridge has not collapsed; the road is only waterlogged.",
        landmark="Sector 4 bridge",
        trapped_count=None,
        severity=3,
    )
    client = FakeClient(
        completion(json.dumps(collapse)), completion(json.dumps(denial))
    )
    inputs = [
        report("rep_0017", raw_text=collapse["claim"]),
        report("rep_0018", raw_text=denial["claim"]),
    ]
    results = process_reports(inputs, client)
    assert results[0]["extracted_json"] == collapse
    assert results[1]["extracted_json"] == denial
    assert len(client.calls[0]["messages"]) == len(client.calls[1]["messages"]) == 2
    assert "rep_0017" not in client.calls[1]["messages"][1]["content"]


def test_blank_text_does_not_spend_an_api_call():
    client = FakeClient()
    assert_noise(filter_and_extract(report(raw_text="  "), client))
    assert client.calls == []


@pytest.fixture
def clean_provider_env(monkeypatch):
    for name in (
        "GROQ_API_KEY",
        "OPENAI_API_KEY",
        "EXTRACTION_API_KEY",
        "EXTRACTION_BASE_URL",
        "EXTRACTION_MODEL",
        "OPENAI_BASE_URL",
    ):
        monkeypatch.delenv(name, raising=False)
    captured = {}

    def fake_openai(**kwargs):
        captured.update(kwargs)
        return SimpleNamespace(**kwargs)

    monkeypatch.setattr("openai.OpenAI", fake_openai)
    return captured


@pytest.mark.parametrize(
    "endpoint,expected_key,expected_model",
    [
        ("https://api.openai.com/v1", "test-openai", "gpt-4o-mini"),
        ("https://api.groq.com/openai/v1", "gsk_test-groq", "openai/gpt-oss-20b"),
    ],
)
def test_explicit_endpoint_selects_its_own_key(
    monkeypatch, clean_provider_env, endpoint, expected_key, expected_model
):
    monkeypatch.setenv("OPENAI_API_KEY", "test-openai")
    monkeypatch.setenv("GROQ_API_KEY", "gsk_test-groq")
    monkeypatch.setenv("EXTRACTION_BASE_URL", endpoint)
    client = _client_from_env()
    assert clean_provider_env["api_key"] == expected_key
    assert _model_for_client(client) == expected_model


def test_legacy_groq_key_uses_groq_endpoint(monkeypatch, clean_provider_env):
    monkeypatch.setenv("OPENAI_API_KEY", "gsk_test-only")
    assert _client_from_env().base_url == "https://api.groq.com/openai/v1"


def test_provider_detection_uses_exact_hostname(monkeypatch):
    monkeypatch.delenv("EXTRACTION_MODEL", raising=False)
    client = SimpleNamespace(base_url="https://other.example/api.groq.com")
    assert _model_for_client(client) == "gpt-4o-mini"
    monkeypatch.setenv("EXTRACTION_MODEL", " custom-model ")
    assert _model_for_client(client) == "custom-model"


def test_explicit_openai_endpoint_rejects_groq_key(monkeypatch, clean_provider_env):
    monkeypatch.setenv("OPENAI_API_KEY", "gsk_test-only")
    monkeypatch.setenv("EXTRACTION_BASE_URL", "https://api.openai.com/v1")
    with pytest.raises(ValueError, match="Groq key"):
        _client_from_env()
    assert clean_provider_env == {}


def test_custom_endpoint_uses_explicit_key_and_model(monkeypatch, clean_provider_env):
    monkeypatch.setenv("GROQ_API_KEY", "gsk_test-groq")
    monkeypatch.setenv("EXTRACTION_API_KEY", "custom-key")
    monkeypatch.setenv("EXTRACTION_BASE_URL", "http://localhost:9000/v1")
    monkeypatch.setenv("EXTRACTION_MODEL", "local-model")
    client = _client_from_env()
    assert clean_provider_env["api_key"] == "custom-key"
    assert _model_for_client(client) == "local-model"
