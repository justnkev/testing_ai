from __future__ import annotations

import base64
import hashlib
from datetime import datetime, timezone
from functools import wraps
import logging
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
    current_app
)
from werkzeug.utils import secure_filename

from .services.ai_service import AIService
from .services.storage_service import StorageService

main_bp = Blueprint('main', __name__)

ai_service = AIService()
storage_service = StorageService()

logger = logging.getLogger(__name__)


@main_bp.route('/service-worker.js')
def service_worker() -> Response:
    """Serve the compiled service worker with no-store caching."""

    response = current_app.send_static_file('js/service-worker.js')
    response.headers['Cache-Control'] = 'no-store'
    return response


def _require_login() -> str | None:
    if 'user' not in session:
        flash('Please log in to continue.', 'warning')
        return url_for('main.login')
    return None


def login_required(view):
    """Decorator ensuring the user is authenticated before accessing a view."""

    @wraps(view)
    def wrapped(*args, **kwargs):
        redirect_url = _require_login()
        if redirect_url:
            return redirect(redirect_url)
        return view(*args, **kwargs)

    return wrapped


def _extract_email_confirmed(candidate: Any) -> Any:
    """Return the email confirmation timestamp from Supabase-like responses."""

    if candidate is None:
        return None

    if hasattr(candidate, 'email_confirmed_at'):
        return getattr(candidate, 'email_confirmed_at')

    if isinstance(candidate, dict):
        for key in ('email_confirmed_at', 'emailConfirmedAt'):
            value = candidate.get(key)
            if value:
                return value

        nested_user = candidate.get('user')
        if nested_user:
            return _extract_email_confirmed(nested_user)

    return None


def _is_email_verified(user_id: str) -> bool:
    """Return ``True`` when Supabase reports the user's email as confirmed."""

    supabase = getattr(current_app.storage_service, '_supabase', None)
    if not supabase:
        return True

    try:
        auth_admin = getattr(supabase.auth, 'admin', None)
        if auth_admin and hasattr(auth_admin, 'get_user_by_id'):
            admin_response = auth_admin.get_user_by_id(user_id)
            confirmed = _extract_email_confirmed(
                getattr(admin_response, 'user', None)
                or getattr(admin_response, 'data', None)
                or admin_response
            )
            if confirmed:
                return True

        user_response = supabase.auth.get_user()
        confirmed = _extract_email_confirmed(
            getattr(user_response, 'user', None)
            or getattr(user_response, 'data', None)
            or user_response
        )
        return bool(confirmed)
    except Exception:
        logger.warning('verify_email_status.check_failed', exc_info=True, extra={'user_id': user_id})

    return False


def _onboarding_complete() -> bool:
    user: Optional[Dict[str, Any]] = session.get('user')
    if not user:
        return False

    status = user.get('onboarding_complete')
    if status is None:
        stored = current_app.storage_service.get_onboarding_status(user['id'])
        if stored is not None:
            user['onboarding_complete'] = stored
            session['user'] = user
            session.modified = True
            status = stored
        else:
            status = False

    if not status:
        plan = current_app.storage_service.fetch_plan(user['id'])
        if plan:
            user['onboarding_complete'] = True
            session['user'] = user
            session.modified = True
            return True
    return bool(status)


def _ensure_onboarding_complete() -> Optional[Response]:
    if not _onboarding_complete():
        flash('Complete onboarding to unlock your personalized dashboard.', 'info')
        return redirect(url_for('main.onboarding'))
    return None


@main_bp.route('/')
def index() -> str:
    return render_template('index.html')


@main_bp.route('/offline')
def offline() -> str:
    """Render the offline status page without requiring authentication."""

    return render_template('offline.html')


@main_bp.route('/signup', methods=['GET', 'POST'])
def signup() -> str | Response:
    if request.method == 'POST':
        email = request.form['email']
        password = request.form['password']
        name = request.form['name']
        try:
            pending_user = current_app.storage_service.sign_up(
                email=email, password=password, name=name
            )
        except Exception as exc:  # pragma: no cover - depends on Supabase configuration
            flash(str(exc), 'danger')
            return render_template('signup.html')

        session['pending_user'] = pending_user
        session.modified = True
        flash('Account created! We sent a verification email—please check your inbox.', 'success')
        return redirect('/verify-email')

    return render_template('signup.html')


