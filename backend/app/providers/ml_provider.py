"""ML model provider — skeleton for Stage 1.

While inference is not implemented (Stage 3), ready must be False and analyze
must raise ModelNotReadyError, even if artifact files exist on disk.
"""

from __future__ import annotations

from PIL import Image

from app.exceptions import ModelNotReadyError


class MLModelProvider:
    """Local ML model provider.

    Always reports ready=False and raises ModelNotReadyError until Stage 3 implementation.
    """

    name = "ml_model"

    def __init__(self) -> None:
        self._ready = False
        self._model_version: str | None = None

    @property
    def ready(self) -> bool:
        return False

    @property
    def model_version(self) -> str | None:
        return self._model_version

    def analyze(self, img: Image.Image) -> dict:
        """Run inference. Raises ModelNotReadyError while weights/inference are not loaded."""
        raise ModelNotReadyError("The ML model is not loaded. Weights may be missing.")
