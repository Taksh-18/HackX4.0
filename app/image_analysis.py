"""Vision-based image-CONTENT analysis.

This is deliberately separate from `app.corroboration`'s perceptual hashing:
pHash tells you two images are the same bytes, never what is in them. This
module (when a vision-capable OpenAI-compatible client is configured) looks
at what the photo actually shows - hazard type, visible damage, whether
people appear at risk, whether the image supports or conflicts with the
report's own text claim - which is the single largest gap between "we hashed
an image" and "we assessed disaster damage from a photograph."

Every failure mode - no client configured, offline mode forced, missing
file, unsupported format, oversized file, unreadable file, API failure,
schema-invalid output - returns a safe `analyzed=False` result. This module
never raises out of `analyze_image`, and it never sends bytes to a remote
model when `CDIS_OFFLINE_IMAGE_ANALYSIS` is set (tests always set it; see
tests/conftest.py).
"""

from __future__ import annotations

import base64
import json
import logging
import mimetypes
import os
from pathlib import Path
from typing import Literal
from urllib.parse import urlparse

from pydantic import BaseModel, ConfigDict, Field

logger = logging.getLogger(__name__)

MAX_IMAGE_BYTES = 8 * 1024 * 1024  # 8 MB
SUPPORTED_EXTENSIONS = {".jpg", ".jpeg", ".png", ".webp"}

# Analysis is cached by pHash, not by report or file path, so the exact same
# image content (including an explicit repost) is only ever sent to the
# model once - this is what "cache completed analysis" and "duplicate
# images analyzed only once" mean in practice.
_CACHE: dict[str, ImageAnalysis] = {}


class ImageAnalysis(BaseModel):
    """Validated, strict output contract for one image's content assessment."""

    model_config = ConfigDict(extra="forbid", strict=True)

    analyzed: bool
    contains_disaster_evidence: bool | None = None
    disaster_type: Literal["FLOOD", "FIRE", "COLLAPSE", "OTHER"] | None = None
    visible_damage: list[str] = Field(default_factory=list)
    visible_people_at_risk: bool | None = None
    access_blocked: bool | None = None
    severity: int | None = Field(default=None, ge=1, le=10)
    supports_text_claim: bool | None = None
    concerns: list[str] = Field(default_factory=list)
    confidence: float | None = Field(default=None, ge=0, le=100)
    provider: str = "unavailable"


ANALYSIS_RESPONSE_FORMAT = {
    "type": "json_schema",
    "json_schema": {
        "name": "image_analysis",
        "strict": True,
        "schema": ImageAnalysis.model_json_schema(),
    },
}

SYSTEM_PROMPT = """
You are assessing a single disaster-report photograph for a citizen-report
triage system. Analyze ONLY what is visually present in the image itself.

The accompanying report text is an UNTRUSTED CLAIM, not ground truth. Form a
judgement about the image's own content first; only then note whether the
image supports or conflicts with that claim.

Hard rules:
- Never attempt to identify, recognize, describe, or name any specific
  person. `visible_people_at_risk` is a boolean about the situation only.
- Never infer an exact victim or trapped-person count from a photograph.
- Do not claim an image was digitally manipulated unless the image itself
  shows a clear, describable visual inconsistency (name it in `concerns`);
  otherwise leave manipulation unassessed rather than accusing the source.
- If the image is ambiguous, low quality, or does not obviously show a
  disaster scene, prefer `false`/`null` fields over a confident guess.
  Preserve uncertainty rather than manufacturing confidence.
- `severity` is your own 1-10 visual read of apparent damage, independent of
  any number claimed in the accompanying text.
- `confidence` (0-100) is how sure you are of your own visual read, not a
  restatement of the report's credibility.

Return only the schema-constrained JSON object with no commentary.
""".strip()


def image_analysis_offline_forced() -> bool:
    return os.getenv("CDIS_OFFLINE_IMAGE_ANALYSIS", "").strip().lower() in (
        "1",
        "true",
        "yes",
        "on",
    )


def clear_cache() -> None:
    """Drop cached analyses; used by tests so runs don't leak into each other."""
    _CACHE.clear()