@main_bp.route('/login', methods=['GET', 'POST'])
def login() -> str | Response:
    if request.method == 'POST':
        email = request.form['email']
        password = request.form['password']
        try:
            user = current_app.storage_service.sign_in(email=email, password=password)
        except Exception as exc:  # pragma: no cover - depends on Supabase configuration
            flash(str(exc), 'danger')
            return render_template('login.html')

        session['user'] = user
        session.pop('pending_user', None)
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


@main_bp.route('/verify-email/status', methods=['POST'])
def verify_email_status() -> Dict[str, Any] | Response:
    session_user = session.get('user')
    pending_user = session.get('pending_user')
    verification_subject: Optional[Dict[str, Any]] = session_user or pending_user

    if not verification_subject:
        return {'error': 'Unauthorized'}, 401

    payload = request.get_json(silent=True) or {}
    request_user_id = payload.get('user_id')
    request_email = payload.get('email')

    subject_user_id = verification_subject.get('id')
    subject_email = verification_subject.get('email')

    if request_user_id and subject_user_id and request_user_id != subject_user_id:
        return {'error': 'Session mismatch'}, 403

    if request_email and subject_email and request_email.lower() != subject_email.lower():
        return {'error': 'Session mismatch'}, 403

    if not subject_user_id:
        return {'error': 'Invalid session'}, 400

    verified = _is_email_verified(subject_user_id)

    if verified and session_user is None and pending_user is not None:
        session['user'] = dict(pending_user)
        session.pop('pending_user', None)
        session.modified = True

    return {'verified': bool(verified)}


def _derive_dashboard_stats(logs: List[Dict[str, Any]]) -> Tuple[Dict[str, Any], List[Dict[str, Any]]]:
    """Return summarized metrics and a lightweight activity trend."""

    window = logs[-7:]
    totals = {
        'workouts': 0,
        'meals': 0,
        'sleep_hours': 0.0,
        'habits': 0,
    }
    calories_total = 0

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
        calories_value = entry.get('calories')
        if calories_value is not None:
            try:
                calories_total += int(round(float(calories_value)))
            except (TypeError, ValueError):
                pass

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
        'calories_estimate': calories_total,
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
    plan = current_app.storage_service.fetch_plan(user['id'])
    logs = current_app.storage_service.fetch_logs(user['id'])
    weekly_prompt = current_app.storage_service.get_weekly_prompt(user['id'])

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
        conversation = current_app.storage_service.fetch_conversation(user_id)
        session['onboarding_conversation'] = conversation
        session.modified = True

    if request.method == 'POST':
        user_message = request.form['message']
        conversation.append({'role': 'user', 'content': user_message})

        ai_message = current_app.ai_service.continue_onboarding(conversation, session['user'])
        conversation.append({'role': 'assistant', 'content': ai_message})
        session['onboarding_conversation'] = conversation
        session.modified = True

        current_app.storage_service.save_conversation(user_id, conversation)

        if request.form.get('complete'):
            plan = current_app.ai_service.generate_plan(conversation, session['user'])
            current_app.storage_service.save_plan(session['user']['id'], plan)
            session.pop('onboarding_conversation', None)
            current_app.storage_service.set_onboarding_complete(user_id, True)
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
        conversation = current_app.storage_service.fetch_coach_conversation(user_id)
        session['coach_conversation'] = conversation
        session.modified = True

    if request.method == 'POST':
        user_message = request.form['message']
        conversation.append({'role': 'user', 'content': user_message})

        if _onboarding_complete():
            ai_message = current_app.ai_service.check_in(conversation, user)
        else:
            ai_message = current_app.ai_service.continue_onboarding(conversation, user)
        conversation.append({'role': 'assistant', 'content': ai_message})
        session['coach_conversation'] = conversation
        session.modified = True

        current_app.storage_service.save_coach_conversation(user_id, conversation)

    return render_template('ai_coach.html', conversation=conversation)


