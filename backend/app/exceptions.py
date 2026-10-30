"""Custom typed exceptions for Nutrify AI."""

from __future__ import annotations


class ModelNotReadyError(Exception):
    """Raised when the ML model weights or label map are missing or not loaded."""

    def __init__(self, message: str = "The ML model is not loaded. Weights may be missing.") -> None:
        super().__init__(message)
        self.message = message


class ConfigurationError(Exception):
    """Raised when application configuration is invalid (e.g. mock in production)."""

    def __init__(self, message: str) -> None:
        super().__init__(message)
        self.message = message

