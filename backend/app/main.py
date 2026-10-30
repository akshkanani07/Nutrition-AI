"""Nutrify AI — FastAPI application."""

from __future__ import annotations

import uuid
from typing import Annotated

from fastapi import FastAPI, File, Request, UploadFile
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse

from app import config
from app.image_utils import validate_and_preprocess
from app.providers.mock_provider import MockProvider
from app.providers.ml_provider import MLModelProvider
from app.rate_limit import RateLimiter
from app.schemas import (
    AnalysisResponse,
    ErrorDetail,
    ErrorResponse,
    HealthResponse,
)

# ---------------------------------------------------------------------------
# App setup
# ---------------------------------------------------------------------------
app = FastAPI(title="Nutrify AI", version=config.APP_VERSION)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# ---------------------------------------------------------------------------
# Provider init
# ---------------------------------------------------------------------------
_provider: MockProvider | MLModelProvider | None = None
_rate_limiter = RateLimiter()


def _get_provider() -> MockProvider | MLModelProvider:
    global _provider
    if _provider is not None:
        return _provider

    if config.AI_PROVIDER == "mock":
        _provider = MockProvider()
    elif config.AI_PROVIDER == "ml_model":
        _provider = MLModelProvider()
    else:
        raise RuntimeError(f"Unknown AI_PROVIDER: {config.AI_PROVIDER}")
    return _provider


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------
def _request_id() -> str:
    return str(uuid.uuid4())


def _error_response(
    request_id: str,
    status_code: int,
    code: str,
    message: str,
    hint: str | None = None,
    retryable: bool = False,
) -> JSONResponse:
    body = ErrorResponse(
        request_id=request_id,
        error=ErrorDetail(code=code, message=message, hint=hint, retryable=retryable),
    )
    return JSONResponse(status_code=status_code, content=body.model_dump())


def _get_client_ip(request: Request) -> str:
    """Extract client IP, honouring X-Forwarded-For from trusted proxies."""
    client_host = request.client.host if request.client else "unknown"
    forwarded = request.headers.get("x-forwarded-for")
    if forwarded and client_host in config.TRUSTED_PROXIES:
        return forwarded.split(",")[0].strip()
    return client_host


# ---------------------------------------------------------------------------
# Health endpoint
# ---------------------------------------------------------------------------
@app.get("/api/v1/health", response_model=HealthResponse)
async def health() -> HealthResponse:
    provider = _get_provider()
    return HealthResponse(
        status="ok",
        version=config.APP_VERSION,
        provider=provider.name,
        provider_ready=provider.ready,
        model_version=getattr(provider, "model_version", None),
    )


# ---------------------------------------------------------------------------
# Analyze endpoint
# ---------------------------------------------------------------------------
ERROR_CODES = {
    "MISSING_IMAGE": 400,
    "INVALID_IMAGE_TYPE": 400,
    "INVALID_IMAGE": 400,
    "IMAGE_TOO_LARGE": 413,
    "RATE_LIMITED": 429,
    "NO_FOOD_DETECTED": 422,
    "MODEL_NOT_READY": 503,
    "PROVIDER_UNAVAILABLE": 502,
    "ANALYSIS_TIMEOUT": 504,
    "INTERNAL_ERROR": 500,
}


@app.post("/api/v1/analyze-food")
async def analyze_food(
    request: Request,
    image: Annotated[UploadFile | None, File()] = None,
) -> JSONResponse:
    rid = _request_id()

    # --- rate limit ---
    client_ip = _get_client_ip(request)
    if not _rate_limiter.is_allowed(client_ip):
        return _error_response(
            rid, 429, "RATE_LIMITED",
            "Too many requests. Please try again later.",
            hint="Wait 60 seconds before retrying.",
            retryable=True,
        )

    # --- provider check ---
    provider = _get_provider()

    # In production, refuse mock unless ALLOW_MOCK is set
    if provider.name == "mock" and not config.ALLOW_MOCK:
        return _error_response(
            rid, 502, "PROVIDER_UNAVAILABLE",
            "Mock provider is not allowed in production.",
            hint="Set AI_PROVIDER=ml_model or ALLOW_MOCK=true.",
        )

    # --- image present? ---
    if image is None or image.filename == "":
        return _error_response(
            rid, 400, "MISSING_IMAGE",
            "No image was uploaded.",
            hint="Attach an image file to the 'image' form field.",
        )

    # --- read and validate ---
    try:
        data = await image.read()
    except Exception:
        return _error_response(
            rid, 400, "INVALID_IMAGE",
            "Failed to read the uploaded file.",
        )

    try:
        img, _mime = validate_and_preprocess(
            data,
            max_size_bytes=config.MAX_IMAGE_SIZE_BYTES,
            allowed_mime_types=config.ALLOWED_MIME_TYPES,
            min_short_side=config.MIN_SHORT_SIDE_PX,
            max_long_side=config.MAX_LONG_SIDE_PX,
        )
    except ValueError as exc:
        args = exc.args
        code = args[0] if len(args) > 0 else "INVALID_IMAGE"
        msg = args[1] if len(args) > 1 else str(exc)
        hint = args[2] if len(args) > 2 else None
        status = ERROR_CODES.get(code, 400)
        return _error_response(rid, status, code, msg, hint)

    # --- run provider ---
    try:
        result = provider.analyze(img)
    except RuntimeError as exc:
        code = str(exc)
        if code == "MODEL_NOT_READY":
            return _error_response(
                rid, 503, "MODEL_NOT_READY",
                "The ML model is not loaded. Weights may be missing.",
                hint="Ensure classifier.pt and label_map.json are in ml/models/.",
                retryable=True,
            )
        return _error_response(rid, 500, "INTERNAL_ERROR", f"Provider error: {exc}")
    except Exception as exc:
        return _error_response(rid, 500, "INTERNAL_ERROR", f"Unexpected error: {exc}")

    # --- build response ---
    resp = AnalysisResponse(
        request_id=rid,
        provider=provider.name,
        model_version=getattr(provider, "model_version", None),
        status=result.get("status", "ok"),
        items=result.get("items", []),
        totals=result.get("totals"),
        score=result.get("score"),
        advice=result.get("advice", []),
    )
    return JSONResponse(status_code=200, content=resp.model_dump())