@main_bp.route('/plan')
def plan() -> str | Response:
    redirect_url = _require_login()
    if redirect_url:
        return redirect(redirect_url)

    onboarding_redirect = _ensure_onboarding_complete()
    if onboarding_redirect:
        return onboarding_redirect

    plan = current_app.storage_service.fetch_plan(session['user']['id'])
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
        meals = request.form.get('meals')
        estimation: Optional[Dict[str, Any]] = None
        if meals:
            try:
                estimation = current_app.ai_service.estimate_meal_calories(meals)
            except Exception:
                estimation = None

        log_entry: Dict[str, Any] = {
            'timestamp': datetime.now(timezone.utc).isoformat(),
            'workout': request.form.get('workout'),
            'meals': meals,
            'sleep': request.form.get('sleep'),
            'habits': request.form.get('habits'),
        }

        if estimation:
            calories_value = estimation.get('calories')
            if calories_value is not None:
                log_entry['calories'] = calories_value

            macro_segments = []
            protein = estimation.get('protein_g')
            carbs = estimation.get('carbs_g')
            fat = estimation.get('fat_g')
            if protein is not None:
                macro_segments.append(f"P {protein}g")
            if carbs is not None:
                macro_segments.append(f"C {carbs}g")
            if fat is not None:
                macro_segments.append(f"F {fat}g")

            confidence = estimation.get('confidence')
            confidence_text: Optional[str]
            if isinstance(confidence, (int, float)):
                confidence_text = f"{confidence:.2f}".rstrip('0').rstrip('.') if confidence >= 0 else str(confidence)
            else:
                confidence_text = None

            if macro_segments:
                macro_string = ' / '.join(macro_segments)
                if confidence_text:
                    macro_string = f"{macro_string} (conf {confidence_text})"
                log_entry['macros'] = macro_string

            notes = estimation.get('notes')
            if notes:
                log_entry['estimation_notes'] = str(notes)

        current_app.storage_service.append_log(user_id, log_entry)
        flash('Progress saved. Keep up the great work!', 'success')
        return redirect(url_for('main.progress'))

    logs = current_app.storage_service.fetch_logs(user_id)
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
    plan = current_app.storage_service.fetch_plan(user_id)
    logs = current_app.storage_service.fetch_logs(user_id)
    conversation = current_app.storage_service.fetch_conversation(user_id)

    updated_plan = current_app.ai_service.regenerate_plan(plan, logs, conversation, user)
    current_app.storage_service.save_plan(user_id, updated_plan)
    flash('Your plan has been refreshed based on your latest updates.', 'success')
    return redirect(url_for('main.plan'))


