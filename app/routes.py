from __future__ import annotations

import shutil
from datetime import datetime, timezone
from pathlib import Path
import re
from typing import Any, Dict, List, Optional, Tuple
from uuid import uuid4

from flask import (
    Blueprint,
    Response,
    abort,
    flash,
    redirect,
    render_template,
    request,
    session,
    send_from_directory,
    url_for,
)
from werkzeug.utils import secure_filename

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


def _onboarding_complete() -> bool:
    user: Optional[Dict[str, Any]] = session.get('user')
    if not user:
        return False

    status = user.get('onboarding_complete')
    if status is None:
        stored = storage_service.get_onboarding_status(user['id'])
        if stored is not None:
            user['onboarding_complete'] = stored
            session['user'] = user
            session.modified = True
            status = stored
        else:
            status = False
    return bool(status)


def _ensure_onboarding_complete() -> Optional[Response]:
    if not _onboarding_complete():
        flash('Complete onboarding to unlock your personalized dashboard.', 'info')
        return redirect(url_for('main.onboarding'))
    return None


def _parse_timestamp(value: Optional[str]) -> Optional[datetime]:
    if not value:
        return None
    try:
        normalized = value.replace('Z', '+00:00') if isinstance(value, str) else value
        return datetime.fromisoformat(normalized)
    except (TypeError, ValueError):
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
        session.modified = True
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
        session.modified = True
        if _onboarding_complete():
            flash('Welcome back! Ready to continue your journey?', 'success')
            return redirect(url_for('main.dashboard'))

        flash('Welcome back! Let\'s pick up your onboarding to tailor your plan.', 'info')
        return redirect(url_for('main.onboarding'))

    return render_template('login.html')


@main_bp.route('/logout')
def logout() -> Response:
    session.clear()
    flash('You have been logged out.', 'info')
    return redirect(url_for('main.index'))


def _derive_dashboard_stats(logs: List[Dict[str, Any]]) -> Tuple[Dict[str, Any], List[Dict[str, Any]]]:
    """Return summarized metrics and a lightweight activity trend."""

    window = logs[-7:]
    totals = {
        'workouts': 0,
        'meals': 0,
        'sleep_hours': 0.0,
        'habits': 0,
    }

    for entry in window:
        if entry.get('workout'):
            totals['workouts'] += 1
        if entry.get('meals'):
            totals['meals'] += 1
        if entry.get('habits'):
            totals['habits'] += 1
        sleep_value = entry.get('sleep', '') or ''
        if sleep_value:
            numbers = re.findall(r"\d+(?:\.\d+)?", str(sleep_value))
            if numbers:
                try:
                    totals['sleep_hours'] += float(numbers[0])
                except ValueError:
                    continue

    trend: List[Dict[str, Any]] = []
    for entry in window:
        intensity = sum(1 for key in ('workout', 'meals', 'sleep', 'habits') if entry.get(key))
        trend.append(
            {
                'label': entry.get('timestamp', 'Recent'),
                'value': intensity,
            }
        )

    workout_goal = 5
    meal_goal = 14
    sleep_goal = 49  # 7 nights * 7 hours

    stats = {
        'total_workouts': totals['workouts'],
        'total_meals': totals['meals'],
        'total_habits': totals['habits'],
        'hours_sleep': round(totals['sleep_hours'], 1),
        'calories_estimate': totals['meals'] * 550,
        'calories_burned': totals['workouts'] * 320,
        'workout_completion': min(100, int((totals['workouts'] / workout_goal) * 100)) if workout_goal else 0,
        'meal_completion': min(100, int((totals['meals'] / meal_goal) * 100)) if meal_goal else 0,
        'sleep_completion': min(100, int((totals['sleep_hours'] / sleep_goal) * 100)) if sleep_goal else 0,
        'has_data': bool(window),
    }

    return stats, trend


