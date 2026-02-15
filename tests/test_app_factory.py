from __future__ import annotations

import os
import sys
from pathlib import Path
from types import ModuleType
from unittest import TestCase
from unittest.mock import patch, call

PROJECT_ROOT = Path(__file__).resolve().parents[1]
if str(PROJECT_ROOT) not in sys.path:
    sys.path.insert(0, str(PROJECT_ROOT))

stub_google = sys.modules.setdefault("google", ModuleType("google"))
stub_genai = ModuleType("google.genai")


class _DummyClient:  # pragma: no cover - simple stub for import time
    def __init__(self, *args, **kwargs):
        pass


stub_genai.Client = _DummyClient
stub_google.genai = stub_genai
sys.modules.setdefault("google.genai", stub_genai)

stub_types = ModuleType("google.genai.types")


class _DummyPart:
    @staticmethod
    def from_bytes(data: bytes, mime_type: str):  # pragma: no cover - stub helper
        return {"data": data, "mime_type": mime_type}


stub_types.Part = _DummyPart
sys.modules.setdefault("google.genai.types", stub_types)

from app import create_app


class AppFactoryDatabaseTests(TestCase):
    def test_supabase_pool_url_skips_sqlite_directory_creation(self) -> None:
        """``create_app`` should not touch the SQLite directory when Supabase is configured."""

        environ = {
            "SUPABASE_DB_POOL_URL": "postgresql://user:password@db.example.com:5432/postgres",
            "SESSION_FILE_DIR": "/tmp/flask_session",
            "STORAGE_DATA_DIR": "/tmp/fitvision-data",
            "DATABASE_URL": "",
        }

        with patch.dict(os.environ, environ, clear=False):
            with patch("app.__init__.Path.mkdir") as mock_mkdir:
                app = create_app()

        sqlite_parent = Path(app.instance_path)
        touched_paths = [call.args[0] for call in mock_mkdir.mock_calls if call.args]

        self.assertNotIn(sqlite_parent, touched_paths)

    def test_redis_session_configuration(self) -> None:
        environ = {
            "UPSTASH_REDIS_URL": "rediss://default:password@global-example.upstash.io:6379",
            "STORAGE_DATA_DIR": "/tmp/fitvision-data",
        }

        fake_client = object()

        with patch.dict(os.environ, environ, clear=False):
            with patch("app.redis") as mock_redis, patch("app.Session") as mock_session:
                mock_redis.from_url.return_value = fake_client
                app = create_app()

        self.assertEqual("redis", app.config["SESSION_TYPE"])
        self.assertIs(app.config["SESSION_REDIS"], fake_client)
        mock_session.assert_called_once()
