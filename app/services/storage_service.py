from __future__ import annotations

import json
import os
import logging 
logger = logging.getLogger(__name__)

from pathlib import Path
from typing import Dict, List, Optional
from dotenv import load_dotenv
load_dotenv()

try:
    from supabase import create_client, Client as SupabaseClient
except Exception:  # pragma: no cover - optional dependency for local dev
    create_client = None  # type: ignore
    class SupabaseClient:
        pass


class StorageService:
    """Persistence layer that defaults to filesystem storage for local testing."""

    def __init__(self) -> None:
        self._supabase: Optional[SupabaseClient] = self._init_supabase()
        data_dir = Path('instance/data')
        data_dir.mkdir(parents=True, exist_ok=True)
        self._data_dir = data_dir.resolve()

    def sign_up(self, email: str, password: str, name: str) -> Dict[str, str]:
        if self._supabase:
            response = self._supabase.auth.sign_up(
                {
                    'email': email,
                    'password': password,
                    'data': {'name': name, 'onboardingComplete': False},
                }
            )
            user = response.user
            if not user:  # pragma: no cover - network dependent
                raise ValueError('Supabase sign up failed.')
            return {
                'id': user.id,
                'email': email,
                'name': name,
                'onboarding_complete': False,
            }

        # Fallback: store in a local JSON file
        user_id = email.lower()
        if self._profile_path(user_id).exists():
            raise ValueError('Account already exists. Please log in.')
        profile = {
            'id': user_id,
            'email': email,
            'name': name,
            'password': password,
            'onboarding_complete': False,
        }
        self._write_json(self._profile_path(user_id), profile)
        return {'id': user_id, 'email': email, 'name': name, 'onboarding_complete': False}

    def sign_in(self, email: str, password: str) -> Dict[str, str]:
        if self._supabase:
            response = self._supabase.auth.sign_in_with_password({'email': email, 'password': password})
            user = response.user
            if not user:  # pragma: no cover - network dependent
                raise ValueError('Invalid credentials.')
            metadata = user.user_metadata or {}
            name = metadata.get('name', '') if metadata else ''
            onboarding_complete = bool(metadata.get('onboardingComplete'))
            return {
                'id': user.id,
                'email': email,
                'name': name,
                'onboarding_complete': onboarding_complete,
            }

        profile = self._read_json(self._profile_path(email.lower()))
        if not profile or profile.get('password') != password:
            raise ValueError('Invalid credentials. For Supabase, verify environment configuration.')
        return {
            'id': profile['id'],
            'email': profile['email'],
            'name': profile.get('name', ''),
            'onboarding_complete': bool(profile.get('onboarding_complete')),
        }

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

    def fetch_coach_conversation(self, user_id: str) -> List[Dict[str, str]]:
        """Return the stored AI coach conversation for a user."""

        data = self._read_json(self._coach_conversation_path(user_id))
        if isinstance(data, list):
            return [item for item in data if isinstance(item, dict)]
        return []

    def save_coach_conversation(self, user_id: str, conversation: List[Dict[str, str]]) -> None:
        """Persist the ongoing AI coach chat history."""

        self._write_json(self._coach_conversation_path(user_id), conversation)

    def clear_coach_conversation(self, user_id: str) -> None:
        path = self._coach_conversation_path(user_id)
        if path.exists():
            path.unlink()

    def set_onboarding_complete(self, user_id: str, completed: bool = True) -> None:
        """Persist onboarding completion metadata for the user."""

        if self._supabase:
            try:
                auth_admin = getattr(self._supabase.auth, 'admin', None)
                if auth_admin and hasattr(auth_admin, 'update_user_by_id'):
                    auth_admin.update_user_by_id(
                        user_id,
                        user_metadata={'onboardingComplete': completed},
                    )
                    return
                self._supabase.auth.update_user({'data': {'onboardingComplete': completed}})
                return
            except Exception:  # pragma: no cover - network dependent
                logger.warning('Supabase onboarding metadata update failed', exc_info=True)
                return

        profile = self._read_json(self._profile_path(user_id)) or {}
        profile['onboarding_complete'] = completed
        self._write_json(self._profile_path(user_id), profile)

    def get_onboarding_status(self, user_id: str) -> Optional[bool]:
        """Return onboarding completion when available from local storage."""

        if self._supabase:
            return None
        profile = self._read_json(self._profile_path(user_id))
        if isinstance(profile, dict):
            return bool(profile.get('onboarding_complete'))
        return None

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

    # --- Visualization storage -----------------------------------------

    def append_visualization(self, user_id: str, entry: Dict) -> None:
        items = self.fetch_visualizations(user_id)
        items.append(entry)
        self._write_json(self._visualizations_path(user_id), items)

    def fetch_visualizations(self, user_id: str) -> List[Dict]:
        data = self._read_json(self._visualizations_path(user_id))
        if isinstance(data, list):
            return [item for item in data if isinstance(item, dict)]
        return []

    def get_visualization(self, user_id: str, visualization_id: str) -> Optional[Dict]:
        for item in self.fetch_visualizations(user_id):
            if item.get('id') == visualization_id:
                return item
        return None

    def remove_visualization(self, user_id: str, visualization_id: str) -> Optional[Dict]:
        items = self.fetch_visualizations(user_id)
        remaining: List[Dict] = []
        removed: Optional[Dict] = None
        for item in items:
            if item.get('id') == visualization_id and removed is None:
                removed = item
                continue
            remaining.append(item)
        self._write_json(self._visualizations_path(user_id), remaining)
        return removed

    def visualization_image_dir(self, user_id: str) -> Path:
        path = self._data_dir / 'visualizations' / user_id
        path.mkdir(parents=True, exist_ok=True)
        return path.resolve()

    # --- Private helpers -------------------------------------------------

    def _init_supabase(self) -> Optional[SupabaseClient]:
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
        if not url or not key or create_client is None:
            logger.info("Supabase disabled (missing package or env)")
            return None
        try:
            return create_client(url, key)  # returns a SupabaseClient
        except Exception as exc:
            logger.warning("Supabase init failed: %s", exc)
            return None

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

    def _visualizations_path(self, user_id: str) -> Path:
        return self._data_dir / f'{user_id}_visualizations.json'

    def _coach_conversation_path(self, user_id: str) -> Path:
        return self._data_dir / f'{user_id}_coach_conversation.json'

    @staticmethod
    def _get_env_value(*names: str) -> Optional[str]:
        for name in names:
            value = os.getenv(name)
            if value:
                return value
        return None