@main_bp.route('/api/weekly_prompt')
def weekly_prompt() -> Dict[str, Any]:
    redirect_url = _require_login()
    if redirect_url:
        return {'error': 'Unauthorized'}, 401

    if not _onboarding_complete():
        return {'error': 'Onboarding incomplete'}, 403

    prompt = current_app.storage_service.get_weekly_prompt(session['user']['id'])
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
    storage = current_app.storage_service
    visualizations = storage.refresh_visualization_urls_if_needed(
        storage.list_visualizations(user_id)
    )

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
        directory = storage.user_images_dir(user_id)

        try:
            upload_bytes = file.read()
        except Exception:
            upload_bytes = b''

        if not upload_bytes:
            flash('We could not read your photo. Please try another image.', 'danger')
            return redirect(url_for('main.visualize'))

        temp_path = directory / f'{viz_id}_source{extension}'
        temp_path.write_bytes(upload_bytes)

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

        generated_bytes = current_app.ai_service.generate_visualization(temp_path, context)

        if isinstance(generated_bytes, dict):
            encoded = generated_bytes.get('image_base64')
            generated_bytes = None
            if encoded:
                try:
                    generated_bytes = base64.b64decode(encoded.split(',')[-1])
                except Exception:
                    current_app.logger.warning('Failed to decode generated visualization image payload')
        elif isinstance(generated_bytes, str):
            try:
                generated_bytes = base64.b64decode(generated_bytes.split(',')[-1])
            except Exception:
                current_app.logger.warning('Failed to decode visualization image string payload')

        try:
            original_saved = storage.save_visualization_image(
                user_id,
                upload_bytes,
                ext=extension.lstrip('.') or 'jpg',
            )
        except Exception:
            current_app.logger.exception('Failed to persist original image')
            flash('We could not save your photo. Please try again.', 'danger')
            temp_path.unlink(missing_ok=True)
            return redirect(url_for('main.visualize'))

        future_bytes = generated_bytes or upload_bytes
        future_ext = 'png' if generated_bytes else (extension.lstrip('.') or 'jpg')
        try:
            future_saved = storage.save_visualization_image(
                user_id,
                future_bytes,
                ext=future_ext,
            )
        except Exception:
            current_app.logger.exception('Failed to persist visualization image')
            temp_path.unlink(missing_ok=True)
            _cleanup_paths = [original_saved.get('path')]
            for item in _cleanup_paths:
                if item:
                    Path(item).unlink(missing_ok=True)
            flash('We generated an image but could not save it. Please try again.', 'danger')
            return redirect(url_for('main.visualize'))

        temp_path.unlink(missing_ok=True)

        meta = {
            'id': viz_id,
            'created_at': future_saved.get('created_at'),
            'goal_type': context['goal_type'],
            'intensity': context['intensity'],
            'timeline': context['timeline'],
            'profile': profile_data,
            'prompt': f"{context['goal_type']} · {context['timeline']} · {context['intensity']}",
            'model': getattr(current_app.ai_service, '_image_model_id', None),
            'hash': hashlib.md5(future_bytes).hexdigest(),
            'key': future_saved.get('key'),
            'url': future_saved.get('url'),
            'storage_path': future_saved.get('path'),
            'original_key': original_saved.get('key'),
            'original_url': original_saved.get('url'),
            'original_storage_path': original_saved.get('path'),
            'notes': '',
        }

        try:
            storage.record_visualization_metadata(user_id, meta)
        except Exception:
            current_app.logger.exception('Failed to persist visualization metadata')
            for cleanup in (future_saved.get('path'), original_saved.get('path')):
                if cleanup:
                    Path(cleanup).unlink(missing_ok=True)
            flash('Something went wrong while saving your visualization metadata. Please try again.', 'danger')
            return redirect(url_for('main.visualize'))

        flash('Your future self visualization is ready! Explore it below.', 'success')
        return redirect(url_for('main.visualize'))

    latest_entry = visualizations[0] if visualizations else {}
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
    entry = current_app.storage_service.get_visualization(user_id, visualization_id)
    if not entry:
        abort(404)

    if variant == 'future':
        candidate = entry.get('storage_path')
        fallback = entry.get('future')
    else:
        candidate = entry.get('original_storage_path')
        fallback = entry.get('original')

    if candidate:
        path = Path(candidate)
        if path.is_file():
            return send_from_directory(path.parent, path.name, max_age=86400)

    if not fallback:
        abort(404)

    directory = current_app.storage_service.user_images_dir(user_id)
    safe_name = Path(fallback).name
    return send_from_directory(directory, safe_name, max_age=86400)


@main_bp.route('/user-images/<user_id>/<path:filename>')
def user_image(user_id: str, filename: str):
    redirect_url = _require_login()
    if redirect_url:
        return redirect(redirect_url)

    if session['user']['id'] != user_id:
        abort(403)

    safe_name = Path(filename).name
    if safe_name != filename:
        abort(404)

    directory = current_app.storage_service.user_images_dir(user_id)
    path = directory / safe_name
    if not path.exists():
        abort(404)

    return send_from_directory(directory, safe_name, max_age=86400)


