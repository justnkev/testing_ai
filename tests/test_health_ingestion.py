from __future__ import annotations

import os
import sys
from tempfile import TemporaryDirectory
from types import ModuleType
from unittest import TestCase
from unittest.mock import patch

stub_google = sys.modules.setdefault("google", ModuleType("google"))
stub_genai = ModuleType("google.genai")


class _DummyClient:  # pragma: no cover - stub
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

from app.services.ai_service import AIService
from app.services.health_ingestion import HealthDataIngestion
from app.services.storage_service import StorageService


class HealthIngestionTests(TestCase):
    def test_ingest_log_populates_normalized_rows(self) -> None:
        with TemporaryDirectory() as tmpdir:
            environ = {"STORAGE_DATA_DIR": tmpdir}
            with self._patched_environ(environ):
                storage = StorageService()
                ai_service = AIService()
                ingestion = HealthDataIngestion(storage, ai_service)

                log_entry = {
                    "timestamp": "2024-01-02T10:00:00+00:00",
                    "meals": "Breakfast omelette",
                    "calories": 450,
                    "sleep": "Slept 7 hours and felt good",
                    "workout": "30 minutes run",
                }

                record = storage.append_log("user-1", log_entry)
                ingestion.ingest_log(record)

                meals = storage.list_normalized_records("meals", "user-1")
                self.assertEqual(1, len(meals))
                self.assertEqual(450, meals[0]["calories"])
                self.assertEqual(record["id"], meals[0]["progress_log_id"])

                sleep_rows = storage.list_normalized_records("sleep", "user-1")
                self.assertEqual(1, len(sleep_rows))
                self.assertTrue(
                    sleep_rows[0].get("time_asleep", "").startswith("7"),
                    sleep_rows[0],
                )

                workouts = storage.list_normalized_records("workouts", "user-1")
                self.assertEqual(1, len(workouts))
                self.assertEqual(30, workouts[0]["duration_min"])

                calories = ingestion.daily_calories("user-1")
                self.assertEqual([{"date": "2024-01-02", "calories": 450}], calories)

    def _patched_environ(self, updates):
        return patch.dict(os.environ, updates, clear=False)

