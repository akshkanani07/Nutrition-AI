"""In-memory per-IP rate limiter using a sliding window."""

from __future__ import annotations

import time
from collections import defaultdict
from threading import Lock

from app import config


class RateLimiter:
    """Thread-safe sliding-window rate limiter."""

    def __init__(
        self,
        max_requests: int = config.RATE_LIMIT_MAX_REQUESTS,
        window_seconds: int = config.RATE_LIMIT_WINDOW_SECONDS,
    ) -> None:
        self._max = max_requests
        self._window = window_seconds
        self._hits: dict[str, list[float]] = defaultdict(list)
        self._lock = Lock()

    def is_allowed(self, client_ip: str) -> bool:
        """Return True if the request is within the rate limit."""
        now = time.monotonic()
        cutoff = now - self._window
        with self._lock:
            timestamps = self._hits[client_ip]
            # Prune old entries
            self._hits[client_ip] = [t for t in timestamps if t > cutoff]
            if len(self._hits[client_ip]) >= self._max:
                return False
            self._hits[client_ip].append(now)
            return True

