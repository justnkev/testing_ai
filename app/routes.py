from __future__ import annotations

import base64
import hashlib
import os
from datetime import date, datetime, timedelta, timezone
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
from .services.health_ingestion import HealthDataIngestion
from .services.storage_service import StorageService

main_bp = Blueprint('main', __name__)

ai_service = AIService()
storage_service = StorageService()
health_ingestion = HealthDataIngestion(storage_service, ai_service)

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


def _create_template_compatible_logs(logs: List[Dict]) -> List[Dict]:
    """
    Transforms the new log data structure (with lists of entries) into a
    flattened format that legacy templates can display. This is a compatibility
    layer to make data visible in the UI without modifying the templates.
    """
    processed_logs = []
    for log_data in logs:
        # Create a copy to avoid modifying the original data which is used elsewhere
        compatible_log = log_data.copy()
        meals_log = [entry for entry in log_data.get('meals_log', []) if isinstance(entry, dict)]
        daily_totals = log_data.get('daily_totals') or {}

        calories_total: Optional[int] = None
        macro_totals = {'protein_g': 0, 'carbs_g': 0, 'fat_g': 0}
        if meals_log:
            calories_total = 0
            for meal in meals_log:
                calories_total += meal.get('calories', 0) or 0
                macro_totals['protein_g'] += meal.get('protein_g', 0) or 0
                macro_totals['carbs_g'] += meal.get('carbs_g', 0) or 0
                macro_totals['fat_g'] += meal.get('fat_g', 0) or 0
        elif daily_totals:
            calories_total = daily_totals.get('calories')
            macro_totals['protein_g'] = daily_totals.get('protein_g', 0) or 0
            macro_totals['carbs_g'] = daily_totals.get('carbs_g', 0) or 0
            macro_totals['fat_g'] = daily_totals.get('fat_g', 0) or 0

        macro_text = None
        if any(macro_totals.values()):
            macro_text = (
                f"P{int(macro_totals['protein_g'])}/"
                f"C{int(macro_totals['carbs_g'])}/"
                f"F{int(macro_totals['fat_g'])}"
            )
        if calories_total is not None:
            compatible_log['calories'] = calories_total
        if macro_text:
            compatible_log['macros'] = macro_text

        notes = [entry.get('notes') for entry in meals_log if entry.get('notes')]
        if notes and not compatible_log.get('estimation_notes'):
            compatible_log['estimation_notes'] = " | ".join(notes)

        # Combine multiple meal entries into a single text block
        compatible_log['meals'] = "\n".join(
            [entry.get('text', '') for entry in log_data.get('meals_log', [])]
        ).strip()

        # Combine multiple workout entries
        compatible_log['workout'] = "\n".join(
            [entry.get('text', '') for entry in log_data.get('workouts_log', [])]
        ).strip()

        # Combine multiple sleep entries
        compatible_log['sleep'] = "\n".join(
            [entry.get('text', '') for entry in log_data.get('sleep_log', [])]
        ).strip()

        processed_logs.append(compatible_log)
    return processed_logs


def _parse_sleep_hours(value: Any) -> float:
    if isinstance(value, (int, float)):
        return float(value)
    if isinstance(value, str):
        match = re.search(r"([0-9]+(?:\.[0-9]+)?)", value)
        if match:
            try:
                return float(match.group(1))
            except ValueError:
                return 0.0
    return 0.0


