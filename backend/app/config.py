"""Application configuration loaded from environment variables."""

from __future__ import annotations

import os
from pathlib import Path

from dotenv import load_dotenv

# Load .env from the backend directory (two levels up from this file)
_backend_dir = Path(__file__).resolve().parent.parent
load_dotenv(_backend_dir / ".env")

# ---------------------------------------------------------------------------
# Provider
# ---------------------------------------------------------------------------
AI_PROVIDER: str = os.getenv("AI_PROVIDER", "mock")
ALLOW_MOCK: bool = os.getenv("ALLOW_MOCK", "false").lower() in ("true", "1", "yes")

# ---------------------------------------------------------------------------
# Offline mode
# ---------------------------------------------------------------------------
HF_HUB_OFFLINE: str = os.getenv("HF_HUB_OFFLINE", "1")
TRANSFORMERS_OFFLINE: str = os.getenv("TRANSFORMERS_OFFLINE", "1")

# ---------------------------------------------------------------------------
# Image validation
# ---------------------------------------------------------------------------
MAX_IMAGE_SIZE_BYTES: int = 10 * 1024 * 1024  # 10 MB
ALLOWED_MIME_TYPES: set[str] = {"image/jpeg", "image/png", "image/webp"}
MIN_SHORT_SIDE_PX: int = 64
MAX_LONG_SIDE_PX: int = 1024

# ---------------------------------------------------------------------------
# Rate limiting
# ---------------------------------------------------------------------------
RATE_LIMIT_MAX_REQUESTS: int = 10
RATE_LIMIT_WINDOW_SECONDS: int = 60
TRUSTED_PROXIES: list[str] = [
    p.strip()
    for p in os.getenv("TRUSTED_PROXIES", "127.0.0.1").split(",")
    if p.strip()
]

# ---------------------------------------------------------------------------
# ML model paths
# ---------------------------------------------------------------------------
ML_DIR = Path(os.getenv("ML_DIR", str(_backend_dir.parent / "ml")))
CLASSIFIER_PATH = ML_DIR / "models" / "classifier.pt"
INDEX_PATH = ML_DIR / "models" / "index.npz"
LABEL_MAP_PATH = ML_DIR / "knowledge_base" / "label_map.json"
FOOD_MASTER_PATH = ML_DIR / "data" / "annotations" / "food_master.csv"

# ---------------------------------------------------------------------------
# App metadata
# ---------------------------------------------------------------------------
APP_VERSION: str = "0.1.0"

