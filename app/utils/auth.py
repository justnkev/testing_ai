"""Authentication helpers for FitVision APIs."""

from __future__ import annotations

from dataclasses import dataclass
from datetime import datetime, timezone
from typing import Any, Dict

import jwt


@dataclass
class AuthError(Exception):
    """Raised when device authentication fails."""

    message: str
    status_code: int = 401

    def __str__(self) -> str:  # pragma: no cover - dataclass convenience
        return self.message


def decode_device_jwt(token: str, secret: str) -> Dict[str, Any]:
    """Validate and decode a short-lived JWT from a companion device.

    Parameters
    ----------
    token:
        The encoded JWT string sent by the device in the ``Authorization``
        header.
    secret:
        Shared secret for verifying the signature. The secret should be
        rotated regularly and supplied via the ``HEALTHKIT_JWT_SECRET``
        environment variable.

    Returns
    -------
    dict
        The decoded token payload.

    Raises
    ------
    AuthError
        If the token is missing, invalid, expired, or the secret is not
        configured on the server.
    """

    if not secret:
        raise AuthError("HealthKit ingestion is not configured on this server.", 503)

    if not token:
        raise AuthError("Authorization token missing.")

    try:
        payload = jwt.decode(
            token,
            secret,
            algorithms=["HS256"],
            options={"require": ["exp", "sub"]},
        )
    except jwt.ExpiredSignatureError as exc:
        raise AuthError("Authorization token has expired.") from exc
    except jwt.InvalidTokenError as exc:
        raise AuthError("Authorization token is invalid.") from exc

    exp = payload.get("exp")
    if isinstance(exp, (int, float)):
        expiry = datetime.fromtimestamp(exp, tz=timezone.utc)
        if expiry < datetime.now(timezone.utc):
            raise AuthError("Authorization token has expired.")

    return payload

