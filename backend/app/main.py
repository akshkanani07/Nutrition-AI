"""Nutrify AI — FastAPI application."""

from __future__ import annotations

import uuid
from typing import Annotated

from fastapi import FastAPI, File, Request, UploadFile
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse

from app import config
from app.exceptions import ConfigurationError, ModelNotReadyError
from app.image_utils import validate_and_preprocess
from app.providers.ml_provider import MLModelProvider
from app.providers.mock_provider import MockProvider
from app.rate_limit import RateLimiter
from app.schemas import (
    AnalysisResponse,
    ErrorDetail,
    ErrorResponse,
    HealthResponse,
)

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
    """Extract client IP, honouring X-Forwarded-For from trusted proxies.

    Walks X-Forwarded-For from right to left and returns the first entry
    that is not in TRUSTED_PROXIES. The header is only evaluated when
    the direct connecting socket host is in TRUSTED_PROXIES.
    """
    client_host = request.client.host if request.client else "unknown"
    if client_host not in config.TRUSTED_PROXIES:
        return client_host

    forwarded = request.headers.get("x-forwarded-for")
    if not forwarded:
        return client_host

    # Walk right-to-left
    hops = [hop.strip() for hop in forwarded.split(",") if hop.strip()]
    for hop in reversed(hops):
        if hop not in config.TRUSTED_PROXIES:
            return hop

    return client_host


def _resolve_provider(application: FastAPI) -> MockProvider | MLModelProvider:
    provider = getattr(application.state, "provider", None)
    if provider is not None:
        return provider

    if config.AI_PROVIDER == "mock":
        provider = MockProvider()
    elif config.AI_PROVIDER == "ml_model":
        provider = MLModelProvider()
    else:
        raise RuntimeError(f"Unknown AI_PROVIDER: {config.AI_PROVIDER}")

    application.state.provider = provider
    return provider


def create_app() -> FastAPI:
    """Application factory: validates configuration, instantiates FastAPI, and owns RateLimiter."""
    # Single source of truth for production configuration validation
    if config.APP_ENV == "production" and config.AI_PROVIDER == "mock" and not config.ALLOW_MOCK:
        raise ConfigurationError(
            "Mock provider is refused in production unless ALLOW_MOCK=true is explicitly set."
        )

    application = FastAPI(title="Nutrify AI", version=config.APP_VERSION)

    application.add_middleware(
        CORSMiddleware,
        allow_origins=config.ALLOWED_ORIGINS,
        allow_credentials=False,
        allow_methods=["GET", "POST", "OPTIONS"],
        allow_headers=["*"],
    )

    application.state.rate_limiter = RateLimiter()
    application.state.provider = None

    @application.get("/api/v1/health", response_model=HealthResponse)
    async def health() -> HealthResponse:
        provider = _resolve_provider(application)
        return HealthResponse(
            status="ok",
            version=config.APP_VERSION,
            provider=provider.name,
            provider_ready=provider.ready,
            model_version=getattr(provider, "model_version", None),
        )

    @application.post("/api/v1/analyze-food")
    async def analyze_food(
        request: Request,
        image: Annotated[UploadFile | None, File()] = None,
    ) -> JSONResponse:
        rid = _request_id()

        # --- rate limit ---
        rate_limiter: RateLimiter = request.app.state.rate_limiter
        client_ip = _get_client_ip(request)
        if not rate_limiter.is_allowed(client_ip):
            return _error_response(
                rid,
                429,
                "RATE_LIMITED",
                "Too many requests. Please try again later.",
                hint="Wait 60 seconds before retrying.",
                retryable=True,
            )

        # --- provider check ---
        provider = _resolve_provider(request.app)

        # --- image present? ---
        if image is None or image.filename == "":
            return _error_response(
                rid,
                400,
                "MISSING_IMAGE",
                "No image was uploaded.",
                hint="Attach an image file to the 'image' form field.",
            )

        # --- read and validate ---
        try:
            data = await image.read()
        except Exception:
            return _error_response(
                rid,
                400,
                "INVALID_IMAGE",
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
        except ModelNotReadyError as exc:
            return _error_response(
                rid,
                503,
                "MODEL_NOT_READY",
                exc.message,
                hint="Ensure classifier.pt and label_map.json are in ml/models/.",
                retryable=True,
            )
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

    return application


app = create_app()
