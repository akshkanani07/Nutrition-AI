"""In-memory per-IP rate limiter using a sliding window."""

from __future__ import annotations

import ipaddress
import time
from threading import Lock

from app import config


def is_valid_ip(ip: str | None) -> bool:
    """Validate that the given string is a valid IPv4 or IPv6 address."""
    if not ip or not isinstance(ip, str):
        return False
    try:
        ipaddress.ip_address(ip.strip())
        return True
    except (ValueError, TypeError):
        return False


class RateLimiter:
    """Thread-safe sliding-window rate limiter."""

    def __init__(
        self,
        max_requests: int = config.RATE_LIMIT_MAX_REQUESTS,
        window_seconds: int = config.RATE_LIMIT_WINDOW_SECONDS,
    ) -> None:
        self._max = max_requests
        self._window = window_seconds
        self._hits: dict[str, list[float]] = {}
        self._lock = Lock()

    def is_allowed(self, client_ip: str) -> bool:
        """Return True if the request is within the rate limit.

        Any client IP that is not a valid IP address will not create a bucket
        and is immediately disallowed.
        After pruning, if the list is empty, the key is deleted from _hits.
        """
        if not is_valid_ip(client_ip):
            return False

        ip = client_ip.strip()
        now = time.monotonic()
        cutoff = now - self._window

        with self._lock:
            timestamps = self._hits.get(ip, [])
            # Prune old entries
            pruned = [t for t in timestamps if t > cutoff]

            if not pruned:
                self._hits.pop(ip, None)
            else:
                self._hits[ip] = pruned

            if len(pruned) >= self._max:
                return False

            if ip not in self._hits:
                self._hits[ip] = []
            self._hits[ip].append(now)
            return True

    def prune(self, now: float | None = None) -> None:
        """Prune expired timestamps across all buckets and delete empty keys."""
        current_time = time.monotonic() if now is None else now
        cutoff = current_time - self._window
        with self._lock:
            for ip in list(self._hits.keys()):
                pruned = [t for t in self._hits[ip] if t > cutoff]
                if not pruned:
                    del self._hits[ip]
                else:
                    self._hits[ip] = pruned

    def reset(self) -> None:
        """Reset all rate limit counters."""
        with self._lock:
            self._hits.clear()
