"""Cross-cutting utilities: logging setup and async retry decorator."""

from __future__ import annotations

import asyncio
import functools
import logging
from typing import Any, Callable, TypeVar

T = TypeVar("T")


def setup_logging(level: int = logging.INFO) -> None:
    """Configure root logger with console + file handlers. No print()."""
    fmt = "%(asctime)s | %(levelname)-8s | %(name)s | %(message)s"
    logging.basicConfig(
        level=level,
        format=fmt,
        handlers=[
            logging.StreamHandler(),
            logging.FileHandler("eta_system.log", encoding="utf-8"),
        ],
    )
    # Silence noisy third-party loggers
    logging.getLogger("httpx").setLevel(logging.WARNING)
    logging.getLogger("httpcore").setLevel(logging.WARNING)


def retry(
    max_retries: int = 3,
    backoff_factor: float = 1.0,
    retryable_exceptions: tuple[type[BaseException], ...] = (Exception,),
) -> Callable:
    """Async decorator with exponential back-off.

    Usage::

        @retry(max_retries=3, backoff_factor=1.5)
        async def call_api(...): ...
    """

    def decorator(func: Callable[..., Any]) -> Callable[..., Any]:
        @functools.wraps(func)
        async def wrapper(*args: Any, **kwargs: Any) -> Any:
            logger = logging.getLogger(func.__module__)
            last_exc: BaseException | None = None
            for attempt in range(1, max_retries + 1):
                try:
                    return await func(*args, **kwargs)
                except retryable_exceptions as exc:
                    last_exc = exc
                    wait = backoff_factor * (2 ** (attempt - 1))
                    logger.warning(
                        "Attempt %d/%d for %s failed: %s — retrying in %.1fs",
                        attempt,
                        max_retries,
                        func.__name__,
                        exc,
                        wait,
                    )
                    await asyncio.sleep(wait)
            raise last_exc  # type: ignore[misc]

        return wrapper

    return decorator
