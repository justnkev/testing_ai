from __future__ import annotations

import base64
import hashlib
import statistics
from datetime import datetime, timedelta, timezone
from pathlib import Path
import re
from typing import Any, Dict, List, Optional, Tuple
from uuid import uuid4

from flask import (
    Blueprint,
    Response,
    abort,
    flash,
    jsonify,
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
from .utils.auth import AuthError, decode_device_jwt

main_bp = Blueprint('main', __name__)

ai_service = AIService()
storage_service = StorageService()

SUPPORTED_HEALTH_TYPES = {
    'step_count',
    'active_energy_burned',
    'dietary_energy_consumed',
    'dietary_protein',
    'dietary_carbohydrates',
    'dietary_fat_total',
    'sleep_analysis',
    'heart_rate',
    'body_mass',
    'body_fat_percentage',
}


def _extract_bearer_token() -> str:
    auth_header = request.headers.get('Authorization', '')
    parts = auth_header.split()
    if len(parts) == 2 and parts[0].lower() == 'bearer':
        return parts[1]
    return ''


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


def _parse_iso8601(value: Any) -> Optional[datetime]:
    if isinstance(value, datetime):
        return value.astimezone(timezone.utc)
    if isinstance(value, str):
        text = value.strip()
        if not text:
            return None
        if text.endswith('Z'):
            text = text[:-1] + '+00:00'
        try:
            parsed = datetime.fromisoformat(text)
        except ValueError:
            return None
        if parsed.tzinfo is None:
            parsed = parsed.replace(tzinfo=timezone.utc)
        return parsed.astimezone(timezone.utc)
    return None


def _safe_float(value: Any) -> Optional[float]:
    try:
        return float(value)
    except (TypeError, ValueError):
        return None


def _format_datetime_for_display(value: Optional[datetime]) -> Optional[str]:
    if value is None:
        return None
    return value.astimezone(timezone.utc).strftime('%Y-%m-%d %H:%M UTC')


def _build_health_summary(user_id: str) -> Dict[str, Any]:
    """Aggregate server-side health metrics for dashboard/progress views."""

    now = datetime.now(timezone.utc)
    start_30d = now - timedelta(days=30)
    start_7d = now - timedelta(days=7)
    service = current_app.storage_service

    summary: Dict[str, Any] = {
        'has_samples': False,
        'last_sync': None,
        'last_sync_display': None,
        'steps_7d': 0,
        'steps_30d': 0,
        'active_energy_7d': 0.0,
        'dietary_energy_7d': 0.0,
        'sleep_hours_7d': 0.0,
        'heart_rate': {
            'min': None,
            'max': None,
            'avg': None,
        },
        'daily': [],
    }

    latest_sample: Optional[datetime] = None
    daily_buckets: Dict[Any, Dict[str, Any]] = {}

    def ensure_day_bucket(day: datetime) -> Dict[str, Any]:
        key = day.date()
        if key not in daily_buckets:
            daily_buckets[key] = {
                'date': key,
                'steps': 0.0,
                'active_energy': 0.0,
                'dietary_energy': 0.0,
                'sleep_hours': 0.0,
                'heart_rates': [],
            }
        return daily_buckets[key]

    # Steps
    step_samples = service.fetch_health_timeseries(user_id, 'step_count', start_30d, now)
    for sample in step_samples:
        start = _parse_iso8601(sample.get('start_at'))
        if start is None:
            continue
        value = _safe_float(sample.get('value'))
        if value is None:
            continue
        summary['steps_30d'] += value
        if start >= start_7d:
            summary['steps_7d'] += value
            bucket = ensure_day_bucket(start)
            bucket['steps'] += value
        if latest_sample is None or start > latest_sample:
            latest_sample = start

    # Active energy
    active_samples = service.fetch_health_timeseries(user_id, 'active_energy_burned', start_30d, now)
    for sample in active_samples:
        start = _parse_iso8601(sample.get('start_at'))
        if start is None:
            continue
        value = _safe_float(sample.get('value'))
        if value is None:
            continue
        if start >= start_7d:
            summary['active_energy_7d'] += value
            bucket = ensure_day_bucket(start)
            bucket['active_energy'] += value
        if latest_sample is None or start > latest_sample:
            latest_sample = start

    # Dietary energy
    dietary_samples = service.fetch_health_timeseries(user_id, 'dietary_energy_consumed', start_30d, now)
    for sample in dietary_samples:
        start = _parse_iso8601(sample.get('start_at'))
        if start is None:
            continue
        value = _safe_float(sample.get('value'))
        if value is None:
            continue
        if start >= start_7d:
            summary['dietary_energy_7d'] += value
            bucket = ensure_day_bucket(start)
            bucket['dietary_energy'] += value
        if latest_sample is None or start > latest_sample:
            latest_sample = start

    # Sleep analysis
    sleep_samples = service.fetch_health_timeseries(user_id, 'sleep_analysis', start_30d, now)
    for sample in sleep_samples:
        start = _parse_iso8601(sample.get('start_at'))
        end = _parse_iso8601(sample.get('end_at'))
        if start is None or end is None:
            continue
        duration_hours = (end - start).total_seconds() / 3600.0
        if duration_hours <= 0:
            continue
        if start >= start_7d:
            summary['sleep_hours_7d'] += duration_hours
            bucket = ensure_day_bucket(start)
            bucket['sleep_hours'] += duration_hours
        if latest_sample is None or end > latest_sample:
            latest_sample = end

    # Heart rate
    heart_rate_samples = service.fetch_health_timeseries(user_id, 'heart_rate', start_30d, now)
    heart_values: List[float] = []
    for sample in heart_rate_samples:
        start = _parse_iso8601(sample.get('start_at'))
        if start is None:
            continue
        value = _safe_float(sample.get('value'))
        if value is None:
            continue
        if start >= start_7d:
            heart_values.append(value)
            bucket = ensure_day_bucket(start)
            bucket['heart_rates'].append(value)
        if latest_sample is None or start > latest_sample:
            latest_sample = start

    if heart_values:
        summary['heart_rate']['min'] = round(min(heart_values), 1)
        summary['heart_rate']['max'] = round(max(heart_values), 1)
        summary['heart_rate']['avg'] = round(statistics.mean(heart_values), 1)

    # Daily roll-up for last 7 days
    daily_rows: List[Dict[str, Any]] = []
    for offset in range(7):
        day = (now - timedelta(days=offset)).date()
        bucket = daily_buckets.get(day, {
            'date': day,
            'steps': 0.0,
            'active_energy': 0.0,
            'dietary_energy': 0.0,
            'sleep_hours': 0.0,
            'heart_rates': [],
        })
        heart_rates = bucket.get('heart_rates', [])
        row = {
            'date': day.isoformat(),
            'steps': int(round(bucket.get('steps', 0.0))),
            'active_energy': round(bucket.get('active_energy', 0.0), 2),
            'dietary_energy': round(bucket.get('dietary_energy', 0.0), 2),
            'sleep_hours': round(bucket.get('sleep_hours', 0.0), 2),
            'heart_rate_min': round(min(heart_rates), 1) if heart_rates else None,
            'heart_rate_max': round(max(heart_rates), 1) if heart_rates else None,
            'heart_rate_avg': round(statistics.mean(heart_rates), 1) if heart_rates else None,
        }
        daily_rows.append(row)

    daily_rows.reverse()  # oldest first for charts/tables
    summary['daily'] = daily_rows

    if summary['steps_30d'] or summary['active_energy_7d'] or summary['dietary_energy_7d'] or heart_values or sleep_samples:
        summary['has_samples'] = True
    if latest_sample is not None:
        summary['last_sync'] = latest_sample
        summary['last_sync_display'] = _format_datetime_for_display(latest_sample)

    return summary


@main_bp.route('/api/healthkit/ingest', methods=['POST'])
def ingest_healthkit_samples() -> Response:
    token = _extract_bearer_token()
    secret = current_app.config.get('HEALTHKIT_JWT_SECRET', '')

    try:
        payload = decode_device_jwt(token, secret)
    except AuthError as exc:
        return jsonify({'error': str(exc)}), exc.status_code

    body = request.get_json(silent=True) or {}

    subject = str(payload.get('sub') or '')
    if not subject:
        return jsonify({'error': 'Token missing subject claim.'}), 401

    body_user_id = body.get('user_id')
    if body_user_id and str(body_user_id) != subject:
        return jsonify({'error': 'User mismatch between token and payload.'}), 403

    user_id = str(body_user_id or subject)
    samples = body.get('samples')
    if samples is None:
        return jsonify({'error': 'Request body must include a "samples" list.'}), 400
    if not isinstance(samples, list):
        return jsonify({'error': '"samples" must be a list.'}), 400

    summary = current_app.storage_service.upsert_health_samples(user_id, samples)

    anchor = body.get('anchor')
    if isinstance(anchor, dict) and anchor:
        current_app.storage_service.save_health_anchor(user_id, anchor)

    response_payload = {
        'accepted': summary.get('inserted', 0),
        'updated': summary.get('updated', 0),
        'total': summary.get('total', 0),
    }
    if isinstance(anchor, dict) and anchor:
        response_payload['anchor'] = anchor

    return jsonify(response_payload)


@main_bp.route('/api/healthkit/types', methods=['GET'])
def healthkit_types() -> Response:
    token = _extract_bearer_token()
    secret = current_app.config.get('HEALTHKIT_JWT_SECRET', '')

    try:
        payload = decode_device_jwt(token, secret)
    except AuthError as exc:
        return jsonify({'error': str(exc)}), exc.status_code

    subject = str(payload.get('sub') or '')
    requested_user = request.args.get('user_id')
    if requested_user and requested_user != subject:
        return jsonify({'error': 'User mismatch between token and request.'}), 403

    user_id = requested_user or subject
    anchor = current_app.storage_service.fetch_health_anchor(user_id) if user_id else {}

    return jsonify({'types': sorted(SUPPORTED_HEALTH_TYPES), 'anchor': anchor})


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
            user = current_app.storage_service.sign_up(email=email, password=password, name=name)
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
            user = current_app.storage_service.sign_in(email=email, password=password)
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
    health_summary = _build_health_summary(user['id'])

    return render_template(
        'dashboard.html',
        plan=plan,
        logs=logs,
        weekly_prompt=weekly_prompt,
        stats=stats,
        trend=trend,
        recent_logs=recent_logs,
        health_summary=health_summary,
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
            session.modified = True
            current_app.storage_service.clear_conversation(user_id)
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
    health_summary = _build_health_summary(user_id)
    return render_template('progress.html', logs=logs, health_summary=health_summary)


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
