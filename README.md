# FitVision: AI Health Companion

FitVision is an MVP web application that guides people through a conversational onboarding experience, produces adaptive health plans, and tracks ongoing progress. The stack combines a Flask backend, Bootstrap-powered UI, and Supabase-ready persistence.

## Features

- **Chat-based intake** – friendly onboarding conversation that can be resumed at any time.
- **AI-generated plan** – deterministic fallback plan generator with hooks for Gemini integration.
- **Progress tracker** – log workouts, meals, sleep, and habits with timeline history.
- **Replanning** – refresh your plan based on recent logs for weekly accountability.
- **Supabase-ready auth** – email/password authentication via Supabase (with local JSON fallback for development).

## Project Structure

```
app/
  __init__.py           # Flask application factory
  routes.py             # HTTP routes and views
  services/
    ai_service.py       # Chat + plan generation logic
    storage_service.py  # Supabase integration with filesystem fallback
  templates/            # Jinja templates for pages
  static/               # Custom styling and scripts
app.py                  # Flask entry point
```

## Getting Started

1. **Install dependencies**

   ```bash
   python -m venv .venv
   source .venv/bin/activate
   flask --app app.py --debug run
   ```

2. **Configure environment variables (optional)**

   Duplicate `.env.example` to `.env` and populate it with your local secrets, or export the variables directly in your shell:

   ```bash
   cp .env.example .env  # then edit the values inside
   export SUPABASE_URL="https://YOUR-PROJECT.supabase.co"
   export SUPABASE_ANON_KEY="YOUR_ANON_KEY"
   export GEMINI_API_KEY="YOUR_GEMINI_KEY"
   export FLASK_SECRET_KEY="YOUR_FLASK_SECRET"
   ```

   The Flask CLI automatically reads `.env` (via `python-dotenv`), so secrets stay out of source control. When the variables
   are not provided, the app falls back to local JSON storage so you can explore the flow offline.

   > **GitHub Actions deployments** – store the same keys as repository secrets (for example `SUPABASE_URL`,
   > `SUPABASE_ANON_KEY`, `GEMINI_API_KEY`, `FLASK_SECRET_KEY`) and expose them as environment variables in your workflow.
   > The runtime automatically picks them up thanks to the new environment helpers in the services.

3. **Run the app**

   ```bash
   flask --app app.py --debug run
   ```

   The application becomes available at [http://localhost:5000](http://localhost:5000).

## Troubleshooting editor import errors

- **Flask or other dependencies reported as missing:** confirm your IDE is using the virtual environment where you ran `pip install -r requirements.txt`. In VS Code, select the interpreter from `.venv` via the command palette (`Python: Select Interpreter`).
- **`app.services` modules unresolved by linters:** the repository now ships with an `app/services/__init__.py` marker so the package layout is recognized automatically. If your editor still cannot locate the modules, add `app` to your import search path (e.g., VS Code setting `"python.analysis.extraPaths": ["app"]`).

## Extending the AI

`AIService` currently uses curated responses to keep the experience functional without network access. Provide a `GEMINI_API_KEY` and the service will automatically route onboarding and plan generation prompts through the free Gemini API using the `google-generativeai` SDK. The plan structure is already designed for richer content such as day-by-day workouts or visual assets.

## Data Storage

`StorageService` automatically writes JSON files to `instance/data` during local development. In production, enable Supabase to manage authentication, plans, and logs with full persistence and security controls.

## Disclaimer

FitVision offers coaching guidance only and does not provide medical advice. Always consult qualified professionals when making significant health decisions.
