"""Flask application factory."""

import logging
import os
import secrets
from pathlib import Path

from dotenv import load_dotenv
from flask import Flask
from flask_session import Session

try:
    import redis  # type: ignore
except Exception:  # pragma: no cover - optional dependency
    redis = None  # type: ignore

logger = logging.getLogger(__name__)


def _resolve_secret_key() -> str:
    """Return a secret key for Flask sessions.

    In production we expect ``FLASK_SECRET_KEY`` (or the legacy ``SECRET_KEY``)
    to be configured. When the environment variable is missing—such as during
    local testing—we generate a temporary key to avoid crashing at import time.
    """

    for name in ("FLASK_SECRET_KEY", "SECRET_KEY"):
        value = os.environ.get(name)
        if value:
            return value

    # Fall back to a random value so the app can boot even without
    # configuration. This mirrors Flask's default development behaviour.
    return secrets.token_hex(32)


def _running_on_vercel() -> bool:
    """Return ``True`` when executing inside the Vercel serverless runtime."""

    return bool(os.environ.get("VERCEL") or os.environ.get("VERCEL_ENV"))


def _resolve_database_uri(app: Flask) -> str:
    """Return the database URI configured for the application."""

    supabase_pool_url = os.environ.get("SUPABASE_DB_POOL_URL")
    if supabase_pool_url:
        return supabase_pool_url

    configured_url = os.environ.get("DATABASE_URL")
    if configured_url:
        return configured_url

    default_sqlite_path = Path(app.instance_path) / "fitvision.sqlite"

    if not _running_on_vercel():
        try:
            default_sqlite_path.parent.mkdir(parents=True, exist_ok=True)
        except OSError:
            # Read-only filesystems (e.g. certain CI providers) should not break
            # the application startup when SQLite is only a development fallback.
            pass

    return f"sqlite:///{default_sqlite_path}"


def create_app() -> Flask:
    """Configure and return the Flask application."""

    load_dotenv()

    app = Flask(__name__)

    # Services discover their own credentials from the environment so the app
    # can run in environments where optional integrations (e.g. Supabase,
    # Gemini) are not configured.
    from .routes import ai_service, health_ingestion, storage_service

    app.storage_service = storage_service
    app.ai_service = ai_service
    app.health_ingestion = health_ingestion

    app.config["SECRET_KEY"] = _resolve_secret_key()
    app.config["ASSET_VERSION"] = os.environ.get("ASSET_VERSION", "1")
    redis_session_client = None
    redis_url = os.environ.get("UPSTASH_REDIS_URL")
    if redis_url and redis is not None:
        try:
            redis_session_client = redis.from_url(redis_url)
        except Exception:  # pragma: no cover - network dependent
            logger.warning(
                "Redis session initialisation failed; falling back to filesystem",
                exc_info=True,
            )
    elif redis_url and redis is None:
        logger.info("Redis package not installed; using filesystem session store")

    if redis_session_client is not None:
        app.config["SESSION_TYPE"] = "redis"
        app.config["SESSION_REDIS"] = redis_session_client
    else:
        session_dir = Path(os.environ.get("SESSION_FILE_DIR", "/tmp/flask_session"))
        session_dir.mkdir(parents=True, exist_ok=True)
        app.config["SESSION_TYPE"] = "filesystem"
        app.config["SESSION_FILE_DIR"] = str(session_dir)

    app.config["SQLALCHEMY_DATABASE_URI"] = _resolve_database_uri(app)

    Session(app)

    from .routes import main_bp

    app.register_blueprint(main_bp)

    try:
        app.health_ingestion.start_background_tasks()
    except Exception:
        logger.warning("health_ingestion.start_failed", exc_info=True)

    return app
