from __future__ import annotations

from contextlib import contextmanager
import sys
from types import ModuleType
from typing import Dict, List
from unittest import TestCase
from unittest.mock import patch


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
    def from_bytes(data: bytes, mime_type: str):
        return {'data': data, 'mime_type': mime_type}


stub_types.Part = _DummyPart
sys.modules.setdefault('google.genai.types', stub_types)


from app import create_app
from app.routes import ai_service, storage_service
from app.services.ai_service import AIService


@contextmanager
def patched_session(client, data: Dict[str, object]):
    """Helper to seed session data for a test client."""

    with client.session_transaction() as flask_session:
        for key, value in data.items():
            if value is None and key in flask_session:
                del flask_session[key]
            elif value is not None:
                flask_session[key] = value
        yield flask_session


class CoachRouteTests(TestCase):
    def setUp(self) -> None:
        self.app = create_app()
        self.app.config['TESTING'] = True
        self.client = self.app.test_client()
        self.ctx = self.app.app_context()
        self.ctx.push()

    def tearDown(self) -> None:
        self.ctx.pop()

    def test_existing_user_receives_check_in(self) -> None:
        user = {'id': 'user-123', 'name': 'Taylor', 'onboarding_complete': True}

        with patched_session(self.client, {'user': user, 'coach_conversation': []}):
            pass

        with patch.object(storage_service, 'fetch_coach_conversation', return_value=[]), patch.object(
            storage_service, 'save_coach_conversation'
        ) as mock_save, patch.object(ai_service, 'check_in', return_value='Welcome back!') as mock_check_in, patch.object(
            ai_service, 'continue_onboarding'
        ) as mock_continue:
            response = self.client.post('/coach', data={'message': 'Quick check-in!'}, follow_redirects=True)

        self.assertEqual(response.status_code, 200)
        mock_check_in.assert_called_once()
        mock_continue.assert_not_called()

        args = mock_check_in.call_args[0]
        sent_conversation: List[Dict[str, str]] = args[0]
        user_messages = [msg for msg in sent_conversation if msg.get('role') == 'user']
        self.assertEqual(user_messages[-1]['content'], 'Quick check-in!')

        mock_save.assert_called_once()
        saved_conversation = mock_save.call_args[0][1]
        self.assertEqual(len(saved_conversation), 2)
        self.assertEqual(saved_conversation[0]['role'], 'user')
        self.assertEqual(saved_conversation[0]['content'], 'Quick check-in!')
        self.assertEqual(saved_conversation[1]['role'], 'assistant')
        self.assertEqual(saved_conversation[1]['content'], 'Welcome back!')

        with self.client.session_transaction() as flask_session:
            self.assertEqual(flask_session['coach_conversation'], saved_conversation)

    def test_incomplete_user_continues_onboarding_flow(self) -> None:
        user = {'id': 'user-456', 'name': 'Alex', 'onboarding_complete': False}

        with patched_session(self.client, {'user': user, 'coach_conversation': None}):
            pass

        with patch('app.routes._ensure_onboarding_complete', return_value=None), patch.object(
            storage_service, 'fetch_coach_conversation', return_value=[]
        ), patch.object(storage_service, 'save_coach_conversation') as mock_save, patch.object(
            ai_service, 'check_in'
        ) as mock_check_in, patch.object(
            ai_service, 'continue_onboarding', return_value="Let's keep gathering details."
        ) as mock_continue:
            response = self.client.post('/coach', data={'message': 'Still onboarding.'}, follow_redirects=True)

        self.assertEqual(response.status_code, 200)
        mock_continue.assert_called_once()
        mock_check_in.assert_not_called()

        mock_save.assert_called_once()
        saved_conversation = mock_save.call_args[0][1]
        self.assertEqual(saved_conversation[0]['role'], 'user')
        self.assertEqual(saved_conversation[0]['content'], 'Still onboarding.')
        self.assertEqual(saved_conversation[1]['content'], "Let's keep gathering details.")


class AIServiceCheckInTests(TestCase):
    def setUp(self) -> None:
        self.service = AIService()

    def test_check_in_uses_gemini_when_available(self) -> None:
        conversation = [{'role': 'user', 'content': 'How are things?'}]
        user = {'name': 'Morgan'}
        self.service._gemini_model = object()

        with patch.object(self.service, '_build_check_in_prompt', return_value='prompt') as mock_build, patch.object(
            self.service, '_call_gemini', return_value='All good!'
        ) as mock_call:
            result = self.service.check_in(conversation, user)

        self.assertEqual(result, 'All good!')
        mock_build.assert_called_once_with(conversation, user)
        mock_call.assert_called_once_with('prompt')

    def test_check_in_falls_back_when_gemini_empty(self) -> None:
        conversation = [{'role': 'user', 'content': 'Need some help.'}]
        user = {'name': 'Sam'}
        self.service._gemini_model = object()

        with patch.object(self.service, '_build_check_in_prompt', return_value='prompt'), patch.object(
            self.service, '_call_gemini', return_value=''
        ), patch.object(self.service, '_fallback_check_in', return_value='Fallback reply') as mock_fallback:
            result = self.service.check_in(conversation, user)

        self.assertEqual(result, 'Fallback reply')
        mock_fallback.assert_called_once_with(conversation, user)

    def test_check_in_fallback_without_model(self) -> None:
        conversation = []
        user = {'name': 'Riley'}
        self.service._gemini_model = None

        with patch.object(self.service, '_fallback_check_in', return_value='Fallback reply') as mock_fallback:
            result = self.service.check_in(conversation, user)

        self.assertEqual(result, 'Fallback reply')
        mock_fallback.assert_called_once_with(conversation, user)
