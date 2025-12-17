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

    def test_ingest_handles_list_meal_payload(self) -> None:
        with TemporaryDirectory() as tmpdir:
            environ = {"STORAGE_DATA_DIR": tmpdir}
            with self._patched_environ(environ):
                storage = StorageService()
                ai_service = AIService()
                ingestion = HealthDataIngestion(storage, ai_service)

                record = {
                    "id": 1,
                    "user_id": "user-1",
                    "created_at": "2024-01-02T08:00:00+00:00",
                    "log_data": {"timestamp": "2024-01-02T08:00:00+00:00"},
                }

                with patch.object(
                    ai_service,
                    "interpret_health_log",
                    return_value={"meals": [{"date_inferred": "2024-01-02", "meal_type": "lunch"}]},
                ):
                    ingestion.ingest_log(record)

                meals = storage.list_normalized_records("meals", "user-1")
                self.assertEqual(1, len(meals))
                self.assertEqual("lunch", meals[0].get("meal_type"))
                self.assertEqual("2024-01-02", meals[0].get("date_inferred"))

    def test_ingest_defaults_missing_workout_duration_to_zero(self) -> None:
        with TemporaryDirectory() as tmpdir:
            environ = {"STORAGE_DATA_DIR": tmpdir}
            with self._patched_environ(environ):
                storage = StorageService()
                ai_service = AIService()
                ingestion = HealthDataIngestion(storage, ai_service)

                record = {
                    "id": 2,
                    "user_id": "user-1",
                    "created_at": "2024-01-03T08:00:00+00:00",
                    "log_data": {"timestamp": "2024-01-03T08:00:00+00:00"},
                }

                with patch.object(
                    ai_service,
                    "interpret_health_log",
                    return_value={"workout": {"workout_type": "other"}},
                ):
                    ingestion.ingest_log(record)

                workouts = storage.list_normalized_records("workouts", "user-1")
                self.assertEqual(1, len(workouts))
                self.assertEqual(0, workouts[0].get("duration_min"))
                self.assertEqual("other", workouts[0].get("workout_type"))

    def test_ingest_normalizes_macro_fields(self) -> None:
        with TemporaryDirectory() as tmpdir:
            environ = {"STORAGE_DATA_DIR": tmpdir}
            with self._patched_environ(environ):
                storage = StorageService()
                ai_service = AIService()
                ingestion = HealthDataIngestion(storage, ai_service)

                progress_log = {
                    "id": 7,
                    "user_id": "user-1",
                    "created_at": "2024-01-05T12:00:00+00:00",
                    "log_data": {
                        "meals_log": [
                            {
                                "id": 101,
                                "timestamp": "2024-01-05T12:00:00+00:00",
                                "calories": "650",
                                "protein_g": "45",
                                "carbs_g": 70.2,
                                "fat_g": "20g",
                            }
                        ]
                    },
                }

                ingestion.ingest_log(progress_log)

                meals = storage.list_normalized_records("meals", "user-1")
                self.assertEqual(1, len(meals))
                self.assertEqual(650, meals[0]["calories"])
                self.assertEqual(45, meals[0]["protein_g"])
                self.assertEqual(70, meals[0]["carbs_g"])
                self.assertEqual(20, meals[0]["fat_g"])

                macros = ingestion.daily_macros("user-1")
                self.assertEqual(
                    [{
                        "date": "2024-01-05",
                        "protein_g": 45,
                        "carbs_g": 70,
                        "fat_g": 20,
                        "calories": 650,
                    }],
                    macros,
                )

    def test_ingest_defaults_missing_calories_when_ai_unavailable(self) -> None:
        with TemporaryDirectory() as tmpdir:
            environ = {"STORAGE_DATA_DIR": tmpdir}
            with self._patched_environ(environ):
                storage = StorageService()
                ai_service = AIService()
                ingestion = HealthDataIngestion(storage, ai_service)

                progress_log = {
                    "id": 8,
                    "user_id": "user-2",
                    "created_at": "2024-01-06T12:00:00+00:00",
                    "log_data": {
                        "timestamp": "2024-01-06T12:00:00+00:00",
                        "meals_log": [
                            {
                                "id": 201,
                                "timestamp": "2024-01-06T12:00:00+00:00",
                                "text": "Grilled chicken",
                                "notes": "Calorie estimation unavailable; saved with placeholder nutrition values.",
                            }
                        ]
                    },
                }

                ingestion.ingest_log(progress_log)

                meals = storage.list_normalized_records("meals", "user-2")
                self.assertEqual(1, len(meals))
                self.assertEqual(0, meals[0]["calories"])
                self.assertEqual(0, meals[0]["protein_g"])
                self.assertEqual(0, meals[0]["carbs_g"])
                self.assertEqual(0, meals[0]["fat_g"])
                metadata = meals[0].get("metadata") or {}
                self.assertTrue(metadata.get("nutrition_fallback"))
                self.assertIn("placeholder nutrition values", metadata.get("estimation_notes", ""))

    def _patched_environ(self, updates):
        return patch.dict(os.environ, updates, clear=False)
