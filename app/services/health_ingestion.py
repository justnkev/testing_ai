from __future__ import annotations

import logging
import threading
from collections import defaultdict
from datetime import datetime, timezone
from queue import Queue
from typing import Any, Dict, List, Optional

logger = logging.getLogger(__name__)


class HealthDataIngestion:
    """Background ingestion and backfill for progress logs."""

    def __init__(self, storage_service, ai_service) -> None:
        self._storage = storage_service
        self._ai = ai_service
        self._queue: "Queue[Dict[str, Any]]" = Queue()
        self._worker: Optional[threading.Thread] = None
        self._backfill_started = False
        self._lock = threading.Lock()

    def start_background_tasks(self) -> None:
        """Start the worker and kick off a one-time backfill."""

        with self._lock:
            if self._worker is None or not self._worker.is_alive():
                self._worker = threading.Thread(target=self._worker_loop, daemon=True)
                self._worker.start()

            if not self._backfill_started:
                self._backfill_started = True
                threading.Thread(target=self.backfill_all_logs, daemon=True).start()

    def enqueue_log_record(self, progress_log: Dict[str, Any]) -> None:
        if not progress_log:
            return
        self._queue.put(progress_log)

    def _worker_loop(self) -> None:  # pragma: no cover - background thread
        while True:
            record = self._queue.get()
            try:
                self.ingest_log(record)
            except Exception:
                logger.warning("health_ingestion.ingest_failed", exc_info=True)

    def backfill_all_logs(self) -> None:
        """Process all existing logs once at startup."""

        try:
            records = self._storage.fetch_progress_log_records()
        except Exception:
            logger.warning("health_ingestion.backfill.fetch_failed", exc_info=True)
            return

        for record in records:
            progress_log_id = record.get("id")
            if progress_log_id and self._storage.get_normalized_by_progress_log(
                "meals", progress_log_id
            ):
                continue
            self.ingest_log(record)

    def ingest_log(self, progress_log: Dict[str, Any]) -> None:
        if not progress_log:
            return

        log_data = progress_log.get("log_data") or {}
        user_id = progress_log.get("user_id")
        progress_log_id = progress_log.get("id")
        created_at = progress_log.get("created_at")

        interpretation = self._ai.interpret_health_log(log_data)
        if not interpretation:
            logger.info("health_ingestion.llm_unavailable", extra={"progress_log_id": progress_log_id})
            return

        meals_payload = self._build_meals_record(
            interpretation, log_data, user_id, progress_log_id, created_at
        )
        if meals_payload:
            self._storage.upsert_normalized_record("meals", meals_payload)

        sleep_payload = self._build_sleep_record(
            interpretation, log_data, user_id, progress_log_id, created_at
        )
        if sleep_payload:
            self._storage.upsert_normalized_record("sleep", sleep_payload)

        workout_payload = self._build_workout_record(
            interpretation, log_data, user_id, progress_log_id, created_at
        )
        if workout_payload:
            self._storage.upsert_normalized_record("workouts", workout_payload)

    def _base_metadata(
        self,
        log_data: Dict[str, Any],
        progress_log_id: Optional[int],
        created_at: Optional[str],
    ) -> Dict[str, Any]:
        metadata: Dict[str, Any] = {
            "source_progress_log_id": progress_log_id,
            "source_log_timestamp": log_data.get("timestamp") or created_at,
        }
        if "estimation_notes" in log_data:
            metadata["estimation_notes"] = log_data.get("estimation_notes")
        if "macros" in log_data:
            metadata["macros"] = {"raw_string": log_data.get("macros")}
        return metadata

    def _build_meals_record(
        self,
        interpretation: Dict[str, Any],
        log_data: Dict[str, Any],
        user_id: Optional[str],
        progress_log_id: Optional[int],
        created_at: Optional[str],
    ) -> Optional[Dict[str, Any]]:
        meals_data = self._normalize_section(interpretation.get("meals"))
        date_inferred = meals_data.get("date_inferred")
        if not date_inferred:
            date_inferred = self._infer_date(log_data.get("timestamp") or created_at)

        calories = log_data.get("calories")
        meal_type = meals_data.get("meal_type") or "unknown"
        if not any([calories, log_data.get("meals"), meals_data]):
            return None

        metadata = self._base_metadata(log_data, progress_log_id, created_at)
        metadata.update(
            {
                "original_meals_text": log_data.get("meals"),
                "llm_meal_type": meal_type,
                "llm_date_phrase": meals_data.get("date_phrase"),
                "llm_method": "health_interpretation_v1",
            }
        )

        return {
            "user_id": user_id,
            "progress_log_id": progress_log_id,
            "date_inferred": date_inferred,
            "meal_type": meal_type,
            "calories": calories,
            "metadata": metadata,
            "created_at": created_at,
        }

    def _build_sleep_record(
        self,
        interpretation: Dict[str, Any],
        log_data: Dict[str, Any],
        user_id: Optional[str],
        progress_log_id: Optional[int],
        created_at: Optional[str],
    ) -> Optional[Dict[str, Any]]:
        sleep_data = self._normalize_section(interpretation.get("sleep"))
        date_inferred = sleep_data.get("date_inferred") or self._infer_date(
            log_data.get("timestamp") or created_at
        )

        if not (log_data.get("sleep") or sleep_data):
            return None

        metadata = self._base_metadata(log_data, progress_log_id, created_at)
        metadata.update(
            {
                "original_sleep_text": log_data.get("sleep"),
                "hours_slept": sleep_data.get("hours_slept"),
                "bedtime": sleep_data.get("bedtime"),
                "wake_time": sleep_data.get("wake_time"),
                "llm_quality_score": sleep_data.get("quality_score"),
                "llm_date_phrase": sleep_data.get("date_phrase"),
                "llm_method": "health_interpretation_v1",
            }
        )

        time_asleep = sleep_data.get("hours_slept")
        time_asleep_str = f"{time_asleep}h" if time_asleep is not None else None
        quality = sleep_data.get("quality") or "unknown"

        return {
            "user_id": user_id,
            "progress_log_id": progress_log_id,
            "date_inferred": date_inferred,
            "time_asleep": time_asleep_str,
            "quality": quality,
            "metadata": metadata,
            "created_at": created_at,
        }

    def _build_workout_record(
        self,
        interpretation: Dict[str, Any],
        log_data: Dict[str, Any],
        user_id: Optional[str],
        progress_log_id: Optional[int],
        created_at: Optional[str],
    ) -> Optional[Dict[str, Any]]:
        workout_data = self._normalize_section(interpretation.get("workout"))
        date_inferred = workout_data.get("date_inferred") or self._infer_date(
            log_data.get("timestamp") or created_at
        )

        if not (log_data.get("workout") or workout_data):
            return None

        metadata = self._base_metadata(log_data, progress_log_id, created_at)
        metadata.update(
            {
                "original_workout_text": log_data.get("workout"),
                "activities": workout_data.get("activities"),
                "intensity": workout_data.get("intensity"),
                "primary_muscle_group": workout_data.get("muscle_group"),
                "llm_method": "health_interpretation_v1",
            }
        )

        return {
            "user_id": user_id,
            "progress_log_id": progress_log_id,
            "date_inferred": date_inferred,
            "workout_type": workout_data.get("workout_type") or "other",
            "duration_min": workout_data.get("duration_min"),
            "metadata": metadata,
            "created_at": created_at,
        }

    def _infer_date(self, timestamp: Optional[str]) -> Optional[str]:
        if not timestamp:
            return None
        try:
            dt = datetime.fromisoformat(timestamp)
        except ValueError:
            return None
        if dt.tzinfo is None:
            dt = dt.replace(tzinfo=timezone.utc)
        return dt.date().isoformat()

    def _normalize_section(self, section: Any) -> Dict[str, Any]:
        if isinstance(section, dict):
            return section
        if isinstance(section, list):
            for item in section:
                if isinstance(item, dict):
                    return item
        return {}

    def daily_calories(self, user_id: str) -> List[Dict[str, Any]]:
        meals = self._storage.list_normalized_records("meals", user_id)
        totals: Dict[str, int] = defaultdict(int)
        for meal in meals:
            date = meal.get("date_inferred")
            calories = meal.get("calories")
            if date and isinstance(calories, int):
                totals[date] += calories
        return [
            {"date": date, "calories": calories}
            for date, calories in sorted(totals.items())
        ]
