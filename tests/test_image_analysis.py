"""app.image_analysis: schema validation, safe fallbacks, and caching."""

import pytest
from PIL import Image

from app import image_analysis
from app.image_analysis import ImageAnalysis, analyze_image, clear_cache


@pytest.fixture(autouse=True)
def _clear_cache():
    clear_cache()
    yield
    clear_cache()


def _write_image(path, size=(64, 64), fmt="JPEG"):
    Image.new("RGB", size, "red").save(path, format=fmt)


class _FakeMessage:
    def __init__(self, content):
        self.content = content
        self.refusal = None


class _FakeChoice:
    def __init__(self, content):
        self.message = _FakeMessage(content)
        self.finish_reason = "stop"


class _FakeResponse:
    def __init__(self, content):
        self.choices = [_FakeChoice(content)]


class _FakeClient:
    """Minimal OpenAI-compatible stand-in that returns one canned response."""

    def __init__(self, content=None, *, raise_exc=None):
        self.base_url = "https://api.groq.com/openai/v1"
        self._content = content
        self._raise_exc = raise_exc
        self.calls = 0

        class _Completions:
            def create(_inner_self, **kwargs):
                self.calls += 1
                if self._raise_exc:
                    raise self._raise_exc
                return _FakeResponse(self._content)

        class _Chat:
            def __init__(_inner_self):
                _inner_self.completions = _Completions()

        self.chat = _Chat()


def test_offline_mode_never_calls_a_client(monkeypatch, tmp_path):
    monkeypatch.setenv("CDIS_OFFLINE_IMAGE_ANALYSIS", "1")
    path = tmp_path / "scene.jpg"
    _write_image(path)
    client = _FakeClient(content="{}")

    result = analyze_image(str(path), phash="abc123", client=client)

    assert result.analyzed is False
    assert result.provider != "api.groq.com"
    assert client.calls == 0


def test_missing_file_returns_safe_fallback(monkeypatch):
    monkeypatch.delenv("CDIS_OFFLINE_IMAGE_ANALYSIS", raising=False)
    result = analyze_image("/no/such/file.jpg", phash="missing")
    assert result.analyzed is False
    assert result.concerns


def test_none_path_returns_safe_fallback(monkeypatch):
    monkeypatch.delenv("CDIS_OFFLINE_IMAGE_ANALYSIS", raising=False)
    result = analyze_image(None, phash="none-path")
    assert result.analyzed is False


def test_remote_url_is_never_fetched(monkeypatch):
    monkeypatch.delenv("CDIS_OFFLINE_IMAGE_ANALYSIS", raising=False)
    result = analyze_image("https://example.com/photo.jpg", phash="remote")
    assert result.analyzed is False


def test_oversized_file_is_rejected(monkeypatch, tmp_path):
    monkeypatch.delenv("CDIS_OFFLINE_IMAGE_ANALYSIS", raising=False)
    monkeypatch.setattr(image_analysis, "MAX_IMAGE_BYTES", 100)
    path = tmp_path / "big.jpg"
    _write_image(path, size=(200, 200))
    assert path.stat().st_size > 100

    result = analyze_image(str(path), phash="oversized")
    assert result.analyzed is False


def test_unsupported_extension_is_rejected(monkeypatch, tmp_path):
    monkeypatch.delenv("CDIS_OFFLINE_IMAGE_ANALYSIS", raising=False)
    path = tmp_path / "scene.gif"
    Image.new("RGB", (32, 32), "blue").save(path, format="GIF")

    result = analyze_image(str(path), phash="unsupported-ext")
    assert result.analyzed is False


def test_corrupt_file_is_rejected(monkeypatch, tmp_path):
    monkeypatch.delenv("CDIS_OFFLINE_IMAGE_ANALYSIS", raising=False)
    path = tmp_path / "broken.jpg"
    path.write_bytes(b"not actually an image")

    result = analyze_image(str(path), phash="corrupt")
    assert result.analyzed is False


def test_successful_analysis_validates_against_the_schema(monkeypatch, tmp_path):
    monkeypatch.delenv("CDIS_OFFLINE_IMAGE_ANALYSIS", raising=False)
    path = tmp_path / "scene.jpg"
    _write_image(path)
    payload = ImageAnalysis(
        analyzed=True,
        contains_disaster_evidence=True,
        disaster_type="FLOOD",
        visible_damage=["submerged road"],
        visible_people_at_risk=True,
        access_blocked=True,
        severity=7,
        supports_text_claim=True,
        concerns=[],
        confidence=82.0,
    ).model_dump_json()
    client = _FakeClient(content=payload)

    result = analyze_image(
        str(path), phash="flood-1", claim_text="water rising", client=client
    )

    assert result.analyzed is True
    assert result.disaster_type == "FLOOD"
    assert result.severity == 7
    assert 0 <= result.confidence <= 100
    assert client.calls == 1


def test_api_failure_degrades_to_safe_fallback(monkeypatch, tmp_path):
    monkeypatch.delenv("CDIS_OFFLINE_IMAGE_ANALYSIS", raising=False)
    path = tmp_path / "scene.jpg"
    _write_image(path)
    client = _FakeClient(raise_exc=RuntimeError("provider down"))

    result = analyze_image(str(path), phash="api-fail", client=client)

    assert result.analyzed is False
    assert client.calls == 1


def test_invalid_schema_output_degrades_to_safe_fallback(monkeypatch, tmp_path):
    monkeypatch.delenv("CDIS_OFFLINE_IMAGE_ANALYSIS", raising=False)
    path = tmp_path / "scene.jpg"
    _write_image(path)
    client = _FakeClient(content='{"severity": 99}')  # out of range, invalid

    result = analyze_image(str(path), phash="bad-schema", client=client)

    assert result.analyzed is False


def test_cached_analysis_is_reused_for_the_same_phash(monkeypatch, tmp_path):
    """Same pHash => the model is called at most once, however many times we ask."""
    monkeypatch.delenv("CDIS_OFFLINE_IMAGE_ANALYSIS", raising=False)
    path = tmp_path / "scene.jpg"
    _write_image(path)
    payload = ImageAnalysis(analyzed=True, confidence=90.0).model_dump_json()
    client = _FakeClient(content=payload)

    first = analyze_image(str(path), phash="shared-hash", client=client)
    second = analyze_image(str(path), phash="shared-hash", client=client)
    third = analyze_image("/different/path/but/same/hash.jpg", phash="shared-hash")

    assert client.calls == 1
    assert first == second == third


def test_blank_path_string_never_raises():
    result = analyze_image("   ", phash="blank")
    assert result.analyzed is False


def test_read_image_b64_returns_none_for_zero_byte_file(tmp_path):
    path = tmp_path / "empty.jpg"
    path.touch()
    assert image_analysis._read_image_b64(path) is None


def test_read_image_b64_accepts_supported_formats(tmp_path):
    path = tmp_path / "scene.png"
    Image.new("RGB", (16, 16), "green").save(path, format="PNG")
    encoded = image_analysis._read_image_b64(path)
    assert encoded is not None
    data_b64, mime = encoded
    assert mime == "image/png"
    assert isinstance(data_b64, str) and data_b64
