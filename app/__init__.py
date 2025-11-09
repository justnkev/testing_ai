"""Flask application factory."""

import os
import secrets
from datetime import timedelta
from pathlib import Path

from dotenv import load_dotenv
from flask import Flask
from flask_session import Session
from sqlalchemy.exc import SQLAlchemyError
from sqlalchemy.pool import NullPool

from .extensions import db
from .services.ai_service import AIService
from .services.storage_service import StorageService


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


def _bool_from_env(name: str, default: bool = False) -> bool:
    value = os.environ.get(name)
    if value is None:
        return default
    return value.lower() in {"1", "true", "yes", "on"}


def create_app() -> Flask:
    """Configure and return the Flask application."""

    load_dotenv()

    app = Flask(__name__)

    # Services discover their own credentials from the environment so the app
    # can run in environments where optional integrations (e.g. Supabase,
    # Gemini) are not configured.
    app.storage_service = StorageService()
    app.ai_service = AIService()

    app.config["SECRET_KEY"] = _resolve_secret_key()

    # --- Session configuration -----------------------------------------
    is_vercel = _bool_from_env("VERCEL", False) or bool(os.environ.get("VERCEL_ENV"))
    flask_env = os.environ.get("FLASK_ENV", "").lower()
    is_production = flask_env in {"production", "prod"} or is_vercel

    session_cookie_name = os.environ.get("SESSION_COOKIE_NAME", "fitvision_session")
    same_site_env = os.environ.get("SESSION_COOKIE_SAMESITE")
    same_site_default = "Lax"
    if same_site_env and same_site_env.lower() == "none":
        same_site_default = "None"

    app.config.update(
        SESSION_TYPE="sqlalchemy",
        SESSION_SQLALCHEMY=db,
        SESSION_SQLALCHEMY_TABLE=os.environ.get("SESSION_TABLE", "sessions"),
        SESSION_PERMANENT=True,
        PERMANENT_SESSION_LIFETIME=timedelta(
            days=int(os.environ.get("SESSION_LIFETIME_DAYS", "14"))
        ),
        SESSION_COOKIE_SECURE=_bool_from_env("SESSION_COOKIE_SECURE", is_vercel or is_production),
        SESSION_COOKIE_SAMESITE=os.environ.get("SESSION_COOKIE_SAMESITE", same_site_default),
        SESSION_COOKIE_HTTPONLY=True,
        SESSION_COOKIE_NAME=session_cookie_name,
        SESSION_COOKIE_DOMAIN=os.environ.get("SESSION_COOKIE_DOMAIN"),
        SESSION_USE_SIGNER=False,
    )

    default_sqlite_path = Path(app.instance_path) / "dev.db"
    default_sqlite_path.parent.mkdir(parents=True, exist_ok=True)
    database_uri = os.environ.get("SUPABASE_DB_POOL_URL")
    if not database_uri:
        if is_production:
            raise RuntimeError(
                "SUPABASE_DB_POOL_URL is required in production to persist sessions."
            )
        database_uri = os.environ.get(
            "LOCAL_DATABASE_URI",
            f"sqlite:///{default_sqlite_path}",
        )

    if database_uri.startswith("sqlite:///"):
        sqlite_path = database_uri.replace("sqlite:///", "", 1)
        Path(sqlite_path).expanduser().parent.mkdir(parents=True, exist_ok=True)

    sslmode = os.environ.get("DATABASE_SSLMODE")
    if sslmode and "sslmode=" not in database_uri:
        separator = "&" if "?" in database_uri else "?"
        database_uri = f"{database_uri}{separator}sslmode={sslmode}"

    app.config["SQLALCHEMY_DATABASE_URI"] = database_uri
    engine_options = {"pool_pre_ping": True}
    if is_vercel:
        engine_options["poolclass"] = NullPool
    app.config["SQLALCHEMY_ENGINE_OPTIONS"] = engine_options
    app.config.setdefault("SQLALCHEMY_TRACK_MODIFICATIONS", False)

    # Ensure models are registered with SQLAlchemy before any table creation.
    from . import models  # noqa: F401

    db.init_app(app)

    # Ensure the session backend can talk to the database at startup when the
    # deployment requires it. This surfaces configuration issues immediately on
    # cold starts rather than failing mid-request.
    if is_production:
        try:
            with app.app_context():
                connection = db.engine.connect()
                connection.close()
        except SQLAlchemyError as exc:  # pragma: no cover - network dependent
            raise RuntimeError("Database connectivity failed for session storage") from exc

    if "sessions" in db.metadata.tables:
        db.metadata.remove(db.metadata.tables["sessions"])

    Session(app)

    if not is_production:
        with app.app_context():
            db.create_all()

    from .routes import main_bp

    app.register_blueprint(main_bp)

    return app
