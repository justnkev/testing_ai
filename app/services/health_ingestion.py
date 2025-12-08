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
        date_inferred = self._infer_date(created_at)

        # Ingest each meal entry as a separate record
        for meal_entry in log_data.get("meals_log", []):
            payload = self._build_meal_entry_record(meal_entry, user_id, progress_log_id, date_inferred)
            if payload:
                self._storage.upsert_normalized_record("meals", payload, on_conflict='entry_id')

        # Ingest each sleep entry
        for sleep_entry in log_data.get("sleep_log", []):
            payload = self._build_sleep_entry_record(sleep_entry, user_id, progress_log_id, date_inferred)
            if payload:
                self._storage.upsert_normalized_record("sleep", payload, on_conflict='entry_id')

        # Ingest each workout entry
        for workout_entry in log_data.get("workouts_log", []):
            payload = self._build_workout_entry_record(workout_entry, user_id, progress_log_id, date_inferred)
            if payload:
                self._storage.upsert_normalized_record("workouts", payload, on_conflict='entry_id')

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

    def _build_meal_entry_record(
        self,
        meal_entry: Dict[str, Any],
        user_id: Optional[str],
        progress_log_id: Optional[int],
        date_inferred: Optional[str],
    ) -> Optional[Dict[str, Any]]:
        entry_id = meal_entry.get("entry_id")
        if not entry_id:
            return None

        calories = meal_entry.get("calories")
        protein_g = meal_entry.get("protein_g")
        carbs_g = meal_entry.get("carbs_g")
        fat_g = meal_entry.get("fat_g")

        metadata = {
            "source_progress_log_id": progress_log_id,
            "source_log_timestamp": meal_entry.get("timestamp"),
            "original_text": meal_entry.get("text"),
            "estimation_notes": meal_entry.get("notes"),
            "confidence": meal_entry.get("confidence"),
            "llm_method": "meal_estimation_v1",
        }

        return {
            "entry_id": entry_id,
            "user_id": user_id,
            "progress_log_id": progress_log_id,
            "date_inferred": date_inferred,
            "meal_type": "unknown", # Could be enhanced later
            "calories": calories,
            "protein_g": protein_g,
            "carbs_g": carbs_g,
            "fat_g": fat_g,
            "metadata": metadata,
            "created_at": meal_entry.get("timestamp"),
        }

    def _build_sleep_entry_record(
        self,
        sleep_entry: Dict[str, Any],
        user_id: Optional[str],
        progress_log_id: Optional[int],
        date_inferred: Optional[str],
    ) -> Optional[Dict[str, Any]]:
        entry_id = sleep_entry.get("entry_id")
        if not entry_id:
            return None

        time_asleep_val = sleep_entry.get("time_asleep")
        quality = sleep_entry.get("quality") or "unknown"
        time_asleep_str = f"{time_asleep_val}h" if time_asleep_val is not None else None

        metadata = {
            "source_progress_log_id": progress_log_id,
            "source_log_timestamp": sleep_entry.get("timestamp"),
            "original_text": sleep_entry.get("text"),
            "notes": sleep_entry.get("notes"),
            "llm_method": "sleep_interpretation_v1",
        }

        return {
            "entry_id": entry_id,
            "user_id": user_id,
            "progress_log_id": progress_log_id,
            "date_inferred": date_inferred,
            "time_asleep": time_asleep_str,
            "quality": quality,
            "metadata": metadata,
            "created_at": sleep_entry.get("timestamp"),
        }

    def _build_workout_entry_record(
        self,
        workout_entry: Dict[str, Any],
        user_id: Optional[str],
        progress_log_id: Optional[int],
        date_inferred: Optional[str],
    ) -> Optional[Dict[str, Any]]:
        entry_id = workout_entry.get("entry_id")
        if not entry_id:
            return None

        metadata = {
            "source_progress_log_id": progress_log_id,
            "source_log_timestamp": workout_entry.get("timestamp"),
            "original_text": workout_entry.get("text"),
            "notes": workout_entry.get("notes"),
                "llm_method": "health_interpretation_v1",
        }

        return {
            "entry_id": entry_id,
            "user_id": user_id,
            "progress_log_id": progress_log_id,
            "date_inferred": date_inferred,
            "workout_type": workout_entry.get("workout_type") or "other",
            "duration_min": workout_entry.get("duration_min") or 0,
            "metadata": metadata,
            "created_at": workout_entry.get("timestamp"),
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
