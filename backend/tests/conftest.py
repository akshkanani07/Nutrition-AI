"""Shared test fixtures for the backend test suite."""

from __future__ import annotations

import io
import struct

import pytest
from fastapi.testclient import TestClient

from app import config


@pytest.fixture(autouse=True)
def _reset_provider():
    """Reset the global provider before each test."""
    import app.main as main_mod
    main_mod._provider = None
    yield
    main_mod._provider = None


@pytest.fixture()
def client():
    """Create a FastAPI TestClient with mock provider enabled."""
    config.AI_PROVIDER = "mock"
    config.ALLOW_MOCK = True
    from app.main import app
    return TestClient(app)


@pytest.fixture()
def ml_client():
    """Create a TestClient configured for ml_model provider (no weights)."""
    config.AI_PROVIDER = "ml_model"
    config.ALLOW_MOCK = False
    from app.main import app
    return TestClient(app)


@pytest.fixture()
def prod_mock_client():
    """Mock provider in production mode (ALLOW_MOCK=false)."""
    config.AI_PROVIDER = "mock"
    config.ALLOW_MOCK = False
    from app.main import app
    return TestClient(app)


def make_jpeg(width: int = 200, height: int = 200) -> bytes:
    """Create a minimal valid JPEG image of the given size."""
    from PIL import Image
    img = Image.new("RGB", (width, height), color=(128, 200, 100))
    buf = io.BytesIO()
    img.save(buf, format="JPEG", quality=80)
    return buf.getvalue()


def make_png(width: int = 200, height: int = 200) -> bytes:
    """Create a minimal valid PNG image of the given size."""
    from PIL import Image
    img = Image.new("RGB", (width, height), color=(100, 150, 200))
    buf = io.BytesIO()
    img.save(buf, format="PNG")
    return buf.getvalue()


def make_webp(width: int = 200, height: int = 200) -> bytes:
    """Create a minimal valid WEBP image of the given size."""
    from PIL import Image
    img = Image.new("RGB", (width, height), color=(200, 100, 150))
    buf = io.BytesIO()
    img.save(buf, format="WEBP")
    return buf.getvalue()


def make_gif() -> bytes:
    """Create a minimal GIF (unsupported type)."""
    from PIL import Image
    img = Image.new("RGB", (100, 100), color=(255, 0, 0))
    buf = io.BytesIO()
    img.save(buf, format="GIF")
    return buf.getvalue()

