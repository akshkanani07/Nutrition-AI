"""ML model provider — skeleton that returns 503 MODEL_NOT_READY until weights are loaded."""

from __future__ import annotations

from pathlib import Path

from PIL import Image

from app import config


class MLModelProvider:
    """Local ML model provider. Returns 503 when weights are missing."""

    name = "ml_model"

    def __init__(self) -> None:
        self._classifier_path = config.CLASSIFIER_PATH
        self._label_map_path = config.LABEL_MAP_PATH
        self._index_path = config.INDEX_PATH
        self._model = None
        self._label_map: dict | None = None
        self._ready = False
        self._model_version: str | None = None
        self._try_load()

    def _try_load(self) -> None:
        """Attempt to load model artifacts. Set ready=True only if all present."""
        if (
            self._classifier_path.is_file()
            and self._label_map_path.is_file()
        ):
            # Actual loading will be implemented in Stage 3
            self._ready = True
        else:
            self._ready = False

    @property
    def ready(self) -> bool:
        return self._ready

    @property
    def model_version(self) -> str | None:
        return self._model_version

    def analyze(self, img: Image.Image) -> dict:
        """Run inference. Raises RuntimeError if not ready."""
        if not self._ready:
            raise RuntimeError("MODEL_NOT_READY")
        # Stage 3 will implement real inference
        raise RuntimeError("MODEL_NOT_READY")

