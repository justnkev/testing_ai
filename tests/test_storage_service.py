from __future__ import annotations

import os
from datetime import datetime, timedelta, timezone
from pathlib import Path
from tempfile import TemporaryDirectory
from types import SimpleNamespace
from unittest import TestCase
from unittest.mock import patch

from app.services.storage_service import StorageService


class StorageServiceRedisTests(TestCase):
    def test_redis_persistence_used_when_supabase_disabled(self) -> None:
        redis_store = {}

        class _FakeRedis:
            def set(self, key: str, value: str) -> None:
                redis_store[key] = value

            def get(self, key: str):
                return redis_store.get(key)

            def delete(self, key: str) -> None:
                redis_store.pop(key, None)

        fake_module = SimpleNamespace(from_url=lambda *args, **kwargs: _FakeRedis())

        environ = {
            "UPSTASH_REDIS_URL": "redis://localhost:6379",
            "STORAGE_DATA_DIR": "/tmp/fitvision-test-data",
        }

        with patch.dict(os.environ, environ, clear=False):
            with patch("app.services.storage_service.redis", fake_module):
                service = StorageService()

        service.save_plan("user@example.com", {"plan": "strength"})
        fetched = service.fetch_plan("user@example.com")

        self.assertEqual({"plan": "strength"}, fetched)
        self.assertIn("fitvision:user@example.com_plan.json", redis_store)
        self.assertFalse(Path("/tmp/fitvision-test-data/user@example.com_plan.json").exists())

        service.clear_conversation("user@example.com")  # should not raise when using Redis


class StorageServiceHealthDataTests(TestCase):
    def setUp(self) -> None:
        self.tmpdir = TemporaryDirectory()
        self.addCleanup(self.tmpdir.cleanup)
        self.env_patch = patch.dict(
            os.environ,
            {
                "STORAGE_DATA_DIR": self.tmpdir.name,
            },
            clear=False,
        )
        self.env_patch.start()
        self.addCleanup(self.env_patch.stop)
        self.service = StorageService()

    def test_upsert_and_fetch_timeseries(self) -> None:
        start = datetime(2024, 5, 1, 7, 30, tzinfo=timezone.utc)
        end = start + timedelta(minutes=30)
        sample = {
            "sample_uuid": "abc123",
            "type": "step_count",
            "value": 4200,
            "unit": "count",
            "start_at": start.isoformat().replace("+00:00", "Z"),
            "end_at": end.isoformat().replace("+00:00", "Z"),
        }

        summary = self.service.upsert_health_samples("user-1", [sample])
        self.assertEqual({"inserted": 1, "updated": 0, "total": 1}, summary)

        window_start = start - timedelta(hours=1)
        window_end = end + timedelta(hours=1)
        results = self.service.fetch_health_timeseries("user-1", "step_count", window_start, window_end)
        self.assertEqual(1, len(results))
        self.assertEqual(4200, results[0]["value"])

        updated_sample = dict(sample)
        updated_sample["value"] = 5000
        summary = self.service.upsert_health_samples("user-1", [updated_sample])
        self.assertEqual({"inserted": 0, "updated": 1, "total": 1}, summary)

        results = self.service.fetch_health_timeseries("user-1", "step_count", window_start, window_end)
        self.assertEqual(5000, results[0]["value"])

    def test_anchor_round_trip(self) -> None:
        anchor = {"step_count": "opaque-token"}
        self.service.save_health_anchor("user-2", anchor)
        fetched = self.service.fetch_health_anchor("user-2")
        self.assertEqual(anchor, fetched)
