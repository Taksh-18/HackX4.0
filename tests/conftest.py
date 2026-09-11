"""Shared test fixtures.

Keeps the whole suite offline and deterministic by default: live Nominatim
lookups and disk cache writes are disabled for every test, not just the
geolocation and pipeline tests that used to patch this individually. A test
that wants to exercise the live path can still override these attributes
itself.
"""

import pytest

from app import geolocation
from app.image_analysis import clear_cache as clear_image_analysis_cache
from app.pipeline import reset_extraction_client


@pytest.fixture(autouse=True)
def _offline_geocoder(monkeypatch):
    monkeypatch.setattr(geolocation, "NOMINATIM_DISABLED", True)
    monkeypatch.setattr(geolocation, "_save_cache", lambda _cache: None)
    geolocation._CACHE.clear()


@pytest.fixture(autouse=True)
def _offline_extraction(monkeypatch):
    """Force the deterministic keyword extractor unless a test opts out."""
    monkeypatch.setenv("CDIS_OFFLINE_EXTRACTION", "1")
    reset_extraction_client()
    yield
    reset_extraction_client()


@pytest.fixture(autouse=True)
def _offline_image_analysis(monkeypatch):
    """Force the safe no-op image analyzer; never call a vision model in tests."""
    monkeypatch.setenv("CDIS_OFFLINE_IMAGE_ANALYSIS", "1")
    clear_image_analysis_cache()
    yield
    clear_image_analysis_cache()
