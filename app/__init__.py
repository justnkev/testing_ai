from flask import Flask
from flask_session import Session
from pathlib import Path


def create_app():
    app = Flask(__name__)
    app.config['SECRET_KEY'] = 'dev-secret-key'  # Replace in production
    app.config['SESSION_TYPE'] = 'filesystem'
    session_path = Path('instance/session')
    session_path.mkdir(parents=True, exist_ok=True)
    app.config['SESSION_FILE_DIR'] = str(session_path)

    Session(app)

    from .routes import main_bp

    app.register_blueprint(main_bp)

    return app
