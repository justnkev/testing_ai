import os
from pathlib import Path

from dotenv import load_dotenv
from flask import Flask
from flask_session import Session
from supabase import create_client, Client

def create_app():
    #load_dotenv()

    app = Flask(__name__)
    supabase_url: str = os.environ.get("SUPABASE_URL")
    supabase_key: str = os.environ.get("SUPABASE_ANON_KEY")

    if not supabase_url or not supabase_key:
        raise ValueError("Supabase URL and Key must be set as environment variables.")
    
    app.supabase_client = create_client(supabase_url, supabase_key)
    
    app.config['SECRET_KEY'] = os.getenv('FLASK_SECRET_KEY', 'dev-secret-key')
    app.config['SESSION_TYPE'] = 'filesystem'
    #session_path = Path('instance/session')
    #session_path.mkdir(parents=True, exist_ok=True)
    app.config['SESSION_FILE_DIR'] = '/tmp/flask_session'
    #app.config['SESSION_FILE_DIR'] = str(session_path)

    Session(app)

    from .routes import main_bp

    app.register_blueprint(main_bp)

    return app
