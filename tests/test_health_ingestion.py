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

                progress_log = {
                    "id": 1,
                    "user_id": "user-1",
                    "created_at": "2024-01-02T10:00:00+00:00",
                    "log_data": {
                        "meals_log": [
                            {
                                "id": "meal-1",
                                "timestamp": "2024-01-02T10:00:00+00:00",
                                "calories": 450,
                            }
                        ],
                        "sleep_log": [
                            {
                                "id": "sleep-1",
                                "timestamp": "2024-01-02T10:00:00+00:00",
                                "time_asleep": 7,
                            }
                        ],
                        "workouts_log": [
                            {
                                "id": "workout-1",
                                "timestamp": "2024-01-02T10:00:00+00:00",
                                "duration_min": 30,
                            }
                        ],
                    },
                }

                ingestion.ingest_log(progress_log)

                meals = storage.list_normalized_records("meals", "user-1")
                self.assertEqual(1, len(meals))
                self.assertEqual(450, meals[0]["calories"])
                self.assertEqual(progress_log["id"], meals[0]["progress_log_id"])

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
                    "log_data": {
                        "meals_log": [
                            {
                                "id": "meal-1",
                                "timestamp": "2024-01-02T08:00:00+00:00",
                                "date_inferred": "2024-01-02",
                                "meal_type": "lunch",
                            }
                        ]
                    },
                }

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
                    "log_data": {
                        "workouts_log": [
                            {
                                "id": "workout-2",
                                "timestamp": "2024-01-03T08:00:00+00:00",
                                "workout_type": "other",
                            }
                        ]
                    },
                }

                ingestion.ingest_log(record)

                workouts = storage.list_normalized_records("workouts", "user-1")
                self.assertEqual(1, len(workouts))
                self.assertEqual(0, workouts[0].get("duration_min"))
                self.assertEqual("other", workouts[0].get("workout_type"))

    def test_daily_progress_summary_aggregates_normalized_records(self) -> None:
        with TemporaryDirectory() as tmpdir:
            environ = {"STORAGE_DATA_DIR": tmpdir}
            with self._patched_environ(environ):
                storage = StorageService()
                ai_service = AIService()
                ingestion = HealthDataIngestion(storage, ai_service)

                storage.upsert_normalized_record(
                    "meals",
                    {
                        "id": "m1",
                        "user_id": "user-1",
                        "progress_log_id": 1,
                        "date_inferred": "2024-01-02",
                        "calories": 400,
                    },
                    on_conflict="id",
                )
                storage.upsert_normalized_record(
                    "meals",
                    {
                        "id": "m2",
                        "user_id": "user-1",
                        "progress_log_id": 2,
                        "date_inferred": "2024-01-02",
                        "calories": 500,
                    },
                    on_conflict="id",
                )
                storage.upsert_normalized_record(
                    "workouts",
                    {
                        "id": "w1",
                        "user_id": "user-1",
                        "progress_log_id": 3,
                        "date_inferred": "2024-01-02",
                        "duration_min": 30,
                    },
                    on_conflict="id",
                )
                storage.upsert_normalized_record(
                    "sleep",
                    {
                        "id": "s1",
                        "user_id": "user-1",
                        "progress_log_id": 4,
                        "date_inferred": "2024-01-02",
                        "time_asleep": "7.5h",
                    },
                    on_conflict="id",
                )

                summaries = ingestion.get_daily_progress_summary("user-1")

                self.assertEqual(
                    [
                        {
                            "date": "2024-01-02",
                            "totals": {
                                "meals": {"count": 2, "calories": 900},
                                "workouts": {"count": 1, "duration_min": 30},
                                "sleep": {"hours": 7.5},
                            },
                        }
                    ],
                    summaries,
                )

    def _patched_environ(self, updates):
        return patch.dict(os.environ, updates, clear=False)

