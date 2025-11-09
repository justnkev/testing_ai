-- Create table for Flask-Session SQLAlchemy backend.
CREATE TABLE IF NOT EXISTS sessions (
    session_id VARCHAR(255) PRIMARY KEY,
    data BYTEA NOT NULL,
    expiry TIMESTAMP WITH TIME ZONE NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_sessions_expiry ON sessions (expiry);

-- Application state storage for plans, conversations, logs, etc.
CREATE TABLE IF NOT EXISTS user_app_state (
    user_id VARCHAR(255) PRIMARY KEY,
    plan JSONB,
    onboarding_conversation JSONB,
    coach_conversation JSONB,
    logs JSONB,
    visualizations JSONB,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_user_app_state_updated_at ON user_app_state (updated_at DESC);

-- Trigger to keep updated_at current on updates.
CREATE OR REPLACE FUNCTION set_user_app_state_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_user_app_state_updated_at ON user_app_state;
CREATE TRIGGER trg_user_app_state_updated_at
BEFORE UPDATE ON user_app_state
FOR EACH ROW
EXECUTE FUNCTION set_user_app_state_updated_at();