@main_bp.route('/dashboard')
def dashboard() -> str | Response:
    redirect_url = _require_login()
    if redirect_url:
        return redirect(redirect_url)

    onboarding_redirect = _ensure_onboarding_complete()
    if onboarding_redirect:
        return onboarding_redirect

    user = session['user']
    plan = storage_service.fetch_plan(user['id'])
    logs = storage_service.fetch_logs(user['id'])
    weekly_prompt = storage_service.get_weekly_prompt(user['id'])

    stats, trend = _derive_dashboard_stats(logs)
    recent_logs = list(reversed(logs[-3:])) if logs else []

    return render_template(
        'dashboard.html',
        plan=plan,
        logs=logs,
        weekly_prompt=weekly_prompt,
        stats=stats,
        trend=trend,
        recent_logs=recent_logs,
    )


@main_bp.route('/onboarding', methods=['GET', 'POST'])
def onboarding() -> str | Response:
    redirect_url = _require_login()
    if redirect_url:
        return redirect(redirect_url)

    if _onboarding_complete():
        flash('Onboarding is complete. Jump into your AI coach anytime.', 'info')
        return redirect(url_for('main.ai_coach'))

    user_id = session['user']['id']
    conversation: List[Dict[str, str]] = session.get('onboarding_conversation')
    if conversation is None:
        conversation = storage_service.fetch_conversation(user_id)
        session['onboarding_conversation'] = conversation
        session.modified = True

    if request.method == 'POST':
        user_message = request.form['message']
        conversation.append({'role': 'user', 'content': user_message})

        ai_message = ai_service.continue_onboarding(conversation, session['user'])
        conversation.append({'role': 'assistant', 'content': ai_message})
        session['onboarding_conversation'] = conversation
        session.modified = True

        storage_service.save_conversation(user_id, conversation)

        if request.form.get('complete'):
            plan = ai_service.generate_plan(conversation, session['user'])
            storage_service.save_plan(session['user']['id'], plan)
            session.pop('onboarding_conversation', None)
            session.modified = True
            storage_service.clear_conversation(user_id)
            storage_service.set_onboarding_complete(user_id, True)
            session['user']['onboarding_complete'] = True
            session.modified = True
            flash('Your personalized plan is ready!', 'success')
            return redirect(url_for('main.dashboard'))

    return render_template('onboarding.html', conversation=conversation)


@main_bp.route('/coach', methods=['GET', 'POST'])
def ai_coach() -> str | Response:
    redirect_url = _require_login()
    if redirect_url:
        return redirect(redirect_url)

    onboarding_redirect = _ensure_onboarding_complete()
    if onboarding_redirect:
        return onboarding_redirect

    user = session['user']
    user_id = user['id']
    conversation: List[Dict[str, str]] = session.get('coach_conversation')
    if conversation is None:
        conversation = storage_service.fetch_coach_conversation(user_id)
        session['coach_conversation'] = conversation
        session.modified = True

    baseline_marker = session.get('coach_session_reference')
    if baseline_marker is None:
        raw_baseline = user.get('last_coach_session') or storage_service.get_last_coach_session(user_id)
        baseline_marker = raw_baseline if raw_baseline else '__none__'
        session['coach_session_reference'] = baseline_marker
        session.modified = True

    baseline_iso = None if baseline_marker == '__none__' else baseline_marker

    logs_since = storage_service.fetch_logs_since(user_id, baseline_iso)
    last_session_dt = _parse_timestamp(baseline_iso)

    if not conversation:
        ai_message = ai_service.generate_check_in_reply([], user, logs_since, last_session_dt)
        conversation.append({'role': 'assistant', 'content': ai_message})
        session['coach_conversation'] = conversation
        session.modified = True
        storage_service.save_coach_conversation(user_id, conversation)
        new_iso = storage_service.update_last_coach_session(user_id, datetime.now(timezone.utc))
        session['coach_session_latest'] = new_iso
        session['user']['last_coach_session'] = new_iso
        session.modified = True

    if request.method == 'POST':
        user_message = request.form['message']
        conversation.append({'role': 'user', 'content': user_message})

        ai_message = ai_service.generate_check_in_reply(conversation, user, logs_since, last_session_dt)
        conversation.append({'role': 'assistant', 'content': ai_message})
        session['coach_conversation'] = conversation
        session.modified = True

        storage_service.save_coach_conversation(user_id, conversation)
        new_iso = storage_service.update_last_coach_session(user_id, datetime.now(timezone.utc))
        session['coach_session_latest'] = new_iso
        session['user']['last_coach_session'] = new_iso
        session.modified = True

    return render_template('ai_coach.html', conversation=conversation)


