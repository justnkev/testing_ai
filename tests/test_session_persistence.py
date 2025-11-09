from __future__ import annotations

from http.cookies import SimpleCookie

import pytest

from app import create_app


@pytest.fixture
def sqlite_db_url(tmp_path, monkeypatch):
    db_path = tmp_path / "session.db"
    monkeypatch.setenv("SUPABASE_DB_POOL_URL", f"sqlite:///{db_path}")
    monkeypatch.setenv("FLASK_SECRET_KEY", "testing-secret")
    monkeypatch.setenv("FLASK_ENV", "development")
    monkeypatch.setenv("DISABLE_FILESYSTEM_STORAGE", "1")
    monkeypatch.setenv("SESSION_COOKIE_SECURE", "1")
    monkeypatch.setenv("SESSION_COOKIE_SAMESITE", "Lax")
    monkeypatch.setenv("SESSION_COOKIE_DOMAIN", "localhost")
    monkeypatch.setenv("SESSION_COOKIE_NAME", "fitvision_session")
    yield f"sqlite:///{db_path}"


def _extract_cookie(response, name: str) -> SimpleCookie | None:
    header = response.headers.get("Set-Cookie")
    if not header:
        return None
    cookie = SimpleCookie()
    cookie.load(header)
    return cookie.get(name)


def test_session_survives_cold_start(sqlite_db_url, monkeypatch):
    # First invocation simulates the initial cold start.
    app_one = create_app()
    with app_one.app_context():
        # Ensure the SQL tables exist for sqlite without running migrations.
        app_one.session_interface.db.create_all()

    monkeypatch.setattr(
        app_one.storage_service,
        "sign_in",
        lambda email, password: {
            "id": "user-123",
            "email": email,
            "name": "Tester",
            "onboarding_complete": True,
        },
    )
    monkeypatch.setattr(app_one.storage_service, "get_onboarding_status", lambda user_id: True)

    client_one = app_one.test_client()
    login_response = client_one.post(
        "/login",
        data={"email": "user@example.com", "password": "secret"},
        follow_redirects=False,
    )
    assert login_response.status_code == 302

    cookie = _extract_cookie(login_response, "fitvision_session")
    assert cookie is not None
    assert "Secure" in cookie.output()
    assert "SameSite=Lax" in cookie.output()

    dashboard_response = client_one.get("/dashboard")
    assert dashboard_response.status_code == 200

    # Simulate a brand new process (second cold start) using the same database.
    app_two = create_app()
    with app_two.app_context():
        app_two.session_interface.db.create_all()

    monkeypatch.setattr(app_two.storage_service, "get_onboarding_status", lambda user_id: True)

    client_two = app_two.test_client()
    client_two.set_cookie(
        key="fitvision_session",
        value=cookie.value,
        domain="localhost",
        path=cookie["path"] if "path" in cookie else "/",
    )

    second_response = client_two.get("/dashboard")
    assert second_response.status_code == 200

