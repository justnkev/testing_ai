import os
from pathlib import Path

from dotenv import load_dotenv
from flask import Flask
from flask_session import Session
from supabase import create_client, Client
from .services.ai_service import AIService
from .services.storage_service import StorageService
def create_app():
    #load_dotenv()

    app = Flask(__name__)
    supabase_url: str = os.environ.get("SUPABASE_URL")
    supabase_key: str = os.environ.get("SUPABASE_ANON_KEY")
    flask_key: str = os.environ.get("FLASK_SECRET_KEY")
    gemini_key: str = os.environ.get("GEMINI_API_KEY")

    if not all([supabase_url, supabase_key, flask_key, gemini_key]):
        raise ValueError("One or more required environment variables are missing.")
        
    app.supabase_client = create_client(supabase_url, supabase_key)
    app.storage_service = StorageService(app.supabase_client) 
    app.ai_service = AIService(api_key=gemini_key)

    app.config['SECRET_KEY'] = os.getenv('FLASK_SECRET_KEY', 'dev-secret-key')
    app.config['SESSION_TYPE'] = 'filesystem'
    app.config['SESSION_FILE_DIR'] = '/tmp/flask_session'

    #session_path = Path('instance/session')
    #session_path.mkdir(parents=True, exist_ok=True)
    #app.config['SESSION_FILE_DIR'] = str(session_path)

    Session(app)

    from .routes import main_bp

    app.register_blueprint(main_bp)

    return app
