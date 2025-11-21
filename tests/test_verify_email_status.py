import sys
from contextlib import contextmanager
from pathlib import Path
from types import ModuleType
from typing import Dict
from unittest import TestCase
from unittest.mock import patch

PROJECT_ROOT = Path(__file__).resolve().parents[1]
if str(PROJECT_ROOT) not in sys.path:
    sys.path.insert(0, str(PROJECT_ROOT))

stub_google = sys.modules.setdefault('google', ModuleType('google'))
stub_genai = ModuleType('google.genai')


class _DummyClient:  # pragma: no cover - simple stub for import time
    def __init__(self, *args, **kwargs):
        pass


stub_genai.Client = _DummyClient
stub_google.genai = stub_genai
sys.modules.setdefault('google.genai', stub_genai)

stub_types = ModuleType('google.genai.types')


class _DummyPart:
    @staticmethod
    def from_bytes(data: bytes, mime_type: str):  # pragma: no cover - stub helper
        return {'data': data, 'mime_type': mime_type}


stub_types.Part = _DummyPart
sys.modules.setdefault('google.genai.types', stub_types)

from app import create_app


@contextmanager
def patched_session(client, data: Dict[str, object]):
    with client.session_transaction() as flask_session:
        for key, value in data.items():
            if value is None and key in flask_session:
                del flask_session[key]
            elif value is not None:
                flask_session[key] = value
        yield flask_session


class VerifyEmailStatusTests(TestCase):
    def setUp(self) -> None:
        self.app = create_app()
        self.app.config['TESTING'] = True
        self.client = self.app.test_client()
        self.ctx = self.app.app_context()
        self.ctx.push()

    def tearDown(self) -> None:
        self.ctx.pop()

    def test_rejects_requests_without_session_context(self) -> None:
        response = self.client.post('/verify-email/status', json={'user_id': 'arbitrary'})
        self.assertEqual(response.status_code, 401)
        self.assertIn('error', response.get_json())

    def test_promotes_pending_user_only_when_verified(self) -> None:
        pending_user = {'id': 'pending-123', 'email': 'pending@example.com', 'name': 'Casey'}

        with patched_session(self.client, {'pending_user': pending_user}):
            pass

        with patch('app.routes._is_email_verified', return_value=True) as mock_check:
            response = self.client.post('/verify-email/status', json={'user_id': 'pending-123'})

        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.get_json(), {'verified': True})
        mock_check.assert_called_once_with('pending-123')

        with self.client.session_transaction() as flask_session:
            self.assertEqual(flask_session['user']['id'], 'pending-123')
            self.assertNotIn('pending_user', flask_session)

    def test_rejects_payload_mismatch(self) -> None:
        pending_user = {'id': 'pending-777', 'email': 'pending@example.com', 'name': 'Jordan'}

        with patched_session(self.client, {'pending_user': pending_user}):
            pass

        with patch('app.routes._is_email_verified', return_value=True) as mock_check:
            response = self.client.post(
                '/verify-email/status', json={'user_id': 'different', 'email': 'other@example.com'}
            )

        self.assertEqual(response.status_code, 403)
        self.assertIn('error', response.get_json())
        mock_check.assert_not_called()

        with self.client.session_transaction() as flask_session:
            self.assertNotIn('user', flask_session)
            self.assertIn('pending_user', flask_session)

    def test_pending_user_not_promoted_when_unverified(self) -> None:
        pending_user = {'id': 'pending-999', 'email': 'pending@example.com', 'name': 'Riley'}

        with patched_session(self.client, {'pending_user': pending_user}):
            pass

        with patch('app.routes._is_email_verified', return_value=False) as mock_check:
            response = self.client.post('/verify-email/status', json={'user_id': 'pending-999'})

        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.get_json(), {'verified': False})
        mock_check.assert_called_once_with('pending-999')

        with self.client.session_transaction() as flask_session:
            self.assertIn('pending_user', flask_session)
            self.assertNotIn('user', flask_session)