def _derive_dashboard_stats(user_id: str) -> Tuple[Dict[str, Any], List[Dict[str, Any]]]: # noqa: E501
    """Return summarized metrics and a lightweight activity trend.

    All calculations use ``timezone.utc`` to ensure consistent week boundaries
    across environments. """

    today = datetime.now(timezone.utc).date()
    start_of_week = today - timedelta(days=today.weekday())
    recent_days = [start_of_week + timedelta(days=offset) for offset in range(0, 7)]
    day_buckets: Dict[str, Dict[str, float]] = {
        day.isoformat(): {'meals': 0, 'workouts': 0, 'sleep_hours': 0.0}
        for day in recent_days
    }

    meals = current_app.storage_service.list_normalized_records('meals', user_id)
    workouts = current_app.storage_service.list_normalized_records('workouts', user_id)
    sleep_entries = current_app.storage_service.list_normalized_records('sleep', user_id)

    calories_total = 0.0

    for meal in meals:
        date_key = meal.get('date_inferred')
        if date_key in day_buckets:
            day_buckets[date_key]['meals'] += 1
            calories_total += meal.get('calories', 0.0) or 0.0

    for workout in workouts:
        date_key = workout.get('date_inferred')
        if date_key in day_buckets:
            day_buckets[date_key]['workouts'] += 1

    for sleep_entry in sleep_entries:
        date_key = sleep_entry.get('date_inferred')
        time_asleep = sleep_entry.get('time_asleep')
        if date_key in day_buckets and time_asleep:
            hours = _parse_sleep_hours(time_asleep)
            day_buckets[date_key]['sleep_hours'] += hours

    totals = {
        'workouts': sum(bucket['workouts'] for bucket in day_buckets.values()),
        'meals': sum(bucket['meals'] for bucket in day_buckets.values()),
        'sleep_hours': sum(bucket['sleep_hours'] for bucket in day_buckets.values()),
        'habits': 0,
    }

    trend: List[Dict[str, Any]] = []
    for day in recent_days:
        key = day.isoformat()
        bucket = day_buckets[key]
        intensity = bucket['meals'] + bucket['workouts'] + bucket['sleep_hours']
        trend.append({'label': key, 'value': intensity})

    workout_goal = 5
    meal_goal = 14
    sleep_goal = 49  # 7 nights * 7 hours

    stats = {
        'total_workouts': int(totals['workouts']),
        'total_meals': int(totals['meals']),
        'total_habits': totals['habits'],
        'hours_sleep': round(totals['sleep_hours'], 1),
        'calories_estimate': calories_total,
        'calories_burned': int(totals['workouts'] * 320),
        'workout_completion': min(100, int((totals['workouts'] / workout_goal) * 100)) if workout_goal else 0,
        'meal_completion': min(100, int((totals['meals'] / meal_goal) * 100)) if meal_goal else 0,
        'sleep_completion': min(100, int((totals['sleep_hours'] / sleep_goal) * 100)) if sleep_goal else 0,
        'has_data': any(value for bucket in day_buckets.values() for value in bucket.values()),
    }

    return stats, trend


def _parse_date_only(value: Any) -> Optional[date]:
    if value is None:
        return None

    if isinstance(value, date) and not isinstance(value, datetime):
        return value

    if isinstance(value, datetime):
        return value.date()

    if isinstance(value, str):
        text = value.strip()
        if not text:
            return None
        if text.endswith('Z'):
            text = text[:-1] + '+00:00'
        try:
            return datetime.fromisoformat(text).date()
        except ValueError:
            if 'T' in text:
                text = text.split('T', 1)[0]
            try:
                return datetime.strptime(text, '%Y-%m-%d').date()
            except ValueError:
                return None
    return None


def _month_shift(base: date, offset_months: int) -> date:
    month = base.month + offset_months
    year = base.year + (month - 1) // 12
    month = (month - 1) % 12 + 1
    return date(year, month, 1)


def _chart_buckets(range_key: str) -> List[Dict[str, Any]]:
    today = datetime.now(timezone.utc).date()

    if range_key == 'weekly':
        start_of_week = today - timedelta(days=today.weekday())
        buckets = []
        for offset in range(3, -1, -1):
            start = start_of_week - timedelta(days=7 * offset)
            end = start + timedelta(days=7)
            label = start.strftime('Week of %b %d')
            buckets.append({'label': label, 'start': start, 'end': end})
        return buckets

    if range_key == 'monthly':
        base = date(today.year, today.month, 1)
        buckets = []
        for offset in range(5, -1, -1):
            start = _month_shift(base, -offset)
            end = _month_shift(start, 1)
            label = start.strftime("%b '%y")
            buckets.append({'label': label, 'start': start, 'end': end})
        return buckets

    buckets = []
    for offset in range(6, -1, -1):
        start = today - timedelta(days=offset)
        end = start + timedelta(days=1)
        label = start.strftime('%a')
        buckets.append({'label': label, 'start': start, 'end': end})
    return buckets


