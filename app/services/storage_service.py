from __future__ import annotations

import json
import os
from pathlib import Path
from typing import Dict, List, Optional

try:
    from supabase import Client, create_client
except ImportError:  # pragma: no cover - optional dependency for local dev
    Client = None  # type: ignore
    create_client = None  # type: ignore


class StorageService:
    """Persistence layer that defaults to filesystem storage for local testing."""

    def __init__(self) -> None:
        self._supabase: Optional[Client] = self._init_supabase()
        self._data_dir = Path('instance/data')
        self._data_dir.mkdir(parents=True, exist_ok=True)

    def sign_up(self, email: str, password: str, name: str) -> Dict[str, str]:
        if self._supabase:
            response = self._supabase.auth.sign_up({'email': email, 'password': password, 'data': {'name': name}})
            user = response.user
            if not user:  # pragma: no cover - network dependent
                raise ValueError('Supabase sign up failed.')
            return {'id': user.id, 'email': email, 'name': name}

        # Fallback: store in a local JSON file
        user_id = email.lower()
        if self._profile_path(user_id).exists():
            raise ValueError('Account already exists. Please log in.')
        profile = {'id': user_id, 'email': email, 'name': name, 'password': password}
        self._write_json(self._profile_path(user_id), profile)
        return {'id': user_id, 'email': email, 'name': name}

    def sign_in(self, email: str, password: str) -> Dict[str, str]:
        if self._supabase:
            response = self._supabase.auth.sign_in_with_password({'email': email, 'password': password})
            user = response.user
            if not user:  # pragma: no cover - network dependent
                raise ValueError('Invalid credentials.')
            name = user.user_metadata.get('name', '') if user.user_metadata else ''
            return {'id': user.id, 'email': email, 'name': name}

        profile = self._read_json(self._profile_path(email.lower()))
        if not profile or profile.get('password') != password:
            raise ValueError('Invalid credentials. For Supabase, verify environment configuration.')
        return {'id': profile['id'], 'email': profile['email'], 'name': profile.get('name', '')}

    def save_plan(self, user_id: str, plan: Dict) -> None:
        self._write_json(self._plan_path(user_id), plan)

    def fetch_plan(self, user_id: str) -> Dict:
        return self._read_json(self._plan_path(user_id)) or {}

    def save_conversation(self, user_id: str, conversation: List[Dict[str, str]]) -> None:
        """Persist the onboarding conversation so users can resume later."""

        self._write_json(self._conversation_path(user_id), conversation)

    def fetch_conversation(self, user_id: str) -> List[Dict[str, str]]:
        """Return the stored onboarding conversation for a user."""

        data = self._read_json(self._conversation_path(user_id))
        if isinstance(data, list):
            return [item for item in data if isinstance(item, dict)]
        return []

    def clear_conversation(self, user_id: str) -> None:
        """Remove any persisted onboarding conversation for a user."""

        path = self._conversation_path(user_id)
        if path.exists():
            path.unlink()

    def append_log(self, user_id: str, log_entry: Dict) -> None:
        logs = self.fetch_logs(user_id)
        logs.append(log_entry)
        self._write_json(self._log_path(user_id), logs)

    def fetch_logs(self, user_id: str) -> List[Dict]:
        return self._read_json(self._log_path(user_id)) or []

    def get_weekly_prompt(self, user_id: str) -> str:
        logs = self.fetch_logs(user_id)
        if not logs:
            return "It's a new week! Share one win and one challenge from the past few days."
        latest = logs[-1]
        return (
            "How did the habits go after your last check-in on {date}? "
            "Anything you'd like me to adjust?"
        ).format(date=latest.get('timestamp', 'recently'))

    # --- Private helpers -------------------------------------------------

    def _init_supabase(self) -> Optional[Client]:
        url = self._get_env_value(
            'SUPABASE_URL',
            'SUPABASE_URL_SECRET',
            'SUPABASE_PROJECT_URL',
        )
        key = self._get_env_value(
            'SUPABASE_ANON_KEY',
            'SUPABASE_ANON_KEY_SECRET',
            'SUPABASE_API_KEY',
        )
        if not url or not key or not create_client:
            return None
        return create_client(url, key)

    def _write_json(self, path: Path, data) -> None:
        path.parent.mkdir(parents=True, exist_ok=True)
        path.write_text(json.dumps(data, indent=2))

    def _read_json(self, path: Path):
        if not path.exists():
            return None
        try:
            return json.loads(path.read_text())
        except json.JSONDecodeError:
            return None

    def _profile_path(self, user_id: str) -> Path:
        return self._data_dir / f'{user_id}_profile.json'

    def _plan_path(self, user_id: str) -> Path:
        return self._data_dir / f'{user_id}_plan.json'

    def _log_path(self, user_id: str) -> Path:
        return self._data_dir / f'{user_id}_logs.json'

    def _conversation_path(self, user_id: str) -> Path:
        return self._data_dir / f'{user_id}_conversation.json'

    @staticmethod
    def _get_env_value(*names: str) -> Optional[str]:
        for name in names:
            value = os.getenv(name)
            if value:
                return value
        return None
