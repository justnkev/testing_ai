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
   pip install -r requirements.txt
   ```

2. **Configure environment variables (optional)**

   Create a `.env` file or export the following values when ready to connect to Supabase and Gemini:

   ```bash
   export SUPABASE_URL="https://YOUR-PROJECT.supabase.co"
   export SUPABASE_ANON_KEY="YOUR_ANON_KEY"
   export GEMINI_API_KEY="YOUR_GEMINI_KEY"
   ```

   Without these values the app falls back to local JSON storage so you can explore the flow offline.

3. **Run the app**

   ```bash
   flask --app app.py --debug run
   ```

   The application becomes available at [http://localhost:5000](http://localhost:5000).

## Extending the AI

`AIService` currently uses curated responses to keep the experience functional without network access. Provide a `GEMINI_API_KEY` and the service will automatically route onboarding and plan generation prompts through the free Gemini API using the `google-generativeai` SDK. The plan structure is already designed for richer content such as day-by-day workouts or visual assets.

## Data Storage

`StorageService` automatically writes JSON files to `instance/data` during local development. In production, enable Supabase to manage authentication, plans, and logs with full persistence and security controls.

## Disclaimer

FitVision offers coaching guidance only and does not provide medical advice. Always consult qualified professionals when making significant health decisions.
