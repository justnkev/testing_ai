"""Application-wide Flask extensions."""

from flask_sqlalchemy import SQLAlchemy


# A single SQLAlchemy handle shared across the application. The actual engine is
# configured in :func:`app.create_app` to ensure it respects the deployment
# environment (serverless, pooled connections, etc.).
db = SQLAlchemy()

