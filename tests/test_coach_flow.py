from datetime import datetime, timedelta, timezone
from pathlib import Path
import sys
import types

import pytest

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

google_module = types.ModuleType('google')
genai_module = types.ModuleType('google.genai')
genai_types_module = types.ModuleType('google.genai.types')


class _StubPart:
    @staticmethod
    def from_bytes(*_args, **_kwargs):  # pragma: no cover - minimal stub
        return None


genai_module.Client = object  # type: ignore[attr-defined]
genai_module.types = genai_types_module  # type: ignore[attr-defined]
genai_types_module.Part = _StubPart  # type: ignore[attr-defined]

sys.modules.setdefault('google', google_module)
sys.modules['google.genai'] = genai_module
sys.modules['google.genai.types'] = genai_types_module
setattr(sys.modules['google'], 'genai', genai_module)

from app.services.ai_service import AIService
from app.services.storage_service import StorageService


@pytest.fixture
def storage(tmp_path):
    service = StorageService()
    service._data_dir = tmp_path  # type: ignore[attr-defined]
    return service


def test_fetch_logs_since_filters_entries(storage):
    user_id = 'user@example.com'
    earlier = (datetime.now(timezone.utc) - timedelta(days=2)).isoformat()
    recent = (datetime.now(timezone.utc) - timedelta(hours=6)).isoformat()
    storage._write_json(storage._log_path(user_id), [  # type: ignore[attr-defined]
        {'timestamp': earlier, 'workout': 'Swim session'},
        {'timestamp': recent, 'sleep': '7.5 hours', 'meals': 'kept it balanced'},
    ])

    filtered = storage.fetch_logs_since(user_id, earlier)
    assert len(filtered) == 1
    assert filtered[0]['timestamp'] == recent


def test_generate_check_in_reply_references_wellness_data(monkeypatch):
    service = AIService()
    service._gemini_model = None  # ensure fallback path is used

    now = datetime.now(timezone.utc)
    last_session = now - timedelta(days=3)
    logs = [
        {
            'timestamp': (now - timedelta(days=1)).isoformat(),
            'workout': 'Strength day',
            'sleep': '7.2 hours',
            'habits': 'Meditated twice',
        }
    ]

    reply = service.generate_check_in_reply([], {'name': 'Taylor'}, logs, last_session)

    assert 'Welcome back' in reply
    assert 'workout' in reply.lower()
    assert 'Taylor' in reply
    assert 'since we last connected' in reply.lower()