def _bucketize(entries: List[Dict[str, Any]], buckets: List[Dict[str, Any]], value_resolver) -> List[float]:
    totals = [0.0 for _ in buckets]
    for entry in entries:
        parsed = _parse_date_only(entry.get('date_inferred') or entry.get('created_at'))
        if not parsed:
            continue
        for index, bucket in enumerate(buckets):
            if bucket['start'] <= parsed < bucket['end']:
                totals[index] += value_resolver(entry)
                break
    return [round(value, 1) for value in totals]


def _parse_float(value: Any) -> float:
    match = re.search(r'\d+(?:\.\d+)?', str(value or ''))
    return float(match.group(0)) if match else 0.0


def _bucket_index(value_date: Optional[date], buckets: List[Dict[str, Any]]) -> Optional[int]:
    if not value_date:
        return None
    for index, bucket in enumerate(buckets):
        if bucket['start'] <= value_date < bucket['end']:
            return index
    return None


def _aggregate_trend_series(range_key: str, user_id: str, storage: StorageService) -> Dict[str, Any]:
    buckets = _chart_buckets(range_key)
    labels = [bucket['label'] for bucket in buckets]

    meals = storage.list_normalized_records('meals', user_id)
    workouts = storage.list_normalized_records('workouts', user_id)
    sleep_entries = storage.list_normalized_records('sleep', user_id)

    macro_series = {
        'protein': [0.0 for _ in buckets],
        'carbs': [0.0 for _ in buckets],
        'fat': [0.0 for _ in buckets],
        'calories': [0.0 for _ in buckets],
    }

    sleep_series: Dict[str, List[float]] = {}
    workout_counts: Dict[str, List[int]] = {}
    workout_durations: Dict[str, List[float]] = {}

    for meal in meals:
        parsed_date = _parse_date_only(meal.get('date_inferred'))
        bucket_idx = _bucket_index(parsed_date, buckets)
        if bucket_idx is None:
            continue
        macro_series['protein'][bucket_idx] += meal.get('protein_g') or 0.0
        macro_series['carbs'][bucket_idx] += meal.get('carbs_g') or 0.0
        macro_series['fat'][bucket_idx] += meal.get('fat_g') or 0.0
        macro_series['calories'][bucket_idx] += meal.get('calories') or 0.0

    for sleep_entry in sleep_entries:
        parsed_date = _parse_date_only(sleep_entry.get('date_inferred') or sleep_entry.get('created_at'))
        bucket_idx = _bucket_index(parsed_date, buckets)
        if bucket_idx is None:
            continue
        quality = (sleep_entry.get('quality') or 'unknown').strip() or 'unknown'
        hours = _parse_sleep_hours(sleep_entry.get('time_asleep') or (sleep_entry.get('metadata') or {}).get('hours'))
        if quality not in sleep_series:
            sleep_series[quality] = [0.0 for _ in buckets]
        sleep_series[quality][bucket_idx] += hours

    for workout in workouts:
        parsed_date = _parse_date_only(workout.get('date_inferred') or workout.get('created_at'))
        bucket_idx = _bucket_index(parsed_date, buckets)
        if bucket_idx is None:
            continue
        workout_type = (workout.get('workout_type') or 'other').strip() or 'other'
        duration = _parse_float(workout.get('duration_min') or (workout.get('metadata') or {}).get('duration'))
        if workout_type not in workout_counts:
            workout_counts[workout_type] = [0 for _ in buckets]
            workout_durations[workout_type] = [0.0 for _ in buckets]
        workout_counts[workout_type][bucket_idx] += 1
        workout_durations[workout_type][bucket_idx] += duration

    # Sort qualities/types for stable ordering
    sorted_sleep = {quality: values for quality, values in sorted(sleep_series.items())}
    sorted_workout_counts = {wt: counts for wt, counts in sorted(workout_counts.items())}
    sorted_workout_durations = {wt: durations for wt, durations in sorted(workout_durations.items())}

    return {
        'labels': labels,
        'macros': {key: [round(value, 2) for value in series] for key, series in macro_series.items()},
        'sleep': {
            'qualities': list(sorted_sleep.keys()),
            'series': {quality: [round(v, 2) for v in values] for quality, values in sorted_sleep.items()},
        },
        'workouts': {
            'types': list(sorted_workout_counts.keys()),
            'counts': sorted_workout_counts,
            'durations': {key: [round(v, 2) for v in values] for key, values in sorted_workout_durations.items()},
        },
    }


