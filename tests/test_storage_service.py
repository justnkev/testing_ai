from __future__ import annotations

import os
from pathlib import Path
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


class StorageServiceConfigTests(TestCase):
    def test_supabase_client_config_reads_env_priority(self) -> None:
        environ = {
            "SUPABASE_URL_SECRET": "https://secret.example.com",
            "SUPABASE_PROJECT_URL": "https://project.example.com",
            "SUPABASE_ANON_KEY_SECRET": "anon-secret",
            "SUPABASE_API_KEY": "anon-api",
        }

        with patch.dict(os.environ, environ, clear=False):
            config = StorageService.supabase_client_config()

        self.assertEqual("https://secret.example.com", config["url"])
        self.assertEqual("anon-secret", config["anon_key"])