@main_bp.route('/visualize/<visualization_id>/delete', methods=['POST'])
def delete_visualization(visualization_id: str) -> Response:
    redirect_url = _require_login()
    if redirect_url:
        return redirect(redirect_url)

    onboarding_redirect = _ensure_onboarding_complete()
    if onboarding_redirect:
        return onboarding_redirect

    user_id = session['user']['id']
    removed = current_app.storage_service.remove_visualization(user_id, visualization_id)
    if not removed:
        flash('Visualization not found.', 'warning')
        return redirect(url_for('main.visualize'))

    for path_value in (
        removed.get('storage_path'),
        removed.get('original_storage_path'),
    ):
        if not path_value:
            continue
        try:
            Path(path_value).unlink()
        except FileNotFoundError:
            continue

    # Fallback cleanup for legacy entries storing only filenames
    directory = current_app.storage_service.user_images_dir(user_id)
    for key in ('original', 'future'):
        filename = removed.get(key)
        if not filename:
            continue
        legacy_path = directory / filename
        try:
            legacy_path.unlink()
        except FileNotFoundError:
            continue

    flash('Visualization deleted.', 'info')
    return redirect(url_for('main.visualize'))


@main_bp.route('/settings')
@login_required
def settings_view() -> str:
    user = session['user']
    preferences = current_app.storage_service.fetch_preferences(user['id']) or {}
    logger.info('settings.view', extra={'user_id': user['id']})
    return render_template('settings.html', preferences=preferences, user=user)


@main_bp.route('/settings/update-username', methods=['POST'])
@login_required
def update_username() -> Response:
    user = session['user']
    target = url_for('main.settings_view')
    new_name = (request.form.get('display_name') or '').strip()
    if not new_name:
        flash('Please provide a display name before saving.', 'warning')
        logger.info('settings.update_username.validation_failed', extra={'user_id': user['id']})
        return redirect(target)

    try:
        current_app.storage_service.update_display_name(user['id'], new_name)
    except ValueError as exc:
        flash(str(exc), 'danger')
        logger.warning(
            'settings.update_username.failed',
            extra={'user_id': user['id'], 'error': str(exc)},
        )
    except Exception:
        flash('We could not update your display name. Please try again.', 'danger')
        logger.exception('settings.update_username.error', extra={'user_id': user['id']})
    else:
        session['user']['name'] = new_name
        session.modified = True
        flash('Display name updated.', 'success')
        logger.info('settings.update_username.success', extra={'user_id': user['id']})
    return redirect(target)


@main_bp.route('/settings/update-password', methods=['POST'])
@login_required
def update_password() -> Response:
    user = session['user']
    target = url_for('main.settings_view')

    current_password = request.form.get('current_password', '')
    new_password = request.form.get('new_password', '')
    confirm_password = request.form.get('confirm_password', '')

    if not current_password or not new_password:
        flash('Please complete all password fields.', 'warning')
        logger.info('settings.update_password.validation_failed', extra={'user_id': user['id']})
        return redirect(target)

    if new_password != confirm_password:
        flash('New passwords do not match. Double-check and try again.', 'warning')
        logger.info('settings.update_password.mismatch', extra={'user_id': user['id']})
        return redirect(target)

    if len(new_password) < 8:
        flash('Choose a password that is at least 8 characters.', 'warning')
        logger.info('settings.update_password.too_short', extra={'user_id': user['id']})
        return redirect(target)

    try:
        current_app.storage_service.update_password(
            user['id'], user.get('email', ''), current_password, new_password
        )
    except ValueError as exc:
        flash(str(exc), 'danger')
        logger.warning(
            'settings.update_password.denied',
            extra={'user_id': user['id'], 'error': str(exc)},
        )
    except Exception:
        flash('We could not change your password right now. Please try again later.', 'danger')
        logger.exception('settings.update_password.error', extra={'user_id': user['id']})
    else:
        flash('Password updated successfully.', 'success')
        logger.info('settings.update_password.success', extra={'user_id': user['id']})

    return redirect(target)


