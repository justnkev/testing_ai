from __future__ import annotations

import shutil
from datetime import datetime, timezone
from pathlib import Path
from typing import Any, Dict, List
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

    user_id = session['user']['id']
    conversation: List[Dict[str, str]] = session.get('onboarding_conversation')
    if conversation is None:
        conversation = storage_service.fetch_conversation(user_id)
        session['onboarding_conversation'] = conversation

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


@main_bp.route('/visualize', methods=['GET', 'POST'])
def visualize() -> str | Response:
    redirect_url = _require_login()
    if redirect_url:
        return redirect(redirect_url)

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
        temp_path.rename(original_path)

        if generated_bytes:
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
