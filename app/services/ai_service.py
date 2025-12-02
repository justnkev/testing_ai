from __future__ import annotations

import base64
import json
import logging
import os
import re
from datetime import datetime, timezone
from pathlib import Path
from typing import Any, Dict, List, Optional
from google import genai
from dotenv import load_dotenv
from google.genai import types
from typing import Any, Dict, Mapping, Optional
from collections.abc import Mapping as _MappingABC

load_dotenv()

logger = logging.getLogger(__name__)


class AIService:
    _TOPIC_SEQUENCE = [
        'physical_profile',
        'injury_history',
        'stress',
        'sleep',
        'activity',
        'exercise',
        'diet',
        'socialization',
    ]

    _ENV_KEY_PRIORITY = (
        'GEMINI_API_KEY',
        'GOOGLE_API_KEY',
        'GEMINI_API_KEY_SECRET',
        'FITVISION_GEMINI_API_KEY',
    )

    _TOPIC_KEYWORDS = {
        'physical_profile': [
            'height',
            'weight',
            'age',
            'birthday',
            'gender',
            'pronoun',
            'measurements',
            'body composition',
        ],
        'injury_history': [
            'injury',
            'injuries',
            'surgery',
            'sciatica',
            'pain',
            'rehab',
            'physical therapy',
            'condition',
            'medical history',
        ],
        'stress': ['stress', 'stressed', 'burnout', 'anxiety', 'pressure', 'overwhelm', 'relax', 'calm','panic'],
        'sleep': ['sleep', 'bedtime', 'insomnia', 'rest', 'slept', 'wakeup', 'tired', 'tiredness'],
        'activity': ['activity', 'active', 'movement', 'lifestyle', 'sedentary', 'steps', 'exercise', 'workout'],
        'exercise': ['exercise', 'workout', 'training', 'fitness', 'gym', 'run', 'yoga', 'cycling', 'swim', 'cardio', 'lift', 'strength', 'HIIT', 'pilates', 'crossfit'],
        'diet': ['diet', 'nutrition', 'meal', 'food', 'eat', 'eating', 'calorie', 'protein', 'carb', 'fat', 'vegetarian', 'vegan', 'gluten'],
        'socialization': ['social', 'friends', 'community', 'family', 'support network', 'team', 'teammates', 'connected' ,'lonely', 'isolation', 'relationship'],
    }

    _FALLBACK_TOPIC_QUESTIONS = {
        'physical_profile': (
            "To personalise your plan, could you share the basics—age, pronouns or gender identity, "
            "height, weight, and any body composition goals you're focusing on?"
        ),
        'injury_history': (
            "Do you have any current or past injuries, surgeries, or health conditions that affect how "
            "you move, train, or recover?"
        ),
        'stress': (
            "I'd love to understand your stress levels. What tends to raise or lower your stress "
            "throughout the week, and how do you usually decompress?"
        ),
        'sleep': (
            "Sleep sets the tone for everything. How many hours are you typically getting and "
            "what does your wind-down routine look like?"
        ),
        'activity': (
            "Tell me about your general daily activity. Are you on your feet, at a desk, or "
            "somewhere in between most days?"
        ),
        'exercise': (
            "What kind of intentional exercise or workouts are you doing right now, and how do "
            "they feel for you?"
        ),
        'diet': (
            "Walk me through a typical day of eating. Any preferences or restrictions I should keep in mind?"
        ),
        'socialization': (
            "Community matters too—who's in your corner? How connected do you feel with friends, family, "
            "or teammates lately?"
        ),
    }

    """Abstraction around the Gemini API with deterministic fallbacks.

    The MVP ships with a rule-based fallback so the experience works without
    external credentials. When a ``GEMINI_API_KEY`` (or ``GOOGLE_API_KEY``)
    environment variable is present, the service automatically calls Gemini and
    falls back to heuristics if the network request fails.
    """

    def __init__(self) -> None:
        self._api_key: Optional[str] = self._resolve_api_key()
        self._gemini_model = self._configure_gemini(self._api_key)
        self._image_model = self._configure_image_model(self._api_key)
        self.client: Optional[genai.Client] = None
        self._image_model_id = "gemini-2.5-flash-image"
        self._text_model_id = "gemini-2.5-flash"
        self._image_ready: bool = False
        if self._api_key:
                    logger.info("GOOGLE_API_KEY detected (len=%d, prefix=%s****)",
                                len(self._api_key), self._api_key[:4])
        else:
            logger.warning("GOOGLE_API_KEY missing at startup")

        self._image_ready = self._configure_image_model(self._api_key)
        logger.info("Gemini image client ready: %s", self._image_ready)

    def continue_onboarding(self, conversation: List[Dict[str, str]], user: Dict[str, str]) -> str:
        """Generate the assistant's next onboarding message."""

        topics_state = self._topics_state(conversation)

        if self._gemini_model:
            prompt = self._build_onboarding_prompt(conversation, user, topics_state)
            ai_reply = self._call_gemini(prompt)
            if ai_reply:
                return ai_reply

        # Heuristic fallback keeps the experience running without an API key.
        return self._fallback_onboarding_question(conversation, topics_state)

    def check_in(self, conversation: List[Dict[str, str]], user: Dict[str, str]) -> str:
        """Generate a friendly check-in reply for returning users."""

        if self._gemini_model:
            prompt = self._build_check_in_prompt(conversation, user)
            ai_reply = self._call_gemini(prompt)
            if ai_reply:
                return ai_reply

        return self._fallback_check_in(conversation, user)

    def interpret_health_log(self, log_entry: Dict[str, Any]) -> Optional[Dict[str, Any]]:
        """Interpret a progress log into structured health insights."""

        if not log_entry:
            return None

        timestamp = self._coerce_timestamp(log_entry.get("timestamp")) or datetime.now(timezone.utc)

        if self._gemini_model:
            prompt = self._build_health_prompt(log_entry, timestamp)
            raw = self._call_gemini(prompt)
            parsed = self._parse_health_response(raw)
            if parsed:
                return parsed

        return self._heuristic_health(log_entry, timestamp)

    def extract_activity_from_metadata(self, metadata: Dict[str, Any]) -> Optional[Dict[str, Optional[float]]]:
        """Extract sleep hours and workout minutes from wearable metadata."""

        if not metadata or not self._gemini_model:
            return None

        try:
            metadata_json = json.dumps(metadata)
        except Exception:
            return None

        prompt = (
            "You are a health data analyst. Given structured metadata from a progress log, "
            "extract total sleep hours (float) and workout duration minutes (int). "
            "Respond with strict JSON using keys: sleep_hours (float or null) and workout_minutes (int or null). "
            "Return null when a value is missing or cannot be inferred.\n\n"
            f"Metadata JSON: {metadata_json}\n"
            "JSON:"
        )

        raw = self._call_gemini(prompt)
        if not raw:
            return None

        try:
            cleaned = self._strip_code_fences(raw)
            data = json.loads(cleaned)
        except Exception:
            return None

        if not isinstance(data, dict):
            return None

        sleep_hours = data.get("sleep_hours")
        workout_minutes = data.get("workout_minutes")

        try:
            sleep_hours_val: Optional[float] = float(sleep_hours) if sleep_hours is not None else None
        except (TypeError, ValueError):
            sleep_hours_val = None

        try:
            workout_minutes_val: Optional[int] = (
                int(round(float(workout_minutes))) if workout_minutes is not None else None
            )
        except (TypeError, ValueError):
            workout_minutes_val = None

        if workout_minutes_val is not None and workout_minutes_val < 0:
            workout_minutes_val = 0

        return {"sleep_hours": sleep_hours_val, "workout_minutes": workout_minutes_val}

    def estimate_meal_calories(self, meal_text: str) -> Optional[Dict[str, Any]]:
        """Estimate nutrition details for a meal description using Gemini."""

        if not meal_text or not self._gemini_model:
            return None

        prompt = (
            "You are a nutrition estimator. Given a free-text meal description, "
            "estimate total calories and macro grams. Respond ONLY valid JSON with keys: "
            'calories (int), protein_g (int), carbs_g (int), fat_g (int), confidence (0-1 float), notes (short string). '
            "Assume common US servings; be conservative when uncertain.\n\n"
            f"Meal: {meal_text}\n"
            "JSON:"
        )

        raw = self._call_gemini(prompt)
        if not raw:
            return None

        try:
            cleaned = self._strip_code_fences(raw)
            data = json.loads(cleaned)
            if not isinstance(data, dict) or "calories" not in data:
                return None
            for key in ("calories", "protein_g", "carbs_g", "fat_g"):
                if key in data:
                    try:
                        data[key] = int(round(float(data[key])))
                    except Exception:
                        data[key] = None
            if "confidence" in data:
                try:
                    data["confidence"] = float(data["confidence"])
                except Exception:
                    data["confidence"] = None
            return data
        except Exception:
            return None

    def generate_plan(self, conversation: List[Dict[str, str]], user: Dict[str, str]) -> Dict[str, Dict[str, str]]:
        """Return a personalized plan summary based on the conversation."""

        if self._gemini_model:
            prompt = self._build_plan_prompt(conversation, user)
            raw_plan = self._call_gemini(prompt)
            structured_plan = self._parse_plan_response(raw_plan)
            if structured_plan:
                return structured_plan

        summary = self._summarize_conversation(conversation)
        today = datetime.now(timezone.utc).strftime('%B %d, %Y')

        plan = {
            'overview': {
                'generated_on': today,
                'focus': summary,
            },
            'workout': {
                'weekly_split': self._build_workout_split(summary),
                'sample_session': self._sample_session(summary),
            },
            'nutrition': {
                'daily_structure': self._build_nutrition(summary),
                'hydration': 'Aim for at least 2.5L of water daily with electrolytes on training days.',
            },
            'habits': {
                'morning': '5-minute mobility + mindful breathing before breakfast.',
                'evening': 'Screen-free wind-down 45 minutes before bed with journaling prompts.',
                'weekly': 'Weekly reflection on wins, challenges, and adjustments every Sunday evening.',
            },
        }
        return plan

    def regenerate_plan(
        self,
        plan: Dict[str, Dict[str, str]],
        logs: List[Dict[str, Any]],
        conversation: List[Dict[str, str]],
        user: Dict[str, str],
    ) -> Dict[str, Dict[str, str]]:
        """Produce an updated plan by layering in a short retrospective summary."""

        if not plan:
            return self.generate_plan(conversation, user)

        if self._gemini_model:
            prompt = self._build_replan_prompt(plan, logs, conversation, user)
            raw_plan = self._call_gemini(prompt)
            structured_plan = self._parse_plan_response(raw_plan)
            if structured_plan:
                return structured_plan

        # Fallback for when Gemini is unavailable
        consistency_score = self._calculate_consistency(logs)
        adjustments = (
            "Consistency has been {score}. We'll fine-tune intensity and recovery."
        ).format(score=consistency_score)

        updated_plan = {**plan, 'overview': {**plan.get('overview', {})}}
        updated_plan['overview']['latest_review'] = adjustments
        return updated_plan

    def generate_visualization(self, image_path: Path, context: Mapping[str, Any]) -> Optional[bytes]:
        """
        Text+image -> image. Uses client.models.generate_content(model=..., contents=[...]).
        """
        if not isinstance(context, (dict, _MappingABC)):
            logger.error("Invalid visualization context type: %r", type(context))
            return self._safe_fallback(image_path)
        
        prompt: str = self._build_visualization_prompt(dict(context))  # build the context string
        if not isinstance(prompt, str) or not prompt:
            logger.error("Built prompt is not a non-empty string")
            return self._safe_fallback(image_path)
        
        if not self.client:
            logger.warning("Gemini client not configured")
            return self._safe_fallback(image_path)
        
        # Store original image URL in context before generating the new one
        if 'original_url' not in context:
            context['original_url'] = f"/user-images/{image_path.parent.name}/{image_path.name}"

        try:  # pragma: no cover - external API
            # Read image bytes and wrap as a Part with mime type.
            mime = self._guess_mime_type(image_path)  # implement or reuse your helper
            image_bytes = image_path.read_bytes()
        except OSError as e:
            logger.warning("Failed reading image: %s", e)
            return None
        
        image_part = types.Part.from_bytes(data=image_bytes, mime_type=mime)
        
        try:
            response = self.client.models.generate_content(
                model=self._image_model_id,
                contents=[prompt, image_part],
            )
        except Exception as exc:
            logger.warning("Gemini image generation failed (request): %s", exc)
            return self._safe_fallback(image_path)

            # Extract first inline image
        try:    
            for cand in (getattr(response, "candidates", None) or []):
                content = getattr(cand, "content", None)
                parts = getattr(content, "parts", []) if content else []
                for part in parts:
                    inline = getattr(part, "inline_data", None)
                    data = getattr(inline, "data", None) if inline else None
                    if data:
                        if isinstance(data, (bytes, bytearray)):
                            return bytes(data)
                        try:
                            return base64.b64decode(data)  # base64 string case
                        except Exception:
                            pass
        except Exception as exc:
            logger.warning("Gemini image generation failed (parse): %s", exc)

        return self._safe_fallback(image_path)

    def _safe_fallback(self, image_path: Path) -> Optional[bytes]:
        """Why: Guarantees a result path even if generation fails."""
        try:
            return image_path.read_bytes()
        except OSError:
            return None
        
    # --- Helper methods -------------------------------------------------

    def _resolve_api_key(self) -> Optional[str]:
        api_key = self._get_env_value(*self._ENV_KEY_PRIORITY)
        if not api_key:
            logger.info('Gemini API key not found in environment; using fallback prompts.')
        return api_key

    def _configure_gemini(self, api_key: Optional[str]) -> Optional[Any]:
        if not api_key:
            return False
        try:
            self.client = genai.Client(api_key=api_key)
            return self.client
        except Exception as exc:  # pragma: no cover - defensive logging
            logger.warning('Gemini integration disabled: %s', exc)
            self.client = None
            return None

    def _configure_image_model(self, api_key: Optional[str]) -> bool:
        """
        Initialize the Client for the Gemini Developer API.
        Why: In the google-genai SDK, inference goes through client.models.generate_content(...).
        """
        if not api_key:
            return False
        try:
            self.client = genai.Client(api_key=api_key)
            return True
        except Exception as exc:  # pragma: no cover - external SDK
            logger.warning("Gemini client init failed: %s", exc)
            self.client = None
            return False

    @staticmethod
    def _get_env_value(*names: str) -> Optional[str]:
        for name in names:
            value = os.getenv(name)
            if value:
                return value
        return None

    def _build_visualization_prompt(self, context: Dict[str, Any]) -> str:
        """
        Build a single-string prompt for image generation from the given context.
        Ensures we pass only a str to the SDK (no dicts/lists).
        """
        goal = str(context.get("goal_type", "a healthy and energised appearance")).strip() or "a healthy and energised appearance"
        intensity = str(context.get("intensity", "moderate")).strip() or "moderate"
        timeline = str(context.get("timeline", "six months")).strip() or "six months"

        profile = context.get("profile") or {}
        if not isinstance(profile, dict):
            profile = {}

        keys = ("age", "gender", "height", "weight")
        bits = []
        for k in keys:
            v = profile.get(k)
            if v is None:
                continue
            s = str(v).strip()
            if s:
                bits.append(f"{k.replace('_', ' ')} {s}")
        profile_text = ", ".join(bits) if bits else "overall wellbeing"

        lines = [
            "Analyze the provided image of a person.",
            "Create a hyper-realistic, encouraging future version of this person showing off every inch of their body.",
            "Output must be a high-quality PNG image and nothing else.",
            f"Goal: {goal}.",
            f"Transformation intensity: {intensity}.",
            f"Timeline: {timeline}.",
            (
                "Keep proportions natural, honor the individual's facial features and characteristics "
                f"({profile_text}), and express vitality."
            ),
        ]
        return " ".join(lines).strip()

    def _guess_mime_type(self, path: Path) -> str:
        return "image/png" if path.suffix.lower() == ".png" else "image/jpeg"


    def _topics_state(self, conversation: List[Dict[str, str]]) -> Dict[str, List[str]]:
        transcript = ' '.join((message.get('content') or '').lower() for message in conversation)
        covered = []
        for topic in self._TOPIC_SEQUENCE:
            keywords = self._TOPIC_KEYWORDS.get(topic, [])
            if any(keyword in transcript for keyword in keywords):
                covered.append(topic)

        remaining = [topic for topic in self._TOPIC_SEQUENCE if topic not in covered]
        return {'covered': covered, 'remaining': remaining}

    def _fallback_onboarding_question(
        self,
        conversation: List[Dict[str, str]],
        topics_state: Dict[str, List[str]],
    ) -> str:
        remaining = topics_state['remaining']
        if remaining:
            topic = remaining[0]
            question = self._FALLBACK_TOPIC_QUESTIONS.get(topic)
            if not question:
                question = (
                    "Tell me a bit more about your wellbeing so I can tailor your plan. "
                    "What should I understand about that area?"
                )
            if not conversation:
                return (
                    "Hi there! I'm FitVision, your AI health companion. "
                    f"{question}"
                )
            return question

        if not conversation:
            return (
                "Hi there! I'm your health and welleness coach. I'd love to understand "
                "your wellness picture—what's one goal you'd like us to work toward together?"
            )

        return (
            "Thanks for sharing. Is there anything else you'd like me to know? Check out the Plan page to see how we can get to work!"
        )

    def _build_onboarding_prompt(
        self,
        conversation: List[Dict[str, str]],
        user: Dict[str, str],
        topics_state: Dict[str, List[str]],
    ) -> str:
        summary = self._summarize_conversation(conversation)
        user_name = user.get('name') or 'the user'

        remaining_topics = topics_state['remaining']
        covered_topics = topics_state['covered'] or ['none yet']

        wellbeing_dimensions = (
            "Core wellbeing dimensions to weave into the intake: mental resilience and stress coping,"
            " sleep quality and recovery, daily movement and incidental activity, purposeful exercise"
            " or training, nutrition and hydration habits, social connection/support, energy levels,"
            " anthropometrics (age, height, weight, gender identity), injury and medical history,"
            " time/schedule constraints, and motivation/accountability needs."
        )

        if remaining_topics:
            next_topic = remaining_topics[0]
            topics_guidance = (
                f"Topics already covered: {', '.join(covered_topics)}.\n"
                f"Immediate focus: {next_topic}.\n"
                "Blend casual, direct conversation with coaching expertise: briefly reflect the user's"
                " previous message and ask an open question that uncovers specifics (numbers, intensity, frequency,"
                " obstacles, desired changes) plus any related context from the wellbeing dimensions."
            )
        else:
            topics_guidance = (
                "All priority pillars have been discussed. Offer a concise reflection summarising"
                " the user's overall picture (strengths, friction points, aspirations) and invite"
                " them to add any final context about readiness, boundaries, medical notes, or support"
                " they want before the plan is drafted. End with guidance to checkout your Plan page and click the replan button."
            )

        return (
            "You are a professional health and wellness coach, and the user’s friend. Every"
            "response should feel like a casual, honest, direct chat with someone who genuinely cares about their wins,"
            "setbacks, and goals. Favor short, concise, terse 1-3 sentence responses unless asked for more detail."

            "Core vibe:"
            "  - extremely casual, direct, and conversational. Use everyday language that feels like a friend helping them out."
            "  - Be concise: favor tight messages. Get right to the point, add just enough detail to make it useful"
            "  - Recognize and celebrate progress, push the user to continue without sounding scripted or formal."
            "  - Bring expert-level health and wellness knowledge. Give practical, actionable"
            " suggestions rooted in sound guidance."
            "  - Be collaborative and hard on the user to put pressure on them to hit their goals."
            " Don't be afraid to push them, think of it as helping them be more resiliant in the future."

            "Conversation style:"
            "  - Use first-person (“I”) and second-person (“you”) to build rapport."
            "  - Keep answers honest—no toxic positivity or empty cheerleading."
            "  - When giving steps or plans, outline them clearly (e.g., short numbered lists or bullet"
            " points)."
            "  - End with a nudge, question, or next step to keep the dialogue going, unless"
            " all the topics have been covered and the user has signaled they have no more to update."
            " Then, guide the user to checkout the Plan page."

            "General constraints:"
            "  - No lengthy essays, emoji's, lectures, or formal tone."
            "  - No misinformation."
            "  - Always tailor advice to the user’s context, goals, and preferences mentioned in the "
            " conversation."

            "Your mission: help the user reach their goals and get healthier with concise expert wellness"
            "guidance—just like a trusted friend who happens to be a health and wellness expert.\n"
            f"User name: {user_name}.\n"
            "Conversation summary so far:\n"
            f"{summary}\n"
            f"{wellbeing_dimensions}\n"
            f"{topics_guidance}\n"
            "Provide the next assistant reply to continue the intake."
        )

    def _build_check_in_prompt(
        self, conversation: List[Dict[str, str]], user: Dict[str, str]
    ) -> str:
        transcript = self._format_conversation(conversation)
        summary = self._summarize_conversation(conversation)
        user_name = user.get('name') or 'friend'

        tone = (
            "You are an expert health and wellness coach, and the user’s friend. Every"
            " response should feel like a casual chat with someone who genuinely cares about their wins,"
            " and goals. Don't be afraid to poke fun at them or give them a hard time to keep them accountable."
            " Favor short, concise, terse 1-2 sentence responses unless asked for more detail."
        )
        vibe = (
            "Tone and style:\n"
            "  - Keep things extremely casual, direct, and authentic—think text from a friend.\n"
            "  - Celebrate wins, push the user to continue, share new insights or habits the user could explore, and offer concrete, immediately usable tip or reflection.\n"
            "  - Avoid creating structured plans or long lists unless explicitly asked.\n"
            "  - Favor short, concise, terse 1-2 sentence responses unless asked for more detail."
            "  - Keep answers honest—no toxic positivity or empty cheerleading."
        )
        guardrails = (
            "Constraints:\n"
            "  - Stay within health and wellness coaching guidance.\n"
            "  - Reply as a single message.\n"
            "  - No lengthy essays, emoji's, lectures, or formal tone.\n"
            "  - No misinformation.\n"
            "  - Do not mention being an AI model or referencing prompts."
        )

        return (
            f"{tone}\n"
            f"{vibe}\n"
            f"{guardrails}\n"
            f"User name: {user_name}.\n"
            "Conversation summary so far:\n"
            f"{summary}\n"
            "Full conversation transcript:\n"
            f"{transcript}\n"
            "Craft the next assistant reply following the tone and constraints."
        )

    def _fallback_check_in(
        self, conversation: List[Dict[str, str]], user: Dict[str, str]
    ) -> str:
        friendly_name = (user.get('name') or 'friend').split()[0]
        latest_user_note = ''
        for message in reversed(conversation):
            if message.get('role') == 'user':
                latest_user_note = (message.get('content') or '').strip()
                if latest_user_note:
                    break

        if latest_user_note:
            return (
                f"Hey {friendly_name}! I love hearing how things are going. "
                f"Thanks for sharing: {latest_user_note}. "
                "Keep leaning into the habits that feel good, and let me know if you want to tweak anything this week."
            )

        return (
            f"Hey {friendly_name}! Checking in—how are you feeling today? "
            "Share one win and one thing you'd like a little support with, and we'll map out the next move together."
        )

    def _build_plan_prompt(
        self, conversation: List[Dict[str, str]], user: Dict[str, str]
    ) -> str:
        transcript = self._format_conversation(conversation)
        summary = self._summarize_conversation(conversation)
        user_name = user.get('name') or 'the user'
        today = datetime.now(timezone.utc).strftime('%B %d, %Y')

        schema = (
            '{\n'
            '  "overview": {\n'
            '    "generated_on": "Month DD, YYYY",\n'
            '    "focus": "short focus summary"\n'
            '  },\n'
            '  "workout": {\n'
            '    "weekly_split": "weekly training split",\n'
            '    "sample_session": "sample workout session"\n'
            '  },\n'
            '  "nutrition": {\n'
            '    "daily_structure": "daily nutrition structure",\n'
            '    "hydration": "hydration guidance"\n'
            '  },\n'
            '  "habits": {\n'
            '    "morning": "morning habit",\n'
            '    "evening": "evening habit",\n'
            '    "weekly": "weekly reflection habit"\n'
            '  }\n'
            '}'
        )

        return (
            "You are a professional health and wellness companion who crafts detailed yet "
            "approachable and concise wellness plans. Based on the onboarding transcript "
            "create a custom personalised plan for the user.\n"
            f"User name: {user_name}.\n"
            f"Today's date: {today}.\n"
            f"Conversation summary: {summary}.\n"
            "Conversation transcript:\n"
            f"{transcript}\n"
            "Return only valid JSON (no Markdown formatting) following this schema:\n"
            f"{schema}\n"
            "Keep each value to 1-3 sentences tailored to the user's goals."
        )

    def _build_replan_prompt(
        self,
        current_plan: Dict[str, Dict[str, str]],
        logs: List[Dict[str, Any]],
        conversation: List[Dict[str, str]],
        user: Dict[str, str],
    ) -> str:
        """Build a prompt to regenerate a plan based on new logs and original context."""
        onboarding_transcript = self._format_conversation(conversation)
        log_summary = self._format_logs(logs)
        user_name = user.get('name') or 'the user'
        today = datetime.now(timezone.utc).strftime('%B %d, %Y')
        schema = self._get_plan_schema()

        return (
            "You are a professional health and wellness coach who adapts a user's wellness plan based on their progress. "
            "You will be given their original onboarding conversation, their current plan, and their recent progress logs. "
            "Your task is to generate a *new, updated* plan that acknowledges their progress and adjusts for challenges.\n\n"
            f"User name: {user_name}.\n"
            f"Today's date: {today}.\n\n"
            "--- Original Onboarding Context ---\n"
            f"{onboarding_transcript}\n\n"
            "--- Current Plan ---\n"
            f"{json.dumps(current_plan, indent=2)}\n\n"
            "--- Recent Progress Logs ---\n"
            f"{log_summary}\n\n"
            "--- Your Task ---\n"
            "1. Analyze the logs to identify successes (e.g., consistent workouts) and challenges (e.g., poor sleep).\n"
            "2. Reflect these insights in the 'focus' of the new plan's overview.\n"
            "3. Adjust the workout, nutrition, or habits sections to better support the user. For example, if sleep is a "
            "   challenge, suggest a more robust evening habit. If workouts are consistent, suggest a progression.\n"
            "4. Return ONLY a valid JSON object for the new plan, strictly following this schema:\n"
            f"{schema}"
        )

    def _parse_plan_response(self, raw: str) -> Optional[Dict[str, Dict[str, str]]]:
        if not raw:
            return None

        cleaned = self._strip_code_fences(raw)

        data: Optional[Dict[str, Any]]
        try:
            parsed = json.loads(cleaned)
            data = parsed if isinstance(parsed, dict) else None
        except json.JSONDecodeError:
            data = self._extract_json_fragment(cleaned)

        if not data:
            return None

        plan = {
            'overview': self._coerce_section(data.get('overview')),
            'workout': self._coerce_section(data.get('workout')),
            'nutrition': self._coerce_section(data.get('nutrition')),
            'habits': self._coerce_section(data.get('habits')),
        }

        if any(section for section in plan.values()):
            if 'generated_on' not in plan['overview']:
                plan['overview']['generated_on'] = datetime.now(timezone.utc).strftime('%B %d, %Y')
            return plan
        return None

    def _get_plan_schema(self) -> str:
        """Returns the JSON schema for the wellness plan."""
        return (
            '{\n'
            '  "overview": {\n'
            '    "generated_on": "Month DD, YYYY",\n'
            '    "focus": "short focus summary"\n'
            '  },\n'
            '  "workout": {\n'
            '    "weekly_split": "weekly training split",\n'
            '    "sample_session": "sample workout session"\n'
            '  },\n'
            '  "nutrition": {\n'
            '    "daily_structure": "daily nutrition structure",\n'
            '    "hydration": "hydration guidance"\n'
            '  },\n'
            '  "habits": {\n'
            '    "morning": "morning habit",\n'
            '    "evening": "evening habit",\n'
            '    "weekly": "weekly reflection habit"\n'
            '  }\n'
            '}'
        )

    def _extract_json_fragment(self, text: str) -> Optional[Dict[str, Any]]:
        start = text.find('{')
        end = text.rfind('}')
        if start == -1 or end == -1 or end <= start:
            return None
        fragment = text[start : end + 1]
        try:
            parsed = json.loads(fragment)
            return parsed if isinstance(parsed, dict) else None
        except json.JSONDecodeError:
            return None

    def _strip_code_fences(self, raw: str) -> str:
        cleaned = raw.strip()
        if cleaned.startswith('```') and cleaned.endswith('```'):
            lines = [line for line in cleaned.splitlines() if not line.strip().startswith('```')]
            return '\n'.join(lines).strip()
        return cleaned

    def _build_health_prompt(self, log_entry: Dict[str, Any], timestamp: datetime) -> str:
        return (
            "You are a health data normalizer. Given a single progress log as JSON, "
            "return structured JSON for meals, sleep, and workout fields. Use UTC date of the provided timestamp as 'today'. "
            "Do not re-estimate calories or macros. Use null for unknowns. Strict JSON only.\n\n"
            f"Timestamp reference (UTC): {timestamp.isoformat()}\n"
            f"Log entry JSON: {json.dumps(log_entry)}\n"
            "Respond with keys meals, sleep, workout."
        )

    def _parse_health_response(self, raw: Optional[str]) -> Optional[Dict[str, Any]]:
        if not raw:
            return None
        try:
            cleaned = self._strip_code_fences(raw)
            data = json.loads(cleaned)
            return data if isinstance(data, dict) else None
        except Exception:
            return None

    def _coerce_timestamp(self, raw: Optional[str]) -> Optional[datetime]:
        if not raw:
            return None
        try:
            dt = datetime.fromisoformat(raw)
        except ValueError:
            return None
        if dt.tzinfo is None:
            dt = dt.replace(tzinfo=timezone.utc)
        return dt

    def _heuristic_health(self, log_entry: Dict[str, Any], timestamp: datetime) -> Dict[str, Any]:
        date_iso = timestamp.date().isoformat()
        meals_text = str(log_entry.get("meals", "") or "")
        sleep_text = str(log_entry.get("sleep", "") or "")
        workout_text = str(log_entry.get("workout", "") or "")

        meal_type = "unknown"
        lowered_meal = meals_text.lower()
        if any(word in lowered_meal for word in ["breakfast", "morning"]):
            meal_type = "breakfast"
        elif "lunch" in lowered_meal:
            meal_type = "lunch"
        elif "dinner" in lowered_meal or "supper" in lowered_meal:
            meal_type = "dinner"
        elif meals_text:
            meal_type = "snack"

        hours_slept = None
        match = re.search(r"(\d+(?:\.\d+)?)\s*(h|hours)", sleep_text.lower())
        if match:
            try:
                hours_slept = float(match.group(1))
            except Exception:
                hours_slept = None

        sleep_quality = "unknown"
        if any(word in sleep_text.lower() for word in ["great", "rested"]):
            sleep_quality = "great"
        elif "good" in sleep_text.lower():
            sleep_quality = "good"
        elif "okay" in sleep_text.lower() or "ok" in sleep_text.lower():
            sleep_quality = "okay"
        elif "bad" in sleep_text.lower() or "poor" in sleep_text.lower():
            sleep_quality = "poor"

        duration = None
        durations = re.findall(r"(\d+)\s*(?:min|minutes)", workout_text.lower())
        if durations:
            duration = sum(int(value) for value in durations)

        workout_type = "other"
        lower_workout = workout_text.lower()
        if any(word in lower_workout for word in ["run", "cardio", "cycling", "bike"]):
            workout_type = "cardio"
        elif any(word in lower_workout for word in ["lift", "strength", "weights"]):
            workout_type = "strength"
        elif workout_text:
            workout_type = "mixed"

        return {
            "meals": {
                "date_inferred": date_iso,
                "meal_type": meal_type,
            },
            "sleep": {
                "date_inferred": date_iso,
                "hours_slept": hours_slept,
                "quality": sleep_quality,
            },
            "workout": {
                "date_inferred": date_iso,
                "workout_type": workout_type,
                "duration_min": duration,
            },
        }

    def _coerce_section(self, section: Any) -> Dict[str, str]:
        if isinstance(section, dict):
            return {str(key): str(value) for key, value in section.items() if value is not None}
        if isinstance(section, list):
            joined = '\n'.join(str(item) for item in section if item)
            return {'items': joined} if joined else {}
        if section:
            return {'summary': str(section)}
        return {}

    def _call_gemini(self, prompt: str) -> str:
        if not self._gemini_model:
            return ''

        try:  # pragma: no cover - external service call
             response = self.client.models.generate_content(
                model=self._text_model_id,
                contents=[prompt],
            )
        except Exception as exc:  # pragma: no cover - defensive logging
            logger.warning('Gemini request failed: %s', exc)
            return ''

        if not response:
            return ''

        text = getattr(response, 'text', None)
        if text:
            return text.strip()

        candidates = getattr(response, 'candidates', None) or []
        for candidate in candidates:
            content = getattr(candidate, 'content', None)
            parts = getattr(content, 'parts', None) if content else None
            if not parts:
                continue
            assembled = ' '.join(getattr(part, 'text', '') for part in parts if getattr(part, 'text', ''))
            if assembled.strip():
                return assembled.strip()

        return ''

    def _format_conversation(self, conversation: List[Dict[str, str]]) -> str:
        lines = []
        for message in conversation:
            role = message.get('role', 'assistant')
            prefix = 'User' if role == 'user' else 'Assistant'
            content = (message.get('content') or '').strip()
            if content:
                lines.append(f"{prefix}: {content}")
        return '\n'.join(lines) if lines else 'No prior context provided.'

    def _format_logs(self, logs: List[Dict[str, Any]]) -> str:
        """Formats a list of log entries into a readable string."""
        if not logs:
            return "No progress has been logged yet."

        lines = ["User's recent check-ins:"]
        for log in logs[-7:]:  # Limit to the last 7 logs to keep the prompt concise
            ts = log.get('timestamp', 'N/A').split('T')[0]
            details = [f"{k}: {v}" for k, v in log.items() if k != 'timestamp' and v]
            if details:
                lines.append(f"- On {ts}: " + "; ".join(details))
        return "\n".join(lines)

    def _summarize_conversation(self, conversation: List[Dict[str, str]]) -> str:
        """Create a summary of the conversation, using Gemini if available."""
        if not conversation:
            return 'balanced health foundations with gentle progression'

        if self._gemini_model:
            transcript = self._format_conversation(conversation)
            prompt = (
                "Summarize the following conversation transcript from a health and wellness onboarding session. "
                "Focus on the user's goals, current habits, challenges, and any key personal details mentioned. "
                "The summary should be concise, coherent, direct, and under 200 words.\n\n"
                f"Transcript:\n{transcript}"
            )
            summary = self._call_gemini(prompt)
            if summary:
                return summary

        # Fallback to original heuristic if Gemini fails or is not configured
        user_highlights = [item['content'] for item in conversation if item['role'] == 'user']
        joined = ' '.join(user_highlights)
        return joined[-500:] if joined else 'holistic wellness focus'

    def _build_workout_split(self, summary: str) -> str:
        if 'strength' in summary.lower():
            return '4-day split: Upper / Lower / Mobility + Conditioning / Strength Skills'
        if 'yoga' in summary.lower():
            return '3-day flow: Vinyasa strength, Yin recovery, Mobility + Core'
        return '3-day balanced: Full body strength, Low-impact cardio, Active recovery walk + core'

    def _sample_session(self, summary: str) -> str:
        if 'home' in summary.lower():
            return 'Circuit: 3 rounds of air squats, incline push-ups, glute bridges, plank holds (40s on / 20s off).'
        return 'Gym-based: Warm-up row 5 min, supersets of goblet squats + rows, RDLs + presses, finisher bike sprints.'

    def _build_nutrition(self, summary: str) -> str:
        if 'vegetarian' in summary.lower():
            return 'Plate method with legumes, tofu, leafy greens, and omega-rich seeds.'
        return 'Prioritize lean protein each meal, colorful veggies twice daily, smart carbs timed around workouts.'

    def _calculate_consistency(self, logs) -> str:
        if not logs:
            return "building (let's establish routines)"
        recent = logs[-5:]
        workouts_logged = sum(1 for log in recent if log.get('workout'))
        if workouts_logged >= 4:
            return 'excellent (momentum is strong)'
        if workouts_logged >= 2:
            return "solid (let's double down on recovery)"
        return 'emerging (focus on habit triggers this week)'
