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

    def generate_check_in_reply(
        self,
        conversation: List[Dict[str, str]],
        user: Dict[str, str],
        logs_since_last: List[Dict[str, Any]],
        last_session: Optional[datetime],
    ) -> str:
        """Return the next adaptive coaching response for returning users."""

        wellness_summary = self._summarize_wellness_logs(logs_since_last)

        if self._gemini_model:
            prompt = self._build_check_in_prompt(
                conversation,
                user,
                logs_since_last,
                wellness_summary,
                last_session,
            )
            ai_reply = self._call_gemini(prompt)
            if ai_reply:
                return ai_reply

        return self._fallback_check_in_response(
            conversation,
            user,
            wellness_summary,
            last_session,
        )

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
                'weekly': 'Sunday reflection: celebrate wins, log challenges, and set micro-goals.',
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

        keys = ("age", "gender", "height", "weight", "body_type")
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
            "Create a hyper-realistic, encouraging future version of this person.",
            "Output must be a high-quality PNG image and nothing else.",
            f"Goal: {goal}.",
            f"Transformation intensity: {intensity}.",
            f"Timeline: {timeline}.",
            (
                "Keep proportions natural, honor the individual's facial features and characteristics "
                f"({profile_text}), and express vitality without unrealistic alterations."
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
                "Hi there! I'm FitVision, your AI health companion. I'd love to understand "
                "your wellness picture—what's one goal you'd like us to work toward together?"
            )

        return (
            "Thanks for sharing so much. Is there anything else about your goals or support "
            "system you'd like me to understand before I build your plan?"
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
                "Blend motivational interviewing with coaching expertise: briefly reflect the user's"
                " previous message, surface one insight that ties their goals to the focus area, and"
                " ask an open question that uncovers specifics (numbers, intensity, frequency,"
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
            "You are a professional health and wellness coach, and the user’s close friend. Every"
            "response should feel like a casual chat with someone who genuinely cares about their wins,"
            "setbacks, and goals."

            "Core vibe:"
            "  - Warm, casual, and conversational. Open with natural greetings (“Hey! What’s up?”) and"
            " use everyday language that feels like a close friend cheering them on."
            "  - Be concise: favor tight paragraphs or short lists. Deliver the key point quickly,"
            " then add just enough detail to make it useful."
            "  - Always be supportive and empathetic. Recognize their feelings, celebrate progress,"
            " and offer encouragement without sounding scripted or formal."
            "  - Bring expert-level health and wellness knowledge. Give practical, actionable"
            " suggestions rooted in sound guidance. Explain the “why” in simple terms when it helps."
            "  - Stay collaborative. Ask questions that invite reflection and make it clear you’re in" 
            " their corner (“Want to try that together?”)."
            "  - Maintain psychological safety. Avoid judgment, keep confidentiality, and never push"
            " extreme behaviors. If you’re unsure or something is outside your scope, acknowledge"
            " it and suggest consulting a qualified professional."

            "Conversation style:"
            "  - Use first-person (“I”) and second-person (“you”) to build rapport."
            "  - Mirror the user’s energy while staying positive and motivating."
            "  - Keep answers upbeat but honest—no toxic positivity or empty cheerleading."
            "  - When giving steps or plans, outline them clearly (e.g., short numbered lists or bullet"
            " points)."
            "  - End with a friendly nudge, question, or next step to keep the dialogue going, unless"
            " all the topics have been covered and the user has signaled they have no more to update."
            " Then, guide the user to the replan page."

            "General constraints:"
            "  - No lengthy essays, lectures, or formal tone."
            "  - No medical diagnoses, prescriptions, or misinformation."
            "  - Always tailor advice to the user’s context, goals, and preferences mentioned in the "
            " conversation."

            "Your mission: help the user feel seen, supported, and equipped with concise expert wellness"
            "guidance—just like a trusted friend who happens to know their stuff.\n"
            f"User name: {user_name}.\n"
            "Conversation summary so far:\n"
            f"{summary}\n"
            f"{wellbeing_dimensions}\n"
            f"{topics_guidance}\n"
            "Provide the next assistant reply to continue the intake."
        )

    def _build_check_in_prompt(
        self,
        conversation: List[Dict[str, str]],
        user: Dict[str, str],
        logs: List[Dict[str, Any]],
        wellness_summary: Dict[str, Any],
        last_session: Optional[datetime],
    ) -> str:
        transcript = self._format_conversation(conversation)
        user_name = user.get('name') or 'the user'
        last_session_text = (
            last_session.astimezone(timezone.utc).strftime('%B %d, %Y at %H:%M %Z')
            if isinstance(last_session, datetime)
            else 'No previous session recorded'
        )

        highlight_lines = self._format_wellness_highlights(wellness_summary)
        highlights = '\n'.join(f"- {line}" for line in highlight_lines) if highlight_lines else '- No new logs were captured.'
        logs_text = self._format_logs(logs)

        return (
            "You are FitVision's returning-user health coach. The user has completed onboarding and is"
            " coming back for an adaptive check-in."
            "\nTone: upbeat, casual, encouraging, and concise—like a trusted friend who happens to be a coach."
            " Always acknowledge their progress, reference the latest data provided, and ask an open-ended"
            " follow-up question that keeps the conversation collaborative."
            "\nDo not repeat onboarding questions. Focus on supporting their ongoing habits and adjustments."
            "\nUser name: {user_name}."
            "\nLast recorded session: {last_session_text}."
            "\nRecent wellness highlights:\n{highlights}\n"
            "Recent log details:\n{logs_text}\n"
            "Conversation transcript so far:\n{transcript}\n"
            "Produce the next assistant reply that references at least one highlight when available and"
            " ends with an inviting question or suggested next step."
        ).format(
            user_name=user_name,
            last_session_text=last_session_text,
            highlights=highlights,
            logs_text=logs_text,
            transcript=transcript,
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

    def _summarize_wellness_logs(self, logs: List[Dict[str, Any]]) -> Dict[str, Any]:
        summary: Dict[str, Any] = {
            'count': len(logs),
            'workouts': 0,
            'meals': 0,
            'habits': 0,
            'sleep_samples': [],
            'latest_log': None,
            'recent_notes': [],
        }

        latest_ts: Optional[datetime] = None

        for entry in logs:
            timestamp = entry.get('timestamp')
            entry_dt = self._parse_timestamp(timestamp)
            if entry_dt and (latest_ts is None or entry_dt > latest_ts):
                latest_ts = entry_dt

            workout = entry.get('workout')
            if workout:
                summary['workouts'] += 1
                summary['recent_notes'].append(f"Workout: {workout}")

            meals = entry.get('meals')
            if meals:
                summary['meals'] += 1
                summary['recent_notes'].append(f"Meals: {meals}")

            habits = entry.get('habits')
            if habits:
                summary['habits'] += 1
                summary['recent_notes'].append(f"Habits: {habits}")

            sleep_value = entry.get('sleep')
            if sleep_value:
                numbers = re.findall(r"\d+(?:\.\d+)?", str(sleep_value))
                if numbers:
                    try:
                        summary['sleep_samples'].append(float(numbers[0]))
                    except ValueError:
                        continue

        summary['latest_log'] = latest_ts
        if summary['sleep_samples']:
            average = sum(summary['sleep_samples']) / len(summary['sleep_samples'])
            summary['sleep_average'] = round(average, 1)
        else:
            summary['sleep_average'] = None

        return summary

    def _format_wellness_highlights(self, summary: Dict[str, Any]) -> List[str]:
        parts: List[str] = []

        workouts = summary.get('workouts', 0)
        meals = summary.get('meals', 0)
        habits = summary.get('habits', 0)
        sleep_average = summary.get('sleep_average')

        if workouts:
            suffix = 's' if workouts != 1 else ''
            parts.append(f"{workouts} workout{suffix} logged")
        if meals:
            suffix = 's' if meals != 1 else ''
            parts.append(f"nutrition check-ins on {meals} day{suffix}")
        if sleep_average:
            parts.append(f"about {sleep_average} hours of sleep per night")
        if habits:
            suffix = 's' if habits != 1 else ''
            parts.append(f"habit wins noted {habits} time{suffix}")

        if not parts and summary.get('count'):
            parts.append('A few reflections were logged without detailed metrics.')

        return parts

    def _fallback_check_in_response(
        self,
        conversation: List[Dict[str, str]],
        user: Dict[str, str],
        summary: Dict[str, Any],
        last_session: Optional[datetime],
    ) -> str:
        name = (user.get('name') or '').strip()
        first_name = name.split()[0] if name else 'friend'

        last_session_phrase = self._format_last_session_phrase(last_session)
        highlight_sentence = self._compose_highlight_sentence(summary, last_session)

        if not conversation or conversation[-1].get('role') != 'user':
            greeting = f"Hey {first_name}! Welcome back"
            if last_session_phrase:
                greeting += f" — we last caught up {last_session_phrase}."
            else:
                greeting += '!'

            if highlight_sentence:
                body = f" {highlight_sentence}"
            elif summary.get('count'):
                body = " I saw a couple of notes roll in, so let's unpack what stands out."
            else:
                body = " I haven't seen new logs yet, so tell me how things have felt lately."

            return (
                greeting
                + body
                + " What's feeling like the biggest win or friction point that we should focus on together?"
            )

        user_message = (conversation[-1].get('content') or '').strip()
        acknowledgement = "Thanks for sharing"
        if user_message:
            acknowledgement += f" that, {first_name}."
        else:
            acknowledgement += ", let's keep things rolling."

        if highlight_sentence:
            context = f" {highlight_sentence}"
        elif summary.get('count'):
            context = " I'm seeing a few notes in the logs, so we can use those as a starting point."
        else:
            context = " I'm not spotting new data yet, so your real-time update is clutch."

        next_step = " What adjustment or support would make the next few days feel smoother?"
        return acknowledgement + context + next_step

    def _compose_highlight_sentence(
        self, summary: Dict[str, Any], last_session: Optional[datetime]
    ) -> str:
        parts = self._format_wellness_highlights(summary)
        if not parts:
            return ''

        if len(parts) == 1:
            highlight_body = parts[0]
        else:
            highlight_body = ', '.join(parts[:-1]) + f", and {parts[-1]}"

        timeframe = self._format_last_session_phrase(last_session)
        if timeframe:
            return f"Since we last connected {timeframe}, I noticed {highlight_body}."
        return f"I noticed {highlight_body} in your latest logs."

    @staticmethod
    def _format_last_session_phrase(last_session: Optional[datetime]) -> str:
        if not isinstance(last_session, datetime):
            return ''

        try:
            normalized = last_session.astimezone(timezone.utc)
        except ValueError:
            normalized = last_session

        day = normalized.strftime('%A')
        date = normalized.strftime('%B %d').replace(' 0', ' ')
        return f'on {day} ({date})'

    @staticmethod
    def _parse_timestamp(value: Optional[str]) -> Optional[datetime]:
        if not value:
            return None
        try:
            normalized = value.replace('Z', '+00:00') if isinstance(value, str) else value
            return datetime.fromisoformat(normalized)
        except (TypeError, ValueError):
            return None

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
