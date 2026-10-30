"""AI providers: mock and ml_model. Each provider exposes an `analyze` function."""

from __future__ import annotations

from app.providers.ml_provider import MLModelProvider
from app.providers.mock_provider import MockProvider

__all__ = ["MLModelProvider", "MockProvider"]
