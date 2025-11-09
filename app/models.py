"""Database models for FitVision."""

from __future__ import annotations

from datetime import datetime, timezone

from sqlalchemy.sql import func

from .extensions import db


class UserAppState(db.Model):
    """Lightweight container for per-user application state.

    The JSON columns keep the schema flexible while ensuring all state is stored
    server-side in Postgres instead of the lambda filesystem.
    """

    __tablename__ = "user_app_state"

    user_id = db.Column(db.String(255), primary_key=True)
    plan = db.Column(db.JSON, nullable=True)
    onboarding_conversation = db.Column(db.JSON, nullable=True)
    coach_conversation = db.Column(db.JSON, nullable=True)
    logs = db.Column(db.JSON, nullable=True)
    visualizations = db.Column(db.JSON, nullable=True)
    created_at = db.Column(
        db.DateTime(timezone=True), server_default=func.now(), nullable=False
    )
    updated_at = db.Column(
        db.DateTime(timezone=True),
        server_default=func.now(),
        onupdate=func.now(),
        nullable=False,
    )

    def touch(self) -> None:
        """Update the in-memory timestamp before commit."""

        self.updated_at = datetime.now(timezone.utc)

