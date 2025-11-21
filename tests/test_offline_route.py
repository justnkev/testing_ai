from __future__ import annotations

from unittest import TestCase

from app import create_app


class OfflineRouteTests(TestCase):
    def setUp(self) -> None:
        self.app = create_app()
        self.app.config['TESTING'] = True
        self.client = self.app.test_client()
        self.ctx = self.app.app_context()
        self.ctx.push()

    def tearDown(self) -> None:
        self.ctx.pop()

    def test_offline_route_renders_template(self) -> None:
        response = self.client.get('/offline')
        self.assertEqual(response.status_code, 200)
        self.assertIn(b"You're offline", response.data)
        self.assertIn(b'Retry connection', response.data)
