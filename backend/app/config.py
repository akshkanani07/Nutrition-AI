"""Application configuration loaded from backend/.env using python-dotenv."""

from __future__ import annotations

import os
from pathlib import Path

# Ensure offline operation before any library import
os.environ.setdefault("HF_HUB_OFFLINE", "1")
os.environ.setdefault("TRANSFORMERS_OFFLINE", "1")

from dotenv import load_dotenv

# Explicitly load environment variables from backend/.env
_backend_dir = Path(__file__).resolve().parent.parent
load_dotenv(_backend_dir / ".env")

# ---------------------------------------------------------------------------
# Environment & Provider
# ---------------------------------------------------------------------------
APP_ENV: str = os.getenv("APP_ENV", "development").lower()
AI_PROVIDER: str = os.getenv("AI_PROVIDER", "mock").lower()
ALLOW_MOCK: bool = os.getenv("ALLOW_MOCK", "false").lower() in ("true", "1", "yes")

# ---------------------------------------------------------------------------
# CORS
# ---------------------------------------------------------------------------
_origins_env = os.getenv("ALLOWED_ORIGINS", "http://localhost:3000")
ALLOWED_ORIGINS: list[str] = [
    origin.strip() for origin in _origins_env.split(",") if origin.strip()
]

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
# TRUSTED_PROXIES must list only the immediate upstream hops you control
# (e.g. the local Next.js BFF or your internal reverse proxy/load balancer).
TRUSTED_PROXIES: list[str] = [
    proxy.strip()
    for proxy in os.getenv("TRUSTED_PROXIES", "127.0.0.1").split(",")
    if proxy.strip()
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
