from __future__ import annotations

import os
from tempfile import TemporaryDirectory
from unittest import TestCase
from unittest.mock import patch

import app.routes as routes
from app import create_app
from app.services.health_ingestion import HealthDataIngestion
from app.services.storage_service import StorageService


class DashboardDataApiTests(TestCase):
    def _build_app(self, data_dir: str):
        with patch.dict(os.environ, {"STORAGE_DATA_DIR": data_dir}, clear=False):
            storage = StorageService()
        ingestion = HealthDataIngestion(storage, routes.ai_service)

        with (
            patch.object(routes, "storage_service", storage),
            patch.object(routes, "health_ingestion", ingestion),
            patch.object(ingestion, "start_background_tasks", return_value=None),
        ):
            app = create_app()

        app.config["TESTING"] = True
        app.storage_service = storage
        return app, storage

    def test_dashboard_data_requires_login(self):
        with TemporaryDirectory() as tmpdir:
            app, _storage = self._build_app(tmpdir)
            with app.test_client() as client:
                response = client.get("/api/dashboard_data")
            self.assertEqual(302, response.status_code)
            self.assertIn("/login", response.location)

    def test_dashboard_data_returns_normalized_payload(self):
        with TemporaryDirectory() as tmpdir:
            app, storage = self._build_app(tmpdir)
            user_id = "user-2"

            storage.upsert_normalized_record(
                "meals",
                {
                    "id": 1,
                    "user_id": user_id,
                    "progress_log_id": 11,
                    "date_inferred": "2023-08-01",
                    "protein_g": "10",
                    "carbs_g": 20,
                    "fat_g": None,
                    "calories": "300",
                },
                on_conflict="id",
            )
            storage.upsert_normalized_record(
                "sleep",
                {
                    "id": 2,
                    "user_id": user_id,
                    "progress_log_id": 12,
                    "date_inferred": "2023-08-02",
                    "time_asleep": "6h 30m",
                    "quality": "Good",
                },
                on_conflict="id",
            )
            storage.upsert_normalized_record(
                "workouts",
                {
                    "id": 3,
                    "user_id": user_id,
                    "progress_log_id": 13,
                    "date_inferred": "2023-08-03",
                    "workout_type": "Cardio",
                    "duration_min": "45",
                },
                on_conflict="id",
            )

            with app.test_client() as client:
                with client.session_transaction() as session:
                    session["user"] = {"id": user_id, "email": "test@example.com"}

                response = client.get("/api/dashboard_data")

            self.assertEqual(200, response.status_code)
            payload = response.get_json()
            self.assertIn("data", payload)
            data = payload["data"]

            self.assertEqual(1, len(data.get("meals", [])))
            meal = data["meals"][0]
            self.assertEqual(10, meal["protein_g"])
            self.assertEqual(20, meal["carbs_g"])
            self.assertEqual(0, meal["fat_g"])
            self.assertEqual(300, meal["calories"])
            self.assertEqual("Meal", meal["meal_type"])

            self.assertEqual(1, len(data.get("sleep", [])))
            sleep = data["sleep"][0]
            self.assertEqual("Good", sleep["quality"])
            self.assertAlmostEqual(6.5, sleep["hours"], delta=0.01)

            self.assertEqual(1, len(data.get("workouts", [])))
            workout = data["workouts"][0]
            self.assertEqual("Cardio", workout["workout_type"])
            self.assertEqual(45, workout["duration_min"])
