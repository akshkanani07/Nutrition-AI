"""Tests for error envelope, image validation, CORS, and provider behaviour."""

from __future__ import annotations

import io
from pathlib import Path

import pytest
from fastapi.testclient import TestClient

from app import config
from app.exceptions import ConfigurationError
from app.main import create_app
from tests.conftest import make_gif, make_jpeg, make_png, make_webp


# ---------------------------------------------------------------------------
# Error envelope on every error
# ---------------------------------------------------------------------------
class TestErrorEnvelope:
    """Every error response must have {success: false, request_id, error: {code, message}}."""

    def _assert_envelope(self, resp, expected_code: str):
        body = resp.json()
        assert body["success"] is False
        assert "request_id" in body
        assert body["error"]["code"] == expected_code
        assert "message" in body["error"]

    def test_missing_image(self, client):
        resp = client.post("/api/v1/analyze-food")
        assert resp.status_code == 400
        self._assert_envelope(resp, "MISSING_IMAGE")

    def test_invalid_image_type_gif(self, client):
        data = make_gif()
        resp = client.post(
            "/api/v1/analyze-food",
            files={"image": ("test.gif", io.BytesIO(data), "image/gif")},
        )
        assert resp.status_code == 400
        self._assert_envelope(resp, "INVALID_IMAGE_TYPE")

    def test_invalid_image_type_text(self, client):
        resp = client.post(
            "/api/v1/analyze-food",
            files={"image": ("test.txt", io.BytesIO(b"hello world"), "text/plain")},
        )
        assert resp.status_code == 400
        self._assert_envelope(resp, "INVALID_IMAGE_TYPE")

    def test_image_too_large(self, client):
        # Create data > 10 MB with JPEG magic bytes
        big = b"\xff\xd8\xff\xe0" + b"\x00" * (10 * 1024 * 1024 + 1)
        resp = client.post(
            "/api/v1/analyze-food",
            files={"image": ("big.jpg", io.BytesIO(big), "image/jpeg")},
        )
        assert resp.status_code == 413
        self._assert_envelope(resp, "IMAGE_TOO_LARGE")

    def test_truncated_image(self, client):
        # JPEG magic bytes but truncated content
        truncated = b"\xff\xd8\xff\xe0" + b"\x00\x10JFIF" + b"\x00" * 50
        resp = client.post(
            "/api/v1/analyze-food",
            files={"image": ("bad.jpg", io.BytesIO(truncated), "image/jpeg")},
        )
        assert resp.status_code == 400
        self._assert_envelope(resp, "INVALID_IMAGE")

    def test_short_side_too_small(self, client):
        # 30x200 image — short side (30) < 64
        data = make_jpeg(30, 200)
        resp = client.post(
            "/api/v1/analyze-food",
            files={"image": ("small.jpg", io.BytesIO(data), "image/jpeg")},
        )
        assert resp.status_code == 400
        self._assert_envelope(resp, "INVALID_IMAGE")


# ---------------------------------------------------------------------------
# Magic-byte type detection (not extension)
# ---------------------------------------------------------------------------
class TestMagicByteDetection:
    def test_jpeg_accepted(self, client):
        data = make_jpeg()
        resp = client.post(
            "/api/v1/analyze-food",
            files={"image": ("photo.jpg", io.BytesIO(data), "image/jpeg")},
        )
        assert resp.status_code == 200

    def test_png_accepted(self, client):
        data = make_png()
        resp = client.post(
            "/api/v1/analyze-food",
            files={"image": ("photo.png", io.BytesIO(data), "image/png")},
        )
        assert resp.status_code == 200

    def test_webp_accepted(self, client):
        data = make_webp()
        resp = client.post(
            "/api/v1/analyze-food",
            files={"image": ("photo.webp", io.BytesIO(data), "image/webp")},
        )
        assert resp.status_code == 200

    def test_jpeg_wrong_extension_accepted(self, client):
        """JPEG data with .png extension — accepted because we check magic bytes."""
        data = make_jpeg()
        resp = client.post(
            "/api/v1/analyze-food",
            files={"image": ("photo.png", io.BytesIO(data), "image/png")},
        )
        assert resp.status_code == 200

    def test_text_with_jpg_extension_rejected(self, client):
        """Text data with .jpg extension — rejected because magic bytes are wrong."""
        resp = client.post(
            "/api/v1/analyze-food",
            files={"image": ("fake.jpg", io.BytesIO(b"not an image"), "image/jpeg")},
        )
        assert resp.status_code == 400
        body = resp.json()
        assert body["error"]["code"] == "INVALID_IMAGE_TYPE"


