"""AI providers: mock and ml_model. Each provider exposes an `analyze` function."""

from __future__ import annotations

from app.providers.mock_provider import MockProvider
from app.providers.ml_provider import MLModelProvider

__all__ = ["MockProvider", "MLModelProvider"]

