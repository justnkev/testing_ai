from __future__ import annotations

import os
from datetime import datetime, timezone
from tempfile import TemporaryDirectory
from unittest import TestCase
from unittest.mock import patch

import app.routes as routes
from app import create_app
from app.services.health_ingestion import HealthDataIngestion
from app.services.storage_service import StorageService


class DashboardRangeApiTests(TestCase):
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

    def test_dashboard_range_returns_bucketed_activity(self):
        with TemporaryDirectory() as tmpdir:
            app, storage = self._build_app(tmpdir)
            user_id = "user-1"
            today = datetime.now(timezone.utc).date().isoformat()

            storage.upsert_normalized_record(
                "meals",
                {
                    "id": 1,
                    "user_id": user_id,
                    "progress_log_id": 11,
                    "date_inferred": today,
                    "calories": 500,
                },
                on_conflict="id",
            )
            storage.upsert_normalized_record(
                "workouts",
                {
                    "id": 2,
                    "user_id": user_id,
                    "progress_log_id": 12,
                    "date_inferred": today,
                    "duration_min": 30,
                },
                on_conflict="id",
            )
            storage.upsert_normalized_record(
                "sleep",
                {
                    "id": 3,
                    "user_id": user_id,
                    "progress_log_id": 13,
                    "date_inferred": today,
                    "time_asleep": "7.5h",
                },
                on_conflict="id",
            )

            with app.test_client() as client:
                with client.session_transaction() as session:
                    session["user"] = {"id": user_id, "email": "user@example.com"}

                response = client.get("/api/dashboard_range?range=daily")

            self.assertEqual(200, response.status_code)
            payload = response.get_json()
            self.assertIn("data", payload)
            data = payload["data"]

            self.assertEqual(7, len(data.get("labels", [])))
            self.assertEqual(7, len(data.get("meals", [])))
            self.assertEqual(7, len(data.get("workouts", [])))
            self.assertEqual(7, len(data.get("sleep", [])))
            self.assertEqual(1, sum(data["meals"]))
            self.assertEqual(1, sum(data["workouts"]))
            self.assertAlmostEqual(7.5, sum(data["sleep"]))

    def test_dashboard_range_requires_session(self):
        with TemporaryDirectory() as tmpdir:
            app, _storage = self._build_app(tmpdir)

            with app.test_client() as client:
                response = client.get("/api/dashboard_range")

            # login_required decorator issues a redirect when the session is missing
            self.assertEqual(302, response.status_code)
            self.assertIn("/login", response.location)
