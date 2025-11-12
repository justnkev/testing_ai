from __future__ import annotations

import os
import sys
from datetime import datetime, timedelta, timezone
from pathlib import Path
from tempfile import TemporaryDirectory
from types import ModuleType
from unittest import TestCase
from unittest.mock import patch

import jwt

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
import app.routes as routes_module
from app.services.storage_service import StorageService


class HealthkitApiTests(TestCase):
    def setUp(self) -> None:
        self.tmpdir = TemporaryDirectory()
        self.addCleanup(self.tmpdir.cleanup)
        self.secret = "test-secret"

        environ = {
            "STORAGE_DATA_DIR": self.tmpdir.name,
            "HEALTHKIT_JWT_SECRET": self.secret,
        }

        self.env_patch = patch.dict(os.environ, environ, clear=False)
        self.env_patch.start()
        self.addCleanup(self.env_patch.stop)

        self.original_storage = routes_module.storage_service
        self.test_storage = StorageService()
        routes_module.storage_service = self.test_storage
        self.addCleanup(lambda: setattr(routes_module, "storage_service", self.original_storage))

        self.app = create_app()
        self.app.config["TESTING"] = True
        self.client = self.app.test_client()

    def _token(self, sub: str) -> str:
        payload = {
            "sub": sub,
            "exp": int((datetime.now(timezone.utc) + timedelta(minutes=5)).timestamp()),
        }
        return jwt.encode(payload, self.secret, algorithm="HS256")

    def test_ingest_persists_samples_and_anchor(self) -> None:
        token = self._token("user-apple")
        start = datetime(2024, 5, 2, 9, 0, tzinfo=timezone.utc)
        end = start + timedelta(minutes=5)
        payload = {
            "user_id": "user-apple",
            "device_id": "device-123",
            "anchor": {"step_count": "anchor-token"},
            "samples": [
                {
                    "sample_uuid": "uuid-1",
                    "type": "step_count",
                    "value": 1200,
                    "unit": "count",
                    "start_at": start.isoformat().replace("+00:00", "Z"),
                    "end_at": end.isoformat().replace("+00:00", "Z"),
                }
            ],
        }

        response = self.client.post(
            "/api/healthkit/ingest",
            json=payload,
            headers={"Authorization": f"Bearer {token}"},
        )
        self.assertEqual(200, response.status_code)
        body = response.get_json()
        self.assertEqual(1, body["accepted"])
        self.assertEqual({"step_count": "anchor-token"}, body["anchor"])

        window_start = start - timedelta(hours=1)
        window_end = end + timedelta(hours=1)
        stored = self.test_storage.fetch_health_timeseries("user-apple", "step_count", window_start, window_end)
        self.assertEqual(1, len(stored))
        self.assertEqual(1200, stored[0]["value"])

        # Duplicate should not increase total but registers an update when value changes
        payload["samples"][0]["value"] = 1500
        response = self.client.post(
            "/api/healthkit/ingest",
            json=payload,
            headers={"Authorization": f"Bearer {token}"},
        )
        self.assertEqual(200, response.status_code)
        body = response.get_json()
        self.assertEqual(0, body["accepted"])
        self.assertEqual(1, body["updated"])

    def test_types_endpoint_returns_supported_list(self) -> None:
        token = self._token("user-apple")
        response = self.client.get(
            "/api/healthkit/types",
            headers={"Authorization": f"Bearer {token}"},
        )
        self.assertEqual(200, response.status_code)
        body = response.get_json()
        self.assertIn("types", body)
        self.assertIn("step_count", body["types"])

    def test_ingest_rejects_missing_token(self) -> None:
        response = self.client.post("/api/healthkit/ingest", json={})
        self.assertEqual(401, response.status_code)