@main_bp.route('/plan')
def plan() -> str | Response:
    redirect_url = _require_login()
    if redirect_url:
        return redirect(redirect_url)

    onboarding_redirect = _ensure_onboarding_complete()
    if onboarding_redirect:
        return onboarding_redirect

    plan = storage_service.fetch_plan(session['user']['id'])
    if not plan:
        flash('Complete onboarding to receive your plan.', 'info')
        if _onboarding_complete():
            return redirect(url_for('main.ai_coach'))
        return redirect(url_for('main.onboarding'))

    return render_template('plan.html', plan=plan)


@main_bp.route('/progress', methods=['GET', 'POST'])
def progress() -> str | Response:
    redirect_url = _require_login()
    if redirect_url:
        return redirect(redirect_url)

    onboarding_redirect = _ensure_onboarding_complete()
    if onboarding_redirect:
        return onboarding_redirect

    user_id = session['user']['id']

    if request.method == 'POST':
        log_entry = {
            'timestamp': datetime.now(timezone.utc).isoformat(),
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

    onboarding_redirect = _ensure_onboarding_complete()
    if onboarding_redirect:
        return onboarding_redirect

    user = session['user']
    user_id = user['id']
    plan = storage_service.fetch_plan(user_id)
    logs = storage_service.fetch_logs(user_id)
    conversation = storage_service.fetch_conversation(user_id)

    updated_plan = ai_service.regenerate_plan(plan, logs, conversation, user)
    storage_service.save_plan(user_id, updated_plan)
    flash('Your plan has been refreshed based on your latest updates.', 'success')
    return redirect(url_for('main.plan'))


@main_bp.route('/api/weekly_prompt')
def weekly_prompt() -> Dict[str, Any]:
    redirect_url = _require_login()
    if redirect_url:
        return {'error': 'Unauthorized'}, 401

    if not _onboarding_complete():
        return {'error': 'Onboarding incomplete'}, 403

    prompt = storage_service.get_weekly_prompt(session['user']['id'])
    return {'prompt': prompt}


@main_bp.route('/visualize', methods=['GET', 'POST'])
def visualize() -> str | Response:
    redirect_url = _require_login()
    if redirect_url:
        return redirect(redirect_url)

    onboarding_redirect = _ensure_onboarding_complete()
    if onboarding_redirect:
        return onboarding_redirect

    user = session['user']
    user_id = user['id']
    visualizations = storage_service.fetch_visualizations(user_id)

    if request.method == 'POST':
        file = request.files.get('photo')
        if not file or file.filename == '':
            flash('Please upload a full-body photo to continue.', 'warning')
            return redirect(url_for('main.visualize'))

        filename = secure_filename(file.filename)
        if not filename:
            filename = 'upload.jpg'
        extension = Path(filename).suffix.lower()
        if extension not in {'.jpg', '.jpeg', '.png', '.webp'}:
            extension = '.jpg'
        viz_id = uuid4().hex
        directory = storage_service.visualization_image_dir(user_id)
        temp_path = directory / f'{viz_id}_source{extension}'
        file.save(temp_path)

        profile_data = {
            'age': request.form.get('age', '').strip(),
            'gender': request.form.get('gender', '').strip(),
            'height': request.form.get('height', '').strip(),
            'weight': request.form.get('weight', '').strip(),
            'body_type': request.form.get('body_type', '').strip(),
        }

        context = {
            'goal_type': (request.form.get('goal_type', 'Toned & healthy') or 'Toned & healthy').strip(),
            'intensity': (request.form.get('intensity', 'Moderate') or 'Moderate').strip(),
            'timeline': (request.form.get('timeline', '6 months') or '6 months').strip(),
            'profile': profile_data,
            'user_name': user.get('name', ''),
        }

        generated_bytes = ai_service.generate_visualization(temp_path, context)

        original_name = f'{viz_id}_original{extension}'
        future_name = f'{viz_id}_future{extension}'
        original_path = directory / original_name
        future_path = directory / future_name
        original_path = directory / f'{viz_id}_original{extension}'
        temp_path.rename(original_path)

        future_name = ''
        if generated_bytes:
            future_name = f'{viz_id}_future.png'
            future_path = directory / future_name
            future_path.write_bytes(generated_bytes)
        else:
            shutil.copyfile(original_path, future_path)

        entry = {
            'id': viz_id,
            'created_at': datetime.now(timezone.utc).isoformat(),
            'goal_type': context['goal_type'],
            'intensity': context['intensity'],
            'timeline': context['timeline'],
            'profile': profile_data,
            'original': original_name,
            'original': original_path.name,
            'future': future_name,
        }
        storage_service.append_visualization(user_id, entry)

        flash('Your future self visualization is ready! Explore it below.', 'success')
        return redirect(url_for('main.visualize'))

    latest_entry = visualizations[-1] if visualizations else {}
    latest_profile = dict(latest_entry.get('profile', {})) if latest_entry else {}
    goal_defaults = {
        'goal_type': latest_entry.get('goal_type', 'Toned & healthy') if latest_entry else 'Toned & healthy',
        'intensity': latest_entry.get('intensity', 'Moderate') if latest_entry else 'Moderate',
        'timeline': latest_entry.get('timeline', '6 months') if latest_entry else '6 months',
    }

    return render_template(
        'visualize.html',
        visualizations=visualizations,
        profile_defaults=latest_profile,
        goal_defaults=goal_defaults,
    )


@main_bp.route('/visualize/image/<visualization_id>/<variant>')
def visualize_image(visualization_id: str, variant: str):
    redirect_url = _require_login()
    if redirect_url:
        return redirect(redirect_url)

    onboarding_redirect = _ensure_onboarding_complete()
    if onboarding_redirect:
        return onboarding_redirect

    if variant not in {'original', 'future'}:
        abort(404)

    user_id = session['user']['id']
    entry = storage_service.get_visualization(user_id, visualization_id)
    if not entry:
        abort(404)

    filename = entry.get(variant)
    if not filename:
        abort(404)

    directory = storage_service.visualization_image_dir(user_id)
    return send_from_directory(directory, filename)


@main_bp.route('/visualize/<visualization_id>/delete', methods=['POST'])
def delete_visualization(visualization_id: str) -> Response:
    redirect_url = _require_login()
    if redirect_url:
        return redirect(redirect_url)

    onboarding_redirect = _ensure_onboarding_complete()
    if onboarding_redirect:
        return onboarding_redirect

    user_id = session['user']['id']
    removed = storage_service.remove_visualization(user_id, visualization_id)
    if not removed:
        flash('Visualization not found.', 'warning')
        return redirect(url_for('main.visualize'))

    directory = storage_service.visualization_image_dir(user_id)
    for key in ('original', 'future'):
        filename = removed.get(key)
        if not filename:
            continue
        path = directory / filename
        try:
            path.unlink()
        except FileNotFoundError:
            continue

    flash('Visualization deleted.', 'info')
    return redirect(url_for('main.visualize'))