def _offline_fallback(concern: str | None = None) -> ImageAnalysis:
    """Safe, honest stand-in when no vision-capable provider is available.

    This never claims to understand image content - it exists only so the
    pipeline always has a consistently typed result to attach, whether or
    not a vision provider is configured.
    """
    return ImageAnalysis(analyzed=False, concerns=[concern] if concern else [])


def _vision_model_for_client(client) -> str:
    configured = os.getenv("CDIS_VISION_MODEL", "").strip()
    if configured:
        return configured
    hostname = urlparse(str(getattr(client, "base_url", ""))).hostname
    if hostname == "api.groq.com":
        return "meta-llama/llama-4-scout-17b-16e-instruct"
    if hostname == "generativelanguage.googleapis.com":
        return "gemini-2.0-flash"
    return "gpt-4o-mini"


def _read_image_b64(path: Path) -> tuple[str, str] | None:
    """Return (base64 data, mime type) for a supported, readable local image."""
    if path.suffix.lower() not in SUPPORTED_EXTENSIONS:
        return None
    try:
        size = path.stat().st_size
    except OSError:
        return None
    if size == 0 or size > MAX_IMAGE_BYTES:
        return None
    try:
        data = path.read_bytes()
        from PIL import Image

        with Image.open(path) as image:
            image.verify()
    except Exception:  # noqa: BLE001 - any unreadable/corrupt file is "unavailable"
        return None
    mime = mimetypes.guess_type(str(path))[0] or "image/jpeg"
    return base64.b64encode(data).decode("ascii"), mime


def analyze_image(
    image_path: str | None,
    *,
    phash: str | None = None,
    claim_text: str | None = None,
    client=None,
) -> ImageAnalysis:
    """Analyze one local image's content, independent of and then against its claim.

    Never raises. Returns `analyzed=False` for a missing path, remote URL,
    unsupported/oversized/unreadable file, forced offline mode, an
    unavailable client, or any API/schema failure. Results are cached by
    `phash` so the same image content is analyzed at most once.
    """
    if phash and phash in _CACHE:
        return _CACHE[phash]

    def _store(result: ImageAnalysis) -> ImageAnalysis:
        if phash:
            _CACHE[phash] = result
        return result

    if image_analysis_offline_forced():
        return _store(_offline_fallback())

    if not image_path or "://" in image_path:
        return _store(_offline_fallback("media not available for analysis"))

    path = Path(image_path)
    if not path.is_file():
        return _store(_offline_fallback("media not available for analysis"))

    encoded = _read_image_b64(path)
    if encoded is None:
        return _store(
            _offline_fallback("unsupported, empty, oversized, or unreadable image")
        )
    data_b64, mime = encoded

    if client is None:
        try:
            from app.extraction import _client_from_env

            client = _client_from_env()
        except Exception as exc:  # noqa: BLE001 - no key is a normal demo state
            logger.info(
                "Vision client unavailable (%s); image analysis skipped",
                type(exc).__name__,
            )
            return _store(_offline_fallback())

    try:
        response = client.chat.completions.create(
            model=_vision_model_for_client(client),
            messages=[
                {"role": "system", "content": SYSTEM_PROMPT},
                {
                    "role": "user",
                    "content": [
                        {
                            "type": "text",
                            "text": "Untrusted report claim (reference only, may be "
                            "wrong or misleading): " + json.dumps(claim_text or ""),
                        },
                        {
                            "type": "image_url",
                            "image_url": {"url": f"data:{mime};base64,{data_b64}"},
                        },
                    ],
                },
            ],
            response_format=ANALYSIS_RESPONSE_FORMAT,
            temperature=0,
        )
        choice = response.choices[0]
        if choice.finish_reason != "stop":
            raise ValueError("model did not finish a complete analysis")
        if getattr(choice.message, "refusal", None):
            raise ValueError("model refused analysis")
        content = choice.message.content
        if not content:
            raise ValueError("model returned no structured analysis")
        result = ImageAnalysis.model_validate_json(content)
        result.provider = _vision_provider_name(client)
    except Exception as exc:  # noqa: BLE001 - any failure degrades safely
        logger.error("Image analysis failed (%s)", type(exc).__name__)
        result = _offline_fallback("image analysis failed; result unavailable")

    return _store(result)


def _vision_provider_name(client) -> str:
    hostname = urlparse(str(getattr(client, "base_url", ""))).hostname or "unknown"
    return hostname
