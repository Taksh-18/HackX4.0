"""POST /media: real file upload so citizen photos become hashable/analyzable."""

import io

import pytest
from fastapi.testclient import TestClient
from PIL import Image

from app import main as main_module
from app.main import app


@pytest.fixture
def api(tmp_path, monkeypatch):
    monkeypatch.setattr(main_module, "MEDIA_DIR", tmp_path)
    monkeypatch.setattr(main_module, "init_db", lambda: None)
    with TestClient(app) as client:
        yield client


def _jpeg_bytes(size=(32, 32)) -> bytes:
    buf = io.BytesIO()
    Image.new("RGB", size, "red").save(buf, format="JPEG")
    return buf.getvalue()


def test_upload_saves_file_and_returns_a_usable_media_url(api, tmp_path):
    response = api.post(
        "/media", files={"file": ("scene.jpg", _jpeg_bytes(), "image/jpeg")}
    )
    assert response.status_code == 200
    body = response.json()
    assert body["media_url"].startswith("media/upload_")
    assert body["media_url"].endswith(".jpg")

    saved_path = tmp_path / body["media_url"].split("/", 1)[1]
    assert saved_path.is_file()
    with Image.open(saved_path) as img:
        img.verify()


def test_upload_rejects_unsupported_extension(api):
    response = api.post(
        "/media", files={"file": ("scene.gif", b"not a real gif", "image/gif")}
    )
    assert response.status_code == 400
    assert "Unsupported file type" in response.json()["detail"]


def test_upload_rejects_empty_file(api):
    response = api.post("/media", files={"file": ("scene.jpg", b"", "image/jpeg")})
    assert response.status_code == 400
    assert "Empty file" in response.json()["detail"]


def test_upload_rejects_corrupt_image(api):
    response = api.post(
        "/media", files={"file": ("scene.jpg", b"not actually a jpeg", "image/jpeg")}
    )
    assert response.status_code == 400
    assert "not a readable image" in response.json()["detail"]


def test_upload_rejects_oversized_file(api, monkeypatch):
    monkeypatch.setattr(main_module, "MAX_IMAGE_BYTES", 100)
    big = _jpeg_bytes(size=(200, 200))
    assert len(big) > 100
    response = api.post("/media", files={"file": ("scene.jpg", big, "image/jpeg")})
    assert response.status_code == 400
    assert "too large" in response.json()["detail"]


def test_uploaded_media_is_then_hashable_by_the_pipeline(api, tmp_path):
    """End-to-end: an uploaded file is a real path _local_media_path can resolve."""
    from app.corroboration import compute_phash
    from app.pipeline import PROJECT_ROOT, _local_media_path

    response = api.post(
        "/media", files={"file": ("scene.jpg", _jpeg_bytes(), "image/jpeg")}
    )
    media_url = response.json()["media_url"]

    # _local_media_path resolves relative to PROJECT_ROOT, not the monkeypatched
    # MEDIA_DIR, so mirror the saved file there for this contract check.
    real_path = PROJECT_ROOT / media_url
    real_path.parent.mkdir(parents=True, exist_ok=True)
    real_path.write_bytes((tmp_path / media_url.split("/", 1)[1]).read_bytes())
    try:
        resolved = _local_media_path(media_url)
        assert resolved is not None
        assert compute_phash(str(resolved))
    finally:
        real_path.unlink(missing_ok=True)
