import os
from pathlib import Path

from dotenv import load_dotenv
from flask import Flask
from flask_session import Session


def create_app():
    load_dotenv()

    app = Flask(__name__)
    app.config['SECRET_KEY'] = os.getenv('FLASK_SECRET_KEY', 'dev-secret-key')
    app.config['SESSION_TYPE'] = 'filesystem'
    session_path = Path('instance/session')
    session_path.mkdir(parents=True, exist_ok=True)
    app.config['SESSION_FILE_DIR'] = str(session_path)

    Session(app)

    from .routes import main_bp

    app.register_blueprint(main_bp)

    return app