@main_bp.route('/settings/update-preferences', methods=['POST'])
@login_required
def update_preferences() -> Response:
    user = session['user']
    target = url_for('main.settings_view')

    preferences = {
        'timezone': (request.form.get('timezone') or '').strip(),
        'unit_system': request.form.get('unit_system', 'metric'),
        'weekly_summary': bool(request.form.get('weekly_summary')),
        'reminder_window': request.form.get('reminder_window', 'morning'),
        'coach_tone': request.form.get('coach_tone', 'balanced'),
    }

    try:
        saved = current_app.storage_service.update_preferences(user['id'], preferences)
    except Exception:
        flash('We were unable to save your preferences. Please retry shortly.', 'danger')
        logger.exception('settings.update_preferences.error', extra={'user_id': user['id']})
        return redirect(target)

    session_user_preferences = session['user'].setdefault('preferences', {})
    if isinstance(session_user_preferences, dict):
        session_user_preferences.update(saved)
    else:
        session['user']['preferences'] = saved
    session.modified = True

    flash('Preferences saved.', 'success')
    logger.info('settings.update_preferences.success', extra={'user_id': user['id']})
    return redirect(target)


@main_bp.route('/settings/clear-data', methods=['POST'])
@login_required
def clear_account_data() -> Response:
    user = session['user']
    target = url_for('main.settings_view')
    password = request.form.get('confirm_password', '')

    if not password:
        flash('Please re-enter your password to confirm.', 'warning')
        logger.info('settings.clear_data.validation_failed', extra={'user_id': user['id']})
        return redirect(target)

    if not current_app.storage_service.verify_password(user.get('email', ''), password):
        flash('Password did not match. We did not clear any data.', 'danger')
        logger.warning('settings.clear_data.denied', extra={'user_id': user['id']})
        return redirect(target)

    try:
        current_app.storage_service.clear_user_data(user['id'])
    except Exception:
        flash('We could not clear your account data. Please try again later.', 'danger')
        logger.exception('settings.clear_data.error', extra={'user_id': user['id']})
        return redirect(target)

    session.pop('onboarding_conversation', None)
    session.pop('coach_conversation', None)
    session.modified = True

    flash('All FitVision data tied to your account has been cleared.', 'info')
    logger.info('settings.clear_data.success', extra={'user_id': user['id']})
    return redirect(target)


@main_bp.route('/settings/delete-account', methods=['POST'])
@login_required
def delete_account() -> Response:
    user = session['user']
    password = request.form.get('confirm_password', '')
    phrase = (request.form.get('confirm_phrase') or '').strip().upper()
    required_phrase = 'DELETE'

    if phrase != required_phrase:
        flash('Type DELETE in all caps to confirm account removal.', 'warning')
        logger.info('settings.delete_account.confirm_phrase_mismatch', extra={'user_id': user['id']})
        return redirect(url_for('main.settings_view'))

    if not password:
        flash('Please re-enter your password to continue.', 'warning')
        logger.info('settings.delete_account.missing_password', extra={'user_id': user['id']})
        return redirect(url_for('main.settings_view'))

    if not current_app.storage_service.verify_password(user.get('email', ''), password):
        flash('Password did not match our records. Account not deleted.', 'danger')
        logger.warning('settings.delete_account.denied', extra={'user_id': user['id']})
        return redirect(url_for('main.settings_view'))

    try:
        current_app.storage_service.delete_user_account(user['id'], user.get('email', ''))
    except Exception:
        flash('We were unable to delete your account. Please try again shortly.', 'danger')
        logger.exception('settings.delete_account.error', extra={'user_id': user['id']})
        return redirect(url_for('main.settings_view'))

    session_interface = current_app.session_interface
    sid = getattr(session, 'sid', None)
    if sid and hasattr(session_interface, 'delete_session'):
        try:
            session_interface.delete_session(current_app, sid)
        except Exception:
            logger.warning('settings.delete_account.session_cleanup_failed', exc_info=True)

    cookie_name = current_app.config.get('SESSION_COOKIE_NAME', 'session')

    session.clear()
    flash('Your FitVision account has been permanently deleted.', 'info')
    logger.info('settings.delete_account.success', extra={'user_id': user['id']})

    response = redirect(url_for('main.index'))
    response.delete_cookie(cookie_name)
    return response
