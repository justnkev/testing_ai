"""Seed Supabase with dashboard-friendly demo data.

This script populates the ``meals``, ``workouts``, and ``sleep`` tables
with plausible demo data so the dashboard visualizations can render
immediately. It uses the Supabase service role key for inserts.

Usage:
    SUPABASE_URL=... SUPABASE_SERVICE_ROLE_KEY=... \
    SEED_USER_ID=<existing-auth-user-uuid> \
    python scripts/seed_dashboard_data.py

The ``SEED_USER_ID`` should reference an existing ``auth.users`` record so
foreign key constraints pass. When omitted, the script generates a UUID,
which is useful for local testing against relaxed schemas.
"""
from __future__ import annotations

import os
import random
import sys
from dataclasses import dataclass
from datetime import datetime, timedelta, timezone
from typing import List, Sequence
from uuid import uuid4

from dotenv import load_dotenv
from supabase import Client, create_client


@dataclass
class SeedConfig:
    supabase_url: str
    supabase_key: str
    user_id: str
    days: int = 28  # cover daily + weekly + monthly ranges


def _resolve_supabase() -> SeedConfig:
    load_dotenv()
    supabase_url = os.getenv("SUPABASE_URL") or os.getenv("SUPABASE_PROJECT_URL")
    supabase_key = os.getenv("SUPABASE_SERVICE_ROLE_KEY") or os.getenv("SUPABASE_SECRET")
    user_id = os.getenv("SEED_USER_ID") or str(uuid4())

    missing = [
        name
        for name, value in (
            ("SUPABASE_URL", supabase_url),
            ("SUPABASE_SERVICE_ROLE_KEY", supabase_key),
        )
        if not value
    ]
    if missing:
        raise SystemExit(f"Missing required environment variables: {', '.join(missing)}")

    return SeedConfig(supabase_url=supabase_url, supabase_key=supabase_key, user_id=user_id)


def _client_from_config(config: SeedConfig) -> Client:
    return create_client(config.supabase_url, config.supabase_key)


def _date_window(days: int) -> List[datetime]:
    today = datetime.now(timezone.utc)
    return [today - timedelta(days=offset) for offset in range(days)]


def _seed_meals(client: Client, config: SeedConfig, days: Sequence[datetime]):
    meal_types = ("breakfast", "lunch", "dinner")
    entries = []
    for day in days:
        for meal in meal_types:
            entries.append(
                {
                    "id": str(uuid4()),
                    "user_id": config.user_id,
                    "created_at": day.isoformat(),
                    "meal_type": meal,
                    "calories": random.randint(320, 850),
                    "metadata": {
                        "protein_g": random.randint(12, 55),
                        "carbs_g": random.randint(25, 80),
                    },
                }
            )
    return client.table("meals").insert(entries).execute()


def _seed_workouts(client: Client, config: SeedConfig, days: Sequence[datetime]):
    workout_types = ("run", "cycle", "yoga", "strength")
    entries = []
    for day in days:
        duration = random.randint(20, 80)
        entries.append(
            {
                "id": str(uuid4()),
                "user_id": config.user_id,
                "created_at": day.isoformat(),
                "workout_type": random.choice(workout_types),
                "duration_min": duration,
                "metadata": {
                    "calories_burned": random.randint(180, 650),
                    "perceived_exertion": random.choice(["easy", "moderate", "hard"]),
                },
            }
        )
    return client.table("workouts").insert(entries).execute()


def _seed_sleep(client: Client, config: SeedConfig, days: Sequence[datetime]):
    entries = []
    for day in days:
        start_time = day.replace(hour=22, minute=0, second=0, microsecond=0)
        duration_hours = random.randint(6, 9) + random.choice([0, 0.25, 0.5, 0.75])
        end_time = start_time + timedelta(hours=duration_hours)
        entries.append(
            {
                "id": str(uuid4()),
                "user_id": config.user_id,
                "start_time": start_time.isoformat(),
                "end_time": end_time.isoformat(),
                "quality": random.choice(["great", "ok", "poor"]),
                "metadata": {
                    "device": random.choice(["ring", "watch", "phone"]),
                    "score": random.randint(60, 95),
                },
            }
        )
    return client.table("sleep").insert(entries).execute()


def main() -> None:
    config = _resolve_supabase()
    client = _client_from_config(config)
    date_window = _date_window(config.days)

    print(f"Seeding dashboard data for user: {config.user_id}")

    meals_response = _seed_meals(client, config, date_window)
    workouts_response = _seed_workouts(client, config, date_window)
    sleep_response = _seed_sleep(client, config, date_window)

    for name, response in (
        ("meals", meals_response),
        ("workouts", workouts_response),
        ("sleep", sleep_response),
    ):
        if getattr(response, "error", None):
            print(f"[!] {name} insert error: {response.error}")
            sys.exit(1)
        print(f"Inserted {len(getattr(response, 'data', []) or [])} {name} rows")

    print("Seed complete.")


if __name__ == "__main__":
    main()