# ---------------------------------------------------------------------------
# Provider behaviour
# ---------------------------------------------------------------------------
class TestProviderBehaviour:
    def test_production_refuses_mock_at_startup(self, monkeypatch):
        """Refuse mock at startup when APP_ENV=production and ALLOW_MOCK=false."""
        monkeypatch.setattr(config, "APP_ENV", "production")
        monkeypatch.setattr(config, "AI_PROVIDER", "mock")
        monkeypatch.setattr(config, "ALLOW_MOCK", False)
        with pytest.raises(ConfigurationError) as exc_info:
            create_app()
        assert "refused in production" in str(exc_info.value)

    def test_production_allows_mock_when_explicitly_set(self, monkeypatch):
        """Allow mock in production if ALLOW_MOCK=true."""
        monkeypatch.setattr(config, "APP_ENV", "production")
        monkeypatch.setattr(config, "AI_PROVIDER", "mock")
        monkeypatch.setattr(config, "ALLOW_MOCK", True)
        test_app = create_app()
        assert test_app is not None

    def test_ml_model_503_without_weights(self, ml_client):
        data = make_jpeg()
        resp = ml_client.post(
            "/api/v1/analyze-food",
            files={"image": ("test.jpg", io.BytesIO(data), "image/jpeg")},
        )
        assert resp.status_code == 503
        body = resp.json()
        assert body["error"]["code"] == "MODEL_NOT_READY"

    def test_ml_model_not_ready_even_with_dummy_files(self, tmp_path: Path, monkeypatch):
        """Assert provider_ready=false and 503 MODEL_NOT_READY even if weight files exist."""
        dummy_classifier = tmp_path / "classifier.pt"
        dummy_label_map = tmp_path / "label_map.json"
        dummy_classifier.write_bytes(b"dummy_weights")
        dummy_label_map.write_text('{"0": "apple"}')

        monkeypatch.setattr(config, "CLASSIFIER_PATH", dummy_classifier)
        monkeypatch.setattr(config, "LABEL_MAP_PATH", dummy_label_map)
        monkeypatch.setattr(config, "AI_PROVIDER", "ml_model")
        monkeypatch.setattr(config, "APP_ENV", "development")

        test_app = create_app()
        test_client = TestClient(test_app)

        health_resp = test_client.get("/api/v1/health")
        assert health_resp.status_code == 200
        health_data = health_resp.json()
        assert health_data["provider"] == "ml_model"
        assert health_data["provider_ready"] is False

        data = make_jpeg()
        analyze_resp = test_client.post(
            "/api/v1/analyze-food",
            files={"image": ("test.jpg", io.BytesIO(data), "image/jpeg")},
        )
        assert analyze_resp.status_code == 503
        body = analyze_resp.json()
        assert body["error"]["code"] == "MODEL_NOT_READY"

    def test_mock_success_response(self, client):
        data = make_jpeg()
        resp = client.post(
            "/api/v1/analyze-food",
            files={"image": ("test.jpg", io.BytesIO(data), "image/jpeg")},
        )
        assert resp.status_code == 200
        body = resp.json()
        assert body["success"] is True
        assert body["provider"] == "mock"
        assert body["status"] == "ok"
        assert len(body["items"]) > 0
        assert "totals" in body
        assert "score" in body
        assert "advice" in body


# ---------------------------------------------------------------------------
# Rate limiting
# ---------------------------------------------------------------------------
class TestRateLimit:
    def test_rate_limit_enforced(self, client):
        data = make_jpeg()
        for _ in range(10):
            resp = client.post(
                "/api/v1/analyze-food",
                files={"image": ("test.jpg", io.BytesIO(data), "image/jpeg")},
            )
            assert resp.status_code == 200

        # 11th request should be rate limited
        resp = client.post(
            "/api/v1/analyze-food",
            files={"image": ("test.jpg", io.BytesIO(data), "image/jpeg")},
        )
        assert resp.status_code == 429
        body = resp.json()
        assert body["error"]["code"] == "RATE_LIMITED"
        assert body["error"]["retryable"] is True


# ---------------------------------------------------------------------------
# CORS
# ---------------------------------------------------------------------------
class TestCORS:
    def test_allowed_origin_header(self, client):
        headers = {"Origin": "http://localhost:3000"}
        resp = client.options("/api/v1/health", headers=headers)
        assert resp.headers.get("access-control-allow-origin") == "http://localhost:3000"

    def test_foreign_origin_rejected(self, client):
        headers = {"Origin": "http://malicious-site.com"}
        resp = client.options("/api/v1/health", headers=headers)
        assert "access-control-allow-origin" not in resp.headers


# ---------------------------------------------------------------------------
# Health endpoint
# ---------------------------------------------------------------------------
class TestHealth:
    def test_health_mock(self, client):
        resp = client.get("/api/v1/health")
        assert resp.status_code == 200
        body = resp.json()
        assert body["status"] == "ok"
        assert body["provider"] == "mock"
        assert body["provider_ready"] is True
