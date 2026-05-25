from __future__ import annotations

import threading


class Metrics:
    def __init__(self) -> None:
        self._lock = threading.Lock()
        self.products_processed_total = 0
        self.products_failed_total = 0
        self.ai_latency_seconds = 0.0

    def record_success(self, latency_seconds: float) -> None:
        with self._lock:
            self.products_processed_total += 1
            self.ai_latency_seconds = latency_seconds

    def record_failure(self) -> None:
        with self._lock:
            self.products_failed_total += 1

    def snapshot(self) -> dict:
        with self._lock:
            return {
                "products_processed_total": self.products_processed_total,
                "products_failed_total": self.products_failed_total,
                "ai_latency_seconds": self.ai_latency_seconds,
            }


metrics = Metrics()
