from __future__ import annotations

import os
from datetime import timedelta
from tempfile import TemporaryDirectory
from unittest import TestCase
from unittest.mock import patch

import app.routes as routes
from app import create_app
from app.services.storage_service import StorageService


class DashboardTrendsTests(TestCase):
    def _build_app(self, data_dir: str):
        with patch.dict(os.environ, {"STORAGE_DATA_DIR": data_dir}, clear=False):
            storage = StorageService()

        with patch.object(routes, "storage_service", storage):
            app = create_app()

        app.config["TESTING"] = True
        app.storage_service = storage
        return app, storage

    def test_trend_aggregation_returns_buckets_and_series(self):
        with TemporaryDirectory() as tmpdir:
            _app, storage = self._build_app(tmpdir)
            user_id = "user-abc"

            buckets = routes._chart_buckets("weekly")
            current_bucket = buckets[-1]
            first_day = current_bucket["start"]

            storage.upsert_normalized_record(
                "meals",
                {
                    "id": 1,
                    "user_id": user_id,
                    "progress_log_id": 101,
                    "date_inferred": first_day.isoformat(),
                    "protein_g": 40,
                    "carbs_g": 55,
                    "fat_g": 20,
                    "calories": 600,
                },
                on_conflict="id",
            )
            storage.upsert_normalized_record(
                "sleep",
                {
                    "id": 2,
                    "user_id": user_id,
                    "progress_log_id": 102,
                    "date_inferred": (first_day + timedelta(days=1)).isoformat(),
                    "time_asleep": "7.5h",
                    "quality": "good",
                },
                on_conflict="id",
            )
            storage.upsert_normalized_record(
                "workouts",
                {
                    "id": 3,
                    "user_id": user_id,
                    "progress_log_id": 103,
                    "date_inferred": (first_day + timedelta(days=2)).isoformat(),
                    "workout_type": "strength",
                    "duration_min": 45,
                },
                on_conflict="id",
            )

            payload = routes._aggregate_trend_series("weekly", user_id, storage)

            self.assertEqual(4, len(payload["labels"]))
            self.assertEqual([0.0, 0.0, 0.0, 40.0], payload["macros"]["protein"])
            self.assertIn("good", payload["sleep"]["qualities"])
            self.assertEqual(4, len(payload["sleep"]["series"]["good"]))
            self.assertIn("strength", payload["workouts"]["types"])
            self.assertEqual([0, 0, 0, 1], payload["workouts"]["counts"]["strength"])
            self.assertEqual([0.0, 0.0, 0.0, 45.0], payload["workouts"]["durations"]["strength"])

    def test_trend_aggregation_handles_empty_data(self):
        with TemporaryDirectory() as tmpdir:
            _app, storage = self._build_app(tmpdir)
            user_id = "user-empty"

            payload = routes._aggregate_trend_series("monthly", user_id, storage)

            self.assertEqual(6, len(payload["labels"]))
            self.assertTrue(all(value == 0.0 for value in payload["macros"]["protein"]))
            self.assertEqual([], payload["sleep"]["qualities"])
            self.assertEqual({}, payload["sleep"]["series"])
            self.assertEqual([], payload["workouts"]["types"])
            self.assertEqual({}, payload["workouts"]["counts"])