def _build_dashboard_range_data(range_key: str, user_id: str, storage: StorageService) -> Dict[str, Any]:
    buckets = _chart_buckets(range_key)
    meals = storage.list_normalized_records('meals', user_id)
    workouts = storage.list_normalized_records('workouts', user_id)
    sleep_entries = storage.list_normalized_records('sleep', user_id)

    sleep_hours = _bucketize(
        sleep_entries,
        buckets,
        lambda entry: _parse_float(entry.get('time_asleep'))
        or _parse_float((entry.get('metadata') or {}).get('hours'))
        or _parse_float((entry.get('metadata') or {}).get('time_asleep')),
    )

    return {
        'labels': [bucket['label'] for bucket in buckets],
        'meals': _bucketize(meals, buckets, lambda _entry: 1),
        'workouts': _bucketize(workouts, buckets, lambda _entry: 1),
        'sleep': sleep_hours,
    }


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

    supabase_config = StorageService.supabase_client_config()

    # Derive stats from the raw, structured logs
    stats, trend = _derive_dashboard_stats(user['id'])

    # Create a version of logs compatible with templates expecting flat data
    template_logs = _create_template_compatible_logs(logs)
    recent_logs = list(reversed(template_logs[-3:])) if template_logs else []

    return render_template(
        'dashboard.html',
        plan=plan,
        logs=template_logs,
        weekly_prompt=weekly_prompt,
        stats=stats,
        trend=trend,
        recent_logs=recent_logs,
        supabase_config=supabase_config,
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
        workout = (request.form.get('workout') or '').strip()
        meals = (request.form.get('meals') or '').strip()
        sleep = (request.form.get('sleep') or '').strip()
        habits = (request.form.get('habits') or '').strip()

        if not any([workout, meals, sleep, habits]):
            flash("Please fill out at least one section to log your progress.", 'warning')
            return redirect(url_for('main.progress'))

        # This dictionary will hold the new, individual entries to be added to the daily log.
        new_entries: Dict[str, Any] = {
            'timestamp': datetime.now(timezone.utc).isoformat(),
        }

        # Generate a unique integer ID using the current timestamp in microseconds.
        # This will serve as the base for multiple entries in the same request.
        unique_id_counter = int(datetime.now(timezone.utc).timestamp() * 1_000_000)

        if meals:
            meal_entry: Dict[str, Any] = {
                'id': unique_id_counter,
                'text': meals,
                'timestamp': new_entries['timestamp'],
                'llm_method': 'meal_estimation_v1',
            }
            try:
                estimation = current_app.ai_service.estimate_meal_calories(meals)
                if estimation:
                    meal_entry.update(estimation)
                else:
                    meal_entry.setdefault(
                        "notes",
                        "Calorie estimation unavailable; saved with placeholder nutrition values.",
                    )
            except Exception:
                logger.warning('meal_estimation.failed', exc_info=True)
                meal_entry.setdefault(
                    "notes",
                    "Calorie estimation unavailable; saved with placeholder nutrition values.",
                )
            new_entries['new_meal'] = meal_entry
            unique_id_counter += 1

        if workout:
            workout_entry: Dict[str, Any] = {
                'id': unique_id_counter,
                'text': workout,
                'timestamp': new_entries['timestamp'],
            }
            try:
                interpretation = current_app.ai_service.interpret_workout_log(workout)
                if interpretation:
                    workout_entry.update(interpretation)
            except Exception:
                logger.warning('workout_interpretation.failed', exc_info=True)
            new_entries['new_workout'] = workout_entry
            unique_id_counter += 1

        if sleep:
            sleep_entry: Dict[str, Any] = {
                'id': unique_id_counter,
                'text': sleep,
                'timestamp': new_entries['timestamp'],
            }
            try:
                interpretation = current_app.ai_service.interpret_sleep_log(sleep)
                if interpretation:
                    sleep_entry.update(interpretation)
            except Exception:
                logger.warning('sleep_interpretation.failed', exc_info=True)
            new_entries['new_sleep'] = sleep_entry
            unique_id_counter += 1

        if habits:
            # Habits still overwrite the daily summary
            new_entries['new_habits'] = habits

        progress_log = current_app.storage_service.append_log(user_id, new_entries)
        ingester = getattr(current_app, 'health_ingestion', None)
        if ingester:
            try:
                ingester.enqueue_log_record(progress_log)
            except Exception:
                logger.warning('health_ingestion.enqueue_failed', exc_info=True)
        flash('Your progress has been logged. Keep up the great work!', 'success')
        return redirect(url_for('main.progress'))

    logs = current_app.storage_service.fetch_logs(user_id)
    template_logs = _create_template_compatible_logs(logs)
    return render_template('progress.html', logs=template_logs)


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


@main_bp.route('/api/dashboard_range')
@login_required
def dashboard_range() -> Dict[str, Any]:
    user_id = session['user']['id']
    range_key = (request.args.get('range') or 'daily').lower()
    if range_key not in {'daily', 'weekly', 'monthly'}:
        range_key = 'daily'

    data = _build_dashboard_range_data(range_key, user_id, current_app.storage_service)
    return {'data': data}


@main_bp.route('/api/dashboard_trends')
@login_required
def dashboard_trends() -> Dict[str, Any]:
    user_id = session['user']['id']
    range_key = (request.args.get('range') or 'weekly').lower()
    if range_key not in {'daily', 'weekly', 'monthly'}:
        range_key = 'weekly'

    data = _aggregate_trend_series(range_key, user_id, current_app.storage_service)
    return {'data': data, 'range': range_key}


@main_bp.route('/api/daily_calories')
def daily_calories() -> Dict[str, Any]:
    redirect_url = _require_login()
    if redirect_url:
        return {'error': 'Unauthorized'}, 401

    user_id = session['user']['id']
    ingester = getattr(current_app, 'health_ingestion', None)
    data = ingester.daily_calories(user_id) if ingester else []
    return {'data': data}


@main_bp.route('/api/workout_summary_by_type')
@login_required
def workout_summary_by_type() -> Dict[str, Any]:
    user_id = session['user']['id']
    ingester = getattr(current_app, 'health_ingestion', None)
    if not ingester:
        return {'error': 'Ingestion service not available'}, 500
    
    data = ingester.workout_duration_by_type(user_id)
    return {'data': data}


@main_bp.route('/api/daily_macros')
@login_required
def daily_macros() -> Dict[str, Any]:
    user_id = session['user']['id']
    ingester = getattr(current_app, 'health_ingestion', None)
    if not ingester:
        return {'error': 'Ingestion service not available'}, 500
    
    data = ingester.daily_macros(user_id)
    return {'data': data}


@main_bp.route('/api/sleep_summary_by_quality')
@login_required
def sleep_summary_by_quality() -> Dict[str, Any]:
    user_id = session['user']['id']
    ingester = getattr(current_app, 'health_ingestion', None)
    if not ingester:
        return {'error': 'Ingestion service not available'}, 500
    
    data = ingester.sleep_hours_by_quality(user_id)
    return {'data': data}


@main_bp.route('/api/daily_progress_summary')
@login_required
def daily_progress_summary() -> Dict[str, Any]:
    user_id = session['user']['id']
    ingester = getattr(current_app, 'health_ingestion', None)
    if not ingester:
        return {'error': 'Ingestion service not available'}, 500
    
    data = ingester.get_daily_progress_summary(user_id)
    return {'data': data}


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
