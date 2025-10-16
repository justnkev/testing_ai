from __future__ import annotations

from datetime import datetime
from typing import Any, Dict, List

from flask import (
    Blueprint,
    Response,
    flash,
    redirect,
    render_template,
    request,
    session,
    url_for,
)

from .services.ai_service import AIService
from .services.storage_service import StorageService

main_bp = Blueprint('main', __name__)

ai_service = AIService()
storage_service = StorageService()


def _require_login() -> str | None:
    if 'user' not in session:
        flash('Please log in to continue.', 'warning')
        return url_for('main.login')
    return None


@main_bp.route('/')
def index() -> str:
    return render_template('index.html')


@main_bp.route('/signup', methods=['GET', 'POST'])
def signup() -> str | Response:
    if request.method == 'POST':
        email = request.form['email']
        password = request.form['password']
        name = request.form['name']
        try:
            user = storage_service.sign_up(email=email, password=password, name=name)
        except Exception as exc:  # pragma: no cover - depends on Supabase configuration
            flash(str(exc), 'danger')
            return render_template('signup.html')

        session['user'] = user
        flash('Welcome to FitVision! Let\'s get started with your onboarding.', 'success')
        return redirect(url_for('main.onboarding'))

    return render_template('signup.html')


@main_bp.route('/login', methods=['GET', 'POST'])
def login() -> str | Response:
    if request.method == 'POST':
        email = request.form['email']
        password = request.form['password']
        try:
            user = storage_service.sign_in(email=email, password=password)
        except Exception as exc:  # pragma: no cover - depends on Supabase configuration
            flash(str(exc), 'danger')
            return render_template('login.html')

        session['user'] = user
        flash('Welcome back! Ready to continue your journey?', 'success')
        return redirect(url_for('main.dashboard'))

    return render_template('login.html')


@main_bp.route('/logout')
def logout() -> Response:
    session.clear()
    flash('You have been logged out.', 'info')
    return redirect(url_for('main.index'))


@main_bp.route('/dashboard')
def dashboard() -> str | Response:
    redirect_url = _require_login()
    if redirect_url:
        return redirect(redirect_url)

    user = session['user']
    plan = storage_service.fetch_plan(user['id'])
    logs = storage_service.fetch_logs(user['id'])
    weekly_prompt = storage_service.get_weekly_prompt(user['id'])

    return render_template(
        'dashboard.html',
        plan=plan,
        logs=logs,
        weekly_prompt=weekly_prompt,
    )


@main_bp.route('/onboarding', methods=['GET', 'POST'])
def onboarding() -> str | Response:
    redirect_url = _require_login()
    if redirect_url:
        return redirect(redirect_url)

    conversation: List[Dict[str, str]] = session.setdefault('onboarding_conversation', [])

    if request.method == 'POST':
        user_message = request.form['message']
        conversation.append({'role': 'user', 'content': user_message})

        ai_message = ai_service.continue_onboarding(conversation, session['user'])
        conversation.append({'role': 'assistant', 'content': ai_message})

        if request.form.get('complete'):
            plan = ai_service.generate_plan(conversation, session['user'])
            storage_service.save_plan(session['user']['id'], plan)
            session.pop('onboarding_conversation', None)
            flash('Your personalized plan is ready!', 'success')
            return redirect(url_for('main.plan'))

    return render_template('onboarding.html', conversation=conversation)


@main_bp.route('/plan')
def plan() -> str | Response:
    redirect_url = _require_login()
    if redirect_url:
        return redirect(redirect_url)

    plan = storage_service.fetch_plan(session['user']['id'])
    if not plan:
        flash('Complete onboarding to receive your plan.', 'info')
        return redirect(url_for('main.onboarding'))

    return render_template('plan.html', plan=plan)


@main_bp.route('/progress', methods=['GET', 'POST'])
def progress() -> str | Response:
    redirect_url = _require_login()
    if redirect_url:
        return redirect(redirect_url)

    user_id = session['user']['id']

    if request.method == 'POST':
        log_entry = {
            'timestamp': datetime.utcnow().isoformat(),
            'workout': request.form.get('workout'),
            'meals': request.form.get('meals'),
            'sleep': request.form.get('sleep'),
            'habits': request.form.get('habits'),
        }
        storage_service.append_log(user_id, log_entry)
        flash('Progress saved. Keep up the great work!', 'success')
        return redirect(url_for('main.progress'))

    logs = storage_service.fetch_logs(user_id)
    return render_template('progress.html', logs=logs)


@main_bp.route('/replan', methods=['POST'])
def replan() -> Response:
    redirect_url = _require_login()
    if redirect_url:
        return redirect(redirect_url)

    user = session['user']
    plan = storage_service.fetch_plan(user['id'])
    logs = storage_service.fetch_logs(user['id'])

    updated_plan = ai_service.regenerate_plan(plan, logs, user)
    storage_service.save_plan(user['id'], updated_plan)
    flash('Your plan has been refreshed based on your latest updates.', 'success')
    return redirect(url_for('main.plan'))


@main_bp.route('/api/weekly_prompt')
def weekly_prompt() -> Dict[str, Any]:
    redirect_url = _require_login()
    if redirect_url:
        return {'error': 'Unauthorized'}, 401

    prompt = storage_service.get_weekly_prompt(session['user']['id'])
    return {'prompt': prompt}
