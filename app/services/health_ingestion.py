from __future__ import annotations

import logging
import re
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
        date_inferred = self._infer_date(log_data.get("timestamp")) or self._infer_date(created_at)
        structured_log = self._ensure_structured_sections(log_data, created_at)

        # Ingest each meal entry as a separate record
        for meal_entry in structured_log.get("meals_log", []):
            payload = self._build_meal_entry_record(meal_entry, user_id, progress_log_id, date_inferred)
            if payload:
                self._storage.upsert_normalized_record("meals", payload, on_conflict='id')

        # Ingest each sleep entry
        for sleep_entry in structured_log.get("sleep_log", []):
            payload = self._build_sleep_entry_record(sleep_entry, user_id, progress_log_id, date_inferred)
            if payload:
                self._storage.upsert_normalized_record("sleep", payload, on_conflict='id')

        # Ingest each workout entry
        for workout_entry in structured_log.get("workouts_log", []):
            payload = self._build_workout_entry_record(workout_entry, user_id, progress_log_id, date_inferred)
            if payload:
                self._storage.upsert_normalized_record("workouts", payload, on_conflict='id')

    def _ensure_structured_sections(self, log_data: Dict[str, Any], created_at: Optional[str]) -> Dict[str, Any]:
        """Populate normalized sections even when ingesting legacy freeform logs."""

        structured = dict(log_data or {})
        if any(structured.get(key) for key in ("meals_log", "sleep_log", "workouts_log")):
            return structured

        interpreted: Dict[str, Any] = {}
        try:
            interpreted = self._ai.interpret_health_log(log_data) or {}
        except Exception:
            logger.warning("health_ingestion.interpret_failed", exc_info=True)

        timestamp = structured.get("timestamp") or created_at or datetime.now(timezone.utc).isoformat()
        base_id = int(datetime.now(timezone.utc).timestamp() * 1_000_000)

        meals_candidate = interpreted.get("meals_log") or interpreted.get("meals")
        if meals_candidate or structured.get("meals") or structured.get("calories"):
            meal_defaults = {
                "text": structured.get("meals"),
                "calories": structured.get("calories"),
                "protein_g": structured.get("protein_g"),
                "carbs_g": structured.get("carbs_g"),
                "fat_g": structured.get("fat_g"),
            }
            structured["meals_log"] = self._hydrate_entries(
                meals_candidate
                or [
                    meal_defaults
                ],
                base_id,
                timestamp,
                defaults=meal_defaults,
            )

        workout_candidate = interpreted.get("workouts_log") or interpreted.get("workout") or interpreted.get("workouts")
        if workout_candidate or structured.get("workout"):
            structured["workouts_log"] = self._hydrate_entries(
                workout_candidate
                or [
                    {
                        "text": structured.get("workout"),
                        "duration_min": structured.get("duration_min", 0) or 0,
                    }
                ],
                base_id + 1_000,
                timestamp,
                defaults={"duration_min": 0},
            )

        sleep_candidate = interpreted.get("sleep_log") or interpreted.get("sleep")
        sleep_defaults = {"time_asleep": structured.get("sleep")}
        if sleep_candidate:
            normalized_sleep: List[Dict[str, Any]] = []
            if isinstance(sleep_candidate, dict):
                sleep_candidate = [sleep_candidate]
            for entry in sleep_candidate:
                if not isinstance(entry, dict):
                    continue
                item = dict(entry)
                hours_val = item.pop("hours_slept", None)
                if hours_val is not None and not item.get("time_asleep"):
                    item["time_asleep"] = f"{hours_val}h"
                normalized_sleep.append(item)
            sleep_candidate = normalized_sleep

        if sleep_candidate or structured.get("sleep"):
            structured["sleep_log"] = self._hydrate_entries(
                sleep_candidate or [{"text": structured.get("sleep"), "time_asleep": structured.get("sleep")}],
                base_id + 2_000,
                timestamp,
                defaults=sleep_defaults,
            )

        return structured

    def _hydrate_entries(self, entries: Any, base_id: int, timestamp: str, defaults: Optional[Dict[str, Any]] = None) -> List[Dict[str, Any]]:
        hydrated: List[Dict[str, Any]] = []
        defaults = defaults or {}

        if not entries:
            return hydrated

        if isinstance(entries, dict):
            entries = [entries]

        for index, entry in enumerate(entries):
            if not isinstance(entry, dict):
                continue
            item = dict(defaults)
            item.update(entry)
            item.setdefault("id", base_id + index)
            item.setdefault("timestamp", timestamp)
            if not item.get("date_inferred"):
                item["date_inferred"] = self._infer_date(item.get("timestamp"))
            hydrated.append(item)

        return hydrated

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

        calories = self._coerce_int(meal_entry.get("calories"))
        protein_g = self._coerce_int(meal_entry.get("protein_g"))
        carbs_g = self._coerce_int(meal_entry.get("carbs_g"))
        fat_g = self._coerce_int(meal_entry.get("fat_g"))

        missing_nutrition = calories is None
        fallback_reason = None
        if missing_nutrition:
            fallback_reason = meal_entry.get("estimation_notes") or "Calories/macros unavailable; defaulted to 0 due to estimation failure."
            logger.warning(
                "health_ingestion.meal_missing_calories",
                extra={
                    "progress_log_id": progress_log_id,
                    "meal_id": entry_id,
                    "text_preview": (meal_entry.get("text") or "")[:80],
                },
            )
            calories = 0
            protein_g = 0 if protein_g is None else protein_g
            carbs_g = 0 if carbs_g is None else carbs_g
            fat_g = 0 if fat_g is None else fat_g

        metadata = {
            "source_progress_log_id": progress_log_id,
            "source_log_timestamp": meal_entry.get("timestamp"),
            "original_text": meal_entry.get("text"),
            "estimation_notes": meal_entry.get("notes"),
            "confidence": meal_entry.get("confidence"),
            "llm_method": meal_entry.get("llm_method") or "meal_estimation_v1",
        }
        if fallback_reason:
            metadata["nutrition_fallback"] = True
            metadata["estimation_notes"] = metadata.get("estimation_notes") or fallback_reason

        return {
            "id": entry_id,
            "user_id": user_id,
            "progress_log_id": progress_log_id,
            "date_inferred": date_inferred,
            "meal_type": meal_entry.get("meal_type") or "unknown", # Could be enhanced later
            "calories": calories,
            "protein_g": protein_g,
            "carbs_g": carbs_g,
            "fat_g": fat_g,
            "metadata": metadata,
            "created_at": meal_entry.get("timestamp"),
        }

    def _coerce_int(self, value: Any) -> Optional[int]:
        """Convert inputs like strings or floats into integers when possible."""

        if value is None:
            return None

        if isinstance(value, bool):
            return int(value)

        if isinstance(value, (int, float)):
            return int(value)

        match = re.search(r"-?\d+(?:\.\d+)?", str(value).strip())
        if not match:
            return None

        try:
            return int(float(match.group(0)))
        except (TypeError, ValueError):
            return None

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
        logs = self._storage.fetch_progress_log_records(user_id=user_id)
        summaries = []
        for log in logs:
            log_data = log.get("log_data", {})
            daily_totals = log_data.get("daily_totals", {})
            summary = {
                "date": self._infer_date(log.get("created_at")),
                "totals": daily_totals
            }
            summaries.append(summary)
        return summaries
