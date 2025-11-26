from __future__ import annotations

import json
import os
import logging
import shutil
from datetime import datetime, timezone
from pathlib import Path
from typing import Any, Dict, List, Optional
from uuid import uuid4

logger = logging.getLogger(__name__)
from dotenv import load_dotenv
load_dotenv()

try:
    from supabase import create_client, Client as SupabaseClient
except Exception:  # pragma: no cover - optional dependency for local dev
    create_client = None  # type: ignore

    class SupabaseClient:  # pragma: no cover - simple stub
        pass

try:
    import redis  # type: ignore
except Exception:  # pragma: no cover - optional dependency
    redis = None  # type: ignore

try:
    from upstash_redis import Redis as UpstashRedis  # type: ignore
except Exception:  # pragma: no cover - optional dependency
    UpstashRedis = None  # type: ignore


class StorageService:
    """Persistence layer that defaults to filesystem storage for local testing."""

    def __init__(self) -> None:

        #self._supabase: Optional[SupabaseClient] = self._init_supabase()
        #data_dir = Path('instance/data')
        #data_dir_path = os.environ.get('STORAGE_DATA_DIR', '/tmp/fitvision-data')
        #data_dir = Path(data_dir_path)
        self._supabase: Optional[SupabaseClient] = self._init_supabase()
        self._redis: Optional[Any] = self._init_redis()

        data_dir = Path(os.getenv('STORAGE_DATA_DIR', '/tmp/fitvision-data')).expanduser()
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

            # After creating the auth user, create a corresponding public profile
            try:
                # The user's profile is created by a trigger; we just need to update it.
                self._supabase.table('profiles').update({
                    'display_name': name,
                    'email': email,
                }).eq('id', user.id).execute()
            except Exception as exc:
                logger.error("Failed to create public profile for new user %s: %s", user.id, exc, exc_info=True)
                # Optionally, you could delete the auth user here for consistency
                raise ValueError('Failed to create user profile.') from exc

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

    def verify_password(self, email: str, password: str) -> bool:
        """Return ``True`` when the provided password matches the stored secret."""

        if not email:
            return False

        if self._supabase:
            try:
                response = self._supabase.auth.sign_in_with_password({'email': email, 'password': password})
            except Exception:
                logger.warning('Supabase password verification failed for %s', email, exc_info=True)
                return False
            return bool(getattr(response, 'user', None))

        profile = self._read_json(self._profile_path(email.lower()))
        if not isinstance(profile, dict):
            return False
        return profile.get('password') == password

    def update_display_name(self, user_id: str, name: str) -> None:
        if not name:
            raise ValueError('Display name cannot be empty.')

        if self._supabase:
            auth_admin = getattr(self._supabase.auth, 'admin', None)
            admin_error: Optional[Exception] = None
            if auth_admin and hasattr(auth_admin, 'update_user_by_id'):
                try:
                    auth_admin.update_user_by_id(user_id, attributes={'user_metadata': {'name': name}})
                except Exception as exc:  # pragma: no cover - network dependent
                    admin_error = exc
                    logger.warning(
                        'Supabase admin display name update failed; attempting session fallback',
                        exc_info=True,
                    )
            if admin_error or not (auth_admin and hasattr(auth_admin, 'update_user_by_id')):
                try:
                    self._supabase.auth.update_user({'data': {'name': name}})
                except Exception as exc:  # pragma: no cover - network dependent
                    logger.warning('Supabase display name update failed', exc_info=True)
                    if admin_error:
                        raise ValueError('Unable to update your name at this time.') from admin_error
                    raise ValueError('Unable to update your name at this time.') from exc
            # Also update the public profiles table
            try:
                self._supabase.table('profiles').update({'display_name': name}).eq('id', user_id).execute()
            except Exception as exc:
                logger.warning('Supabase public profile name update failed', exc_info=True)
                if admin_error:
                    raise ValueError('Unable to update your name at this time.') from admin_error
                raise ValueError('Unable to update your name at this time.') from exc

        profile = self._read_json(self._profile_path(user_id)) or {}
        profile['id'] = profile.get('id', user_id)
        profile['name'] = name
        self._write_json(self._profile_path(user_id), profile)

    def update_password(self, user_id: str, email: str, current_password: str, new_password: str) -> None:
        if not self.verify_password(email, current_password):
            raise ValueError('Your current password was incorrect.')

        if self._supabase:
            auth_admin = getattr(self._supabase.auth, 'admin', None)
            admin_error: Optional[Exception] = None
            if auth_admin and hasattr(auth_admin, 'update_user_by_id'):
                try:
                    auth_admin.update_user_by_id(user_id, password=new_password)
                except Exception as exc:  # pragma: no cover - network dependent
                    admin_error = exc
                    logger.warning(
                        'Supabase admin password update failed; attempting session fallback',
                        exc_info=True,
                    )
            if admin_error or not (auth_admin and hasattr(auth_admin, 'update_user_by_id')):
                try:
                    # ``verify_password`` above signs the client in which seeds the
                    # session for ``update_user`` calls that rely on the current user.
                    self._supabase.auth.update_user({'password': new_password})
                except Exception as exc:  # pragma: no cover - network dependent
                    logger.warning('Supabase password update failed', exc_info=True)
                    if admin_error:
                        raise ValueError('Unable to update password at this time.') from admin_error
                    raise ValueError('Unable to update password at this time.') from exc

        profile_path = self._profile_path(user_id)
        profile = self._read_json(profile_path) or {}
        profile['id'] = profile.get('id', user_id)
        profile['password'] = new_password
        self._write_json(profile_path, profile)

    def fetch_preferences(self, user_id: str) -> Dict[str, Any]:
        cached = self._read_json(self._preferences_path(user_id))
        if isinstance(cached, dict):
            return cached

        if self._supabase:
            try:
                auth_admin = getattr(self._supabase.auth, 'admin', None)
                if auth_admin and hasattr(auth_admin, 'get_user_by_id'):
                    response = auth_admin.get_user_by_id(user_id)
                    supabase_user = getattr(response, 'user', None) or {}
                    metadata = getattr(supabase_user, 'user_metadata', None)
                    if metadata is None and isinstance(response, dict):
                        metadata = response.get('user', {}).get('user_metadata')
                    if metadata and isinstance(metadata, dict):
                        preferences = metadata.get('preferences')
                        if isinstance(preferences, dict):
                            self._write_json(self._preferences_path(user_id), preferences)
                            return preferences
            except Exception:  # pragma: no cover - network dependent
                logger.warning('Supabase preference fetch failed for %s', user_id, exc_info=True)

        return {}

    def update_preferences(self, user_id: str, preferences: Dict[str, Any]) -> Dict[str, Any]:
        saved = dict(preferences)
        saved['weekly_summary'] = bool(saved.get('weekly_summary'))

        if self._supabase:
            try:
                auth_admin = getattr(self._supabase.auth, 'admin', None)
                if auth_admin and hasattr(auth_admin, 'update_user_by_id'):
                    auth_admin.update_user_by_id(user_id, user_metadata={'preferences': saved})
                else:
                    self._supabase.auth.update_user({'data': {'preferences': saved}})
            except Exception:  # pragma: no cover - network dependent
                logger.warning('Supabase preference update failed for %s', user_id, exc_info=True)

        self._write_json(self._preferences_path(user_id), saved)
        return saved

    def clear_user_data(self, user_id: str) -> None:
        """Remove all non-auth data for the given user."""

        supabase_errors: List[str] = []

        if self._supabase:
            table_factory = getattr(self._supabase, 'table', None)
            if table_factory:
                for table_name in (
                    'user_plans',
                    'progress_logs',
                    'user_onboarding',
                    'conversations',
                    'visualizations',
                ):
                    try:
                        query = table_factory(table_name).delete().eq('user_id', user_id)
                        response = query.execute()
                    except Exception as exc:
                        logger.warning(
                            'Supabase cleanup failed for %s.%s', table_name, user_id, exc_info=True
                        )
                        supabase_errors.append(f'{table_name}: {exc}')
                        continue

                    error = getattr(response, 'error', None)
                    if error is None and isinstance(response, dict):
                        error = response.get('error')
                    if error:
                        logger.warning(
                            'Supabase cleanup returned an error for %s.%s: %s',
                            table_name,
                            user_id,
                            error,
                        )
                        supabase_errors.append(f'{table_name}: {error}')

        if supabase_errors:
            raise ValueError('Unable to clear Supabase data: ' + '; '.join(supabase_errors))

        for resolver in (
            self._plan_path,
            self._log_path,
            self._conversation_path,
            self._coach_conversation_path,
            self._visualizations_path,
            self._preferences_path,
        ):
            path = resolver(user_id)
            if path.exists():
                path.unlink(missing_ok=True)

        if self._redis is not None:
            for resolver in (
                self._plan_path,
                self._log_path,
                self._conversation_path,
                self._coach_conversation_path,
                self._visualizations_path,
                self._preferences_path,
            ):
                redis_key = self._redis_key(resolver(user_id))
                try:
                    self._redis.delete(redis_key)
                except Exception:
                    logger.warning('Failed to delete redis key %s', redis_key, exc_info=True)

        # Remove generated visualization assets
        image_dir = (self._data_dir / 'visualizations' / user_id)
        if image_dir.exists():
            shutil.rmtree(image_dir, ignore_errors=True)

    def delete_user_account(self, user_id: str, email: Optional[str] = None) -> None:
        """Delete the user account and all associated data."""

        self.clear_user_data(user_id)

        if self._supabase:
            try:
                auth_admin = getattr(self._supabase.auth, 'admin', None)
                delete_callable = None
                if auth_admin:
                    delete_callable = getattr(auth_admin, 'delete_user', None) or getattr(
                        auth_admin, 'delete_user_by_id', None
                    )
                if delete_callable:
                    delete_callable(user_id)
                else:
                    # Fall back to marking the account deleted via metadata when admin API is missing
                    self._supabase.auth.update_user({'data': {'deleted': True}})
            except Exception:  # pragma: no cover - network dependent
                logger.warning('Supabase account deletion failed for %s', user_id, exc_info=True)

        profile_path = self._profile_path(user_id)
        if profile_path.exists():
            profile_path.unlink(missing_ok=True)

        if email:
            alt_profile_path = self._profile_path(email.lower())
            if alt_profile_path.exists():
                alt_profile_path.unlink(missing_ok=True)
    def save_plan(self, user_id: str, plan: Dict) -> None:
        if self._supabase:
            try:
                self._supabase.table('user_plans').upsert(
                    {'user_id': user_id, 'plan_data': plan, 'updated_at': datetime.now(timezone.utc).isoformat()}
                ).execute()
                return
            except Exception:
                logger.warning('Supabase plan save failed; using fallback', exc_info=True)

        self._write_json(self._plan_path(user_id), plan)

    def fetch_plan(self, user_id: str) -> Dict:
        if self._supabase:
            try:
                # Use limit(1) and check for data to avoid .single() error on no results
                response = self._supabase.table('user_plans').select('plan_data').eq('user_id', user_id).limit(1).execute()
                if response.data and len(response.data) > 0:
                    return response.data[0].get('plan_data', {})
            except Exception:
                logger.warning('Supabase plan fetch failed; using fallback', exc_info=True)

        return self._read_json(self._plan_path(user_id)) or {}

    def save_conversation(self, user_id: str, conversation: List[Dict[str, str]]) -> None:
        """Persist the onboarding conversation so users can resume later."""

        if self._supabase:
            try:
                self._supabase.table('conversations').upsert(
                    {
                        'user_id': user_id,
                        'history': conversation,
                        'updated_at': datetime.now(timezone.utc).isoformat(),
                        'conversation_type': 'onboarding',
                    }
                ).execute()
            except Exception:
                logger.warning('Supabase onboarding conversation save failed; using fallback', exc_info=True)

        self._write_json(self._conversation_path(user_id), conversation)

    def fetch_conversation(self, user_id: str) -> List[Dict[str, str]]:
        """Return the stored onboarding conversation for a user."""

        if self._supabase:
            try:
                response = self._supabase.table('conversations').select('history').eq('user_id', user_id).eq('conversation_type', 'onboarding').limit(1).execute()
                if response.data and len(response.data) > 0:
                    data = response.data[0].get('history')
                    if isinstance(data, list):
                        # Ensure all items in the list are dictionaries
                        return [item for item in data if isinstance(item, dict)]
            except Exception:
                logger.warning('Supabase onboarding conversation fetch failed; using fallback', exc_info=True)

        data = self._read_json(self._conversation_path(user_id))
        if isinstance(data, list):
            return [item for item in data if isinstance(item, dict)]
        return []

    def clear_conversation(self, user_id: str) -> None:
        """Remove any persisted onboarding conversation for a user."""

        if self._supabase:
            try:
                self._supabase.table('conversations').delete().eq('user_id', user_id).eq('conversation_type', 'onboarding').execute()
            except Exception:
                logger.warning('Supabase onboarding conversation clear failed', exc_info=True)

        path = self._conversation_path(user_id)
        if self._redis is not None:
            try:
                self._redis.delete(self._redis_key(path))
                return
            except Exception:
                logger.warning('Redis delete failed; falling back to filesystem', exc_info=True)
        if path.exists():
            path.unlink()

    def fetch_coach_conversation(self, user_id: str) -> List[Dict[str, str]]:
        """Return the stored AI coach conversation for a user."""

        if self._supabase:
            try:
                response = self._supabase.table('conversations').select('history').eq('user_id', user_id).eq('conversation_type', 'coach').limit(1).execute()
                if response.data and len(response.data) > 0:
                    data = response.data[0].get('history')
                    if isinstance(data, list):
                        return [item for item in data if isinstance(item, dict)]
            except Exception:
                logger.warning('Supabase coach conversation fetch failed; using fallback', exc_info=True)

        data = self._read_json(self._coach_conversation_path(user_id))
        if isinstance(data, list):
            return [item for item in data if isinstance(item, dict)]
        return []

    def save_coach_conversation(self, user_id: str, conversation: List[Dict[str, str]]) -> None:
        """Persist the ongoing AI coach chat history."""

        if self._supabase:
            try:
                self._supabase.table('conversations').upsert(
                    {
                        'user_id': user_id,
                        'history': conversation,
                        'updated_at': datetime.now(timezone.utc).isoformat(),
                        'conversation_type': 'coach',
                    }
                ).execute()
            except Exception:
                logger.warning('Supabase coach conversation save failed; using fallback', exc_info=True)

        self._write_json(self._coach_conversation_path(user_id), conversation)

    def clear_coach_conversation(self, user_id: str) -> None:
        path = self._coach_conversation_path(user_id)
        if self._supabase:
            self._supabase.table('conversations').delete().eq('user_id', user_id).eq('conversation_type', 'coach').execute()
        if self._redis is not None:
            try:
                self._redis.delete(self._redis_key(path))
                return
            except Exception:
                logger.warning('Redis delete failed; falling back to filesystem', exc_info=True)
        if path.exists():
            path.unlink()

    def set_onboarding_complete(self, user_id: str, completed: bool = True) -> None:
        """Persist onboarding completion metadata for the user."""

        if self._supabase:
            try:
                self._supabase.table('user_onboarding').upsert(
                    {'user_id': user_id, 'is_complete': completed}
                ).execute()
            except Exception:  # pragma: no cover - network dependent
                logger.warning('Supabase onboarding metadata update failed', exc_info=True)
                return

        profile = self._read_json(self._profile_path(user_id)) or {}
        profile['onboarding_complete'] = completed
        self._write_json(self._profile_path(user_id), profile)

    def get_onboarding_status(self, user_id: str) -> Optional[bool]:
        """Return onboarding completion when available from local storage."""

        if self._supabase:
            try:
                response = self._supabase.table('user_onboarding').select('is_complete').eq('user_id', user_id).limit(1).execute()
                if response.data and len(response.data) > 0:
                    return bool(response.data[0].get('is_complete'))
            except Exception:
                logger.warning('Supabase onboarding status fetch failed', exc_info=True)
        profile = self._read_json(self._profile_path(user_id))
        if isinstance(profile, dict):
            return bool(profile.get('onboarding_complete'))
        return None

    def append_log(self, user_id: str, log_entry: Dict) -> Dict:
        logs = self._read_json(self._log_path(user_id))
        if not isinstance(logs, list):
            logs = []

        if self._supabase:
            try:
                if 'timestamp' not in log_entry:
                    log_entry['timestamp'] = datetime.now(timezone.utc).isoformat()
                response = (
                    self._supabase
                    .table('progress_logs')
                    .insert({'user_id': user_id, 'log_data': log_entry})
                    .select('id, user_id, created_at, log_data')
                    .execute()
                )
                if response.data:
                    record = response.data[0]
                    return {
                        'id': record.get('id'),
                        'user_id': record.get('user_id', user_id),
                        'created_at': record.get('created_at'),
                        'log_data': record.get('log_data', log_entry),
                    }
            except Exception:
                logger.warning('Supabase log append failed; using fallback', exc_info=True)

        next_id = max((item.get('id', 0) for item in logs if isinstance(item, dict)), default=0) + 1
        created_at = datetime.now(timezone.utc).isoformat()
        record = {'id': next_id, 'user_id': user_id, 'created_at': created_at, 'log_data': log_entry}
        logs.append(record)
        self._write_json(self._log_path(user_id), logs)
        return record

    def fetch_logs(self, user_id: str) -> List[Dict]:
        if self._supabase:
            try:
                response = self._supabase.table('progress_logs').select('log_data, created_at').eq('user_id', user_id).order('created_at', desc=False).execute()
                if response.data:
                    return [item['log_data'] for item in response.data]
            except Exception:
                logger.warning('Supabase log fetch failed; using fallback', exc_info=True)

        stored = self._read_json(self._log_path(user_id)) or []
        if isinstance(stored, list):
            return [item.get('log_data', item) for item in stored if isinstance(item, dict)]
        return []

    def fetch_progress_log_records(self, user_id: Optional[str] = None) -> List[Dict]:
        if self._supabase:
            try:
                query = self._supabase.table('progress_logs').select('id, user_id, log_data, created_at').order('created_at', desc=False)
                if user_id:
                    query = query.eq('user_id', user_id)
                response = query.execute()
                if response.data:
                    return [item for item in response.data if isinstance(item, dict)]
            except Exception:
                logger.warning('Supabase progress_log fetch failed; using fallback', exc_info=True)

        if user_id:
            stored = self._read_json(self._log_path(user_id)) or []
            return [item for item in stored if isinstance(item, dict)]

        records: List[Dict] = []
        for path in self._data_dir.glob('*_logs.json'):
            data = self._read_json(path)
            if isinstance(data, list):
                records.extend([item for item in data if isinstance(item, dict)])
        return records

    def get_weekly_prompt(self, user_id: str) -> str:
        logs = self.fetch_logs(user_id)
        if not logs:
            return "It's a new week! Share one win and one challenge from the past few days."
        latest = logs[-1]
        return (
            "How did the habits go after your last check-in on {date}? "
            "Anything you'd like me to adjust?"
        ).format(date=latest.get('timestamp', 'recently'))

    # --- Normalized health data --------------------------------------

    def upsert_normalized_record(self, category: str, record: Dict[str, Any]) -> None:
        if self._supabase:
            try:
                self._supabase.table(category).upsert(record, on_conflict='progress_log_id').execute()
                return
            except Exception:
                logger.warning('%s.upsert_failed', category, exc_info=True)

        path = self._normalized_path(category)
        rows = self._read_json(path) or []
        if not isinstance(rows, list):
            rows = []
        filtered = [row for row in rows if isinstance(row, dict) and row.get('progress_log_id') != record.get('progress_log_id')]
        filtered.append(record)
        self._write_json(path, filtered)

    def get_normalized_by_progress_log(self, category: str, progress_log_id: int) -> Optional[Dict[str, Any]]:
        if self._supabase:
            try:
                response = self._supabase.table(category).select('*').eq('progress_log_id', progress_log_id).limit(1).execute()
                if response.data:
                    return response.data[0]
            except Exception:
                logger.warning('%s.lookup_failed', category, exc_info=True)

        rows = self._read_json(self._normalized_path(category)) or []
        if isinstance(rows, list):
            for row in rows:
                if isinstance(row, dict) and row.get('progress_log_id') == progress_log_id:
                    return row
        return None

    def list_normalized_records(self, category: str, user_id: str) -> List[Dict[str, Any]]:
        if self._supabase:
            try:
                response = self._supabase.table(category).select('*').eq('user_id', user_id).order('date_inferred', desc=False).execute()
                if response.data:
                    return [item for item in response.data if isinstance(item, dict)]
            except Exception:
                logger.warning('%s.list_failed', category, exc_info=True)

        rows = self._read_json(self._normalized_path(category)) or []
        if not isinstance(rows, list):
            return []
        return [row for row in rows if isinstance(row, dict) and row.get('user_id') == user_id]

    # --- Visualization storage -----------------------------------------

    def save_visualization_image(self, user_id: str, image_bytes: bytes, ext: str = "png") -> Dict[str, str]:
        """Persist visualization image bytes and return metadata."""

        if not image_bytes:
            raise ValueError("No image data provided")

        safe_ext = (ext or "png").lstrip(".") or "png"
        directory = self.user_images_dir(user_id)
        filename = f"{uuid4().hex}.{safe_ext}"
        path = directory / filename
        path.write_bytes(image_bytes)
        created_at = datetime.now(timezone.utc).isoformat()

        return {
            "key": f"{user_id}/{filename}",
            "url": f"/user-images/{user_id}/{filename}",
            "created_at": created_at,
            "path": str(path),
        }

    def record_visualization_metadata(self, user_id: str, meta: Dict) -> None:
        """Append visualization metadata for the user."""

        if self._supabase:
            try:
                # Prepare a record that matches the Supabase schema
                record = {
                    'user_id': user_id,
                    'original_image_url': meta.get('original_url'),
                    'generated_image_url': meta.get('generated_url'),
                    'metadata': meta,  # Store the full context in the metadata column
                }
                self._supabase.table('visualizations').insert(record).execute()
                return
            except Exception:
                logger.warning('Supabase visualization record failed; using fallback', exc_info=True)

        # Fallback to local JSON storage
        entries = self._load_visualizations(user_id)
        entries.append(meta)
        self._write_json(self._visualizations_path(user_id), entries)

    def list_visualizations(self, user_id: str, limit: int = 20) -> List[Dict]:
        """Return visualization metadata records for a user."""
        if self._supabase:
            try:
                response = self._supabase.table('visualizations').select('*').eq('user_id', user_id).order('created_at', desc=True).limit(limit).execute()
                if response.data:
                    # The 'metadata' column holds the original detailed object
                    return [item.get('metadata', item) for item in response.data]
            except Exception:
                logger.warning('Supabase visualization list failed; using fallback', exc_info=True)
        # Fallback to local JSON storage
        local_entries = [
            self._normalise_visualization_entry(user_id, item)
            for item in self._load_visualizations(user_id)
            if isinstance(item, dict)
        ]

        local_entries.sort(key=lambda item: item.get("created_at", ""), reverse=True)
        if limit and limit > 0:
            return local_entries[:limit]
        return local_entries

    def refresh_visualization_urls_if_needed(self, items: List[Dict]) -> List[Dict]:
        """Refresh signed URLs when required. Local filesystem is a no-op."""

        refreshed: List[Dict] = []
        for item in items:
            if not isinstance(item, dict):
                continue
            refreshed.append(item)
        return refreshed

    def get_visualization(self, user_id: str, visualization_id: str) -> Optional[Dict]:
        for item in self._load_visualizations(user_id):
            if isinstance(item, dict) and item.get("id") == visualization_id:
                return self._normalise_visualization_entry(user_id, item)
        return None

    def remove_visualization(self, user_id: str, visualization_id: str) -> Optional[Dict]:
        items = self._load_visualizations(user_id)
        remaining: List[Dict] = []
        removed: Optional[Dict] = None
        for item in items:
            if isinstance(item, dict) and item.get("id") == visualization_id and removed is None:
                removed = self._normalise_visualization_entry(user_id, item)
                continue
            remaining.append(item)
        self._write_json(self._visualizations_path(user_id), remaining)
        return removed

    def visualization_image_dir(self, user_id: str) -> Path:
        return self.user_images_dir(user_id)

    def user_images_dir(self, user_id: str) -> Path:
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
            'SUPABASE_SERVICE_ROLE_KEY',
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

    def _init_redis(self) -> Optional[Any]:
        """Initialise a Redis client when Upstash credentials are available."""

        redis_url = os.getenv('UPSTASH_REDIS_URL')
        if redis_url and redis is not None:
            try:
                client = redis.from_url(redis_url, decode_responses=True)
                return client
            except Exception:  # pragma: no cover - network dependent
                logger.warning('Redis init failed', exc_info=True)

        rest_url = os.getenv('UPSTASH_REDIS_REST_URL')
        rest_token = os.getenv('UPSTASH_REDIS_REST_TOKEN')
        if rest_url and rest_token:
            if UpstashRedis is None:
                logger.warning(
                    'Upstash REST credentials provided but the upstash-redis package is missing'
                )
                return None
            try:
                client = UpstashRedis(url=rest_url, token=rest_token)
                return client
            except Exception:  # pragma: no cover - network dependent
                logger.warning('Upstash REST client init failed', exc_info=True)

        if redis_url and redis is None:
            logger.info('Redis package not installed; falling back to filesystem storage')
        return None

    def _write_json(self, path: Path, data) -> None:
        if self._redis is not None:
            try:
                self._redis.set(self._redis_key(path), json.dumps(data))
                return
            except Exception:
                logger.warning('Redis write failed; using filesystem fallback', exc_info=True)

        path.parent.mkdir(parents=True, exist_ok=True)
        path.write_text(json.dumps(data, indent=2))

    def _read_json(self, path: Path):
        if self._redis is not None:
            try:
                raw = self._redis.get(self._redis_key(path))
            except Exception:
                logger.warning('Redis read failed; using filesystem fallback', exc_info=True)
            else:
                if raw is not None:
                    if isinstance(raw, bytes):  # pragma: no cover - defensive
                        raw = raw.decode('utf-8')
                    try:
                        return json.loads(raw)
                    except json.JSONDecodeError:
                        logger.warning('Redis value was not valid JSON for %s', path.name)
                        # fall through to filesystem lookup
                # Redis miss should check filesystem fallback

        if not path.exists():
            return None
        try:
            return json.loads(path.read_text())
        except json.JSONDecodeError:
            return None

    def _redis_key(self, path: Path) -> str:
        return f'fitvision:{path.name}'

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

    def _preferences_path(self, user_id: str) -> Path:
        return self._data_dir / f'{user_id}_preferences.json'

    def _normalized_path(self, category: str) -> Path:
        safe = category.replace('/', '_')
        return self._data_dir / f'normalized_{safe}.json'

    @staticmethod
    def _get_env_value(*names: str) -> Optional[str]:
        for name in names:
            value = os.getenv(name)
            if value:
                return value
        return None

    def _load_visualizations(self, user_id: str) -> List[Dict]:
        data = self._read_json(self._visualizations_path(user_id))
        if isinstance(data, list):
            return [item for item in data if isinstance(item, dict)]
        return []

    def _normalise_visualization_entry(self, user_id: str, entry: Dict) -> Dict:
        data = dict(entry)
        data.setdefault('user_id', user_id)

        def _coerce_url(filename: Optional[str]) -> Optional[str]:
            if not filename:
                return None
            if filename.startswith('/'):
                return filename
            if '/' in filename and filename.split('/', 1)[0] == user_id:
                return f"/user-images/{filename}"
            return f"/user-images/{user_id}/{filename}"

        if 'url' not in data:
            future_name = data.get('future') or data.get('filename')
            if future_name:
                data['url'] = _coerce_url(future_name)
                data.setdefault('key', f"{user_id}/{Path(future_name).name}")

        original_name = data.get('original') or data.get('original_filename')
        if 'original_url' not in data and original_name:
            data['original_url'] = _coerce_url(original_name)
            data.setdefault('original_key', f"{user_id}/{Path(original_name).name}")

        if 'key' in data and 'storage_path' not in data:
            filename = Path(str(data['key'])).name
            data['storage_path'] = str(self.user_images_dir(user_id) / filename)

        if 'original_key' in data and 'original_storage_path' not in data:
            filename = Path(str(data['original_key'])).name
            data['original_storage_path'] = str(self.user_images_dir(user_id) / filename)

        if 'created_at' not in data:
            data['created_at'] = datetime.now(timezone.utc).isoformat()

        return data
