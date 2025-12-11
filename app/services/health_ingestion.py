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
                self._storage.upsert_normalized_record("meals", payload, on_conflict='id')

        # Ingest each sleep entry
        for sleep_entry in log_data.get("sleep_log", []):
            payload = self._build_sleep_entry_record(sleep_entry, user_id, progress_log_id, date_inferred)
            if payload:
                self._storage.upsert_normalized_record("sleep", payload, on_conflict='id')

        # Ingest each workout entry
        for workout_entry in log_data.get("workouts_log", []):
            payload = self._build_workout_entry_record(workout_entry, user_id, progress_log_id, date_inferred)
            if payload:
                self._storage.upsert_normalized_record("workouts", payload, on_conflict='id')

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
        entry_id = meal_entry.get("id")
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
            "id": entry_id,
            "user_id": user_id,
            "progress_log_id": progress_log_id,
            "date_inferred": date_inferred,
            "meal_type": meal_entry.get("meal_type") or "unknown",
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
        entry_id = sleep_entry.get("id")
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
            "id": entry_id,
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
        entry_id = workout_entry.get("id")
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
            "id": entry_id,
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

    def workout_duration_by_type(self, user_id: str) -> List[Dict[str, Any]]:
        """Aggregates total workout duration by workout type for a user."""
        workouts = self._storage.list_normalized_records("workouts", user_id)
        totals: Dict[str, int] = defaultdict(int)
        for workout in workouts:
            workout_type = workout.get("workout_type", "other")
            duration = workout.get("duration_min", 0)
            if isinstance(duration, (int, float)):
                totals[workout_type] += int(duration)
        
        return [
            {"type": workout_type, "duration_minutes": duration}
            for workout_type, duration in totals.items()
            if duration > 0
        ]

    def daily_macros(self, user_id: str) -> List[Dict[str, Any]]:
        """Aggregates daily macronutrient consumption for a user."""
        meals = self._storage.list_normalized_records("meals", user_id)
        daily_totals: Dict[str, Dict[str, float]] = defaultdict(lambda: defaultdict(float))

        for meal in meals:
            date = meal.get("date_inferred")
            if date:
                daily_totals[date]["protein_g"] += meal.get("protein_g", 0) or 0
                daily_totals[date]["carbs_g"] += meal.get("carbs_g", 0) or 0
                daily_totals[date]["fat_g"] += meal.get("fat_g", 0) or 0
                daily_totals[date]["calories"] += meal.get("calories", 0) or 0
        
        # Convert defaultdict to regular dicts and sort by date
        sorted_dates = sorted(daily_totals.keys())
        result = []
        for date in sorted_dates:
            entry = {"date": date}
            entry.update(daily_totals[date])
            result.append(entry)
        return result

    def sleep_hours_by_quality(self, user_id: str) -> List[Dict[str, Any]]:
        """Aggregates total sleep hours by quality for a user."""
        sleep_records = self._storage.list_normalized_records("sleep", user_id)
        totals: Dict[str, float] = defaultdict(float)

        for sleep_entry in sleep_records:
            quality = sleep_entry.get("quality", "unknown")
            time_asleep_str = sleep_entry.get("time_asleep") # e.g., "7.5h"
            
            hours = 0.0
            if time_asleep_str and isinstance(time_asleep_str, str):
                try:
                    # Extract numeric part and convert to float
                    hours = float(time_asleep_str.replace('h', ''))
                except ValueError:
                    logger.warning(f"Could not parse sleep_hours: {time_asleep_str}")
            elif isinstance(time_asleep_str, (int, float)): # Handle if it's already numeric
                hours = float(time_asleep_str)

            totals[quality] += hours
        
        return [
            {"quality": quality, "total_hours": round(hours, 1)}
            for quality, hours in totals.items()
            if hours > 0
        ]

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

    def get_daily_progress_summary(self, user_id: str) -> List[Dict[str, Any]]:
        """
        Fetches all progress logs for a user and returns a list of daily summaries.
        """
        meals = self._storage.list_normalized_records("meals", user_id)
        workouts = self._storage.list_normalized_records("workouts", user_id)
        sleep_entries = self._storage.list_normalized_records("sleep", user_id)

        daily_totals: Dict[str, Dict[str, Any]] = defaultdict(
            lambda: {
                "meals": {"count": 0, "calories": 0},
                "workouts": {"count": 0, "duration_min": 0},
                "sleep": {"hours": 0.0},
            }
        )

        for meal in meals:
            date = meal.get("date_inferred")
            if not date:
                continue
            calories = meal.get("calories")
            if isinstance(calories, (int, float)):
                daily_totals[date]["meals"]["calories"] += calories
            daily_totals[date]["meals"]["count"] += 1

        for workout in workouts:
            date = workout.get("date_inferred")
            if not date:
                continue
            duration = workout.get("duration_min")
            if isinstance(duration, (int, float)):
                daily_totals[date]["workouts"]["duration_min"] += duration
            daily_totals[date]["workouts"]["count"] += 1

        for sleep in sleep_entries:
            date = sleep.get("date_inferred")
            if not date:
                continue
            hours = self._parse_sleep_hours(sleep.get("time_asleep"))
            if hours > 0:
                daily_totals[date]["sleep"]["hours"] += hours

        return [
            {"date": date, "totals": totals}
            for date, totals in sorted(daily_totals.items())
        ]

    def _parse_sleep_hours(self, value: Any) -> float:
        if isinstance(value, (int, float)):
            return float(value)
        if isinstance(value, str):
            try:
                return float(value.replace("h", ""))
            except ValueError:
                logger.warning("Could not parse sleep_hours: %s", value)
        return 0.0
