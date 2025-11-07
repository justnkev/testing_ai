"""Flask application factory."""

import os
import secrets
from pathlib import Path

from dotenv import load_dotenv
from flask import Flask
from flask_session import Session

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


def create_app() -> Flask:
    """Configure and return the Flask application."""

    load_dotenv()

    app = Flask(__name__)

    # Services discover their own credentials from the environment so the app
    # can run in environments where optional integrations (e.g. Supabase,
    # Gemini) are not configured.
    app.storage_service = StorageService()
    app.ai_service = AIService()

    session_dir = Path(os.environ.get("SESSION_FILE_DIR", "/tmp/flask_session"))
    session_dir.mkdir(parents=True, exist_ok=True)

    app.config["SECRET_KEY"] = _resolve_secret_key()
    app.config["SESSION_TYPE"] = "filesystem"
    app.config["SESSION_FILE_DIR"] = str(session_dir)

    Session(app)

    from .routes import main_bp

    app.register_blueprint(main_bp)

    return app
