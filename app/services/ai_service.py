from __future__ import annotations

import json
import logging
import os
from datetime import datetime
from typing import Any, Dict, List, Optional


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
        'stress': ['stress', 'stressed', 'burnout', 'anxiety'],
        'sleep': ['sleep', 'bedtime', 'insomnia', 'rest'],
        'activity': ['activity', 'active', 'movement', 'lifestyle'],
        'exercise': ['exercise', 'workout', 'training', 'fitness'],
        'diet': ['diet', 'nutrition', 'meal', 'food', 'eat'],
        'socialization': ['social', 'friends', 'community', 'family', 'support network'],
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
        self._api_key = self._resolve_api_key()
        self._gemini_model = self._configure_gemini(self._api_key)

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

    def generate_plan(self, conversation: List[Dict[str, str]], user: Dict[str, str]) -> Dict[str, Dict[str, str]]:
        """Return a personalized plan summary based on the conversation."""

        if self._gemini_model:
            prompt = self._build_plan_prompt(conversation, user)
            raw_plan = self._call_gemini(prompt)
            structured_plan = self._parse_plan_response(raw_plan)
            if structured_plan:
                return structured_plan

        summary = self._summarize_conversation(conversation)
        today = datetime.utcnow().strftime('%B %d, %Y')

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

    def regenerate_plan(self, plan: Dict[str, Dict[str, str]], logs, user: Dict[str, str]):
        """Produce an updated plan by layering in a short retrospective summary."""

        if not plan:
            return self.generate_plan([], user)

        consistency_score = self._calculate_consistency(logs)
        adjustments = (
            "Consistency has been {score}. We'll fine-tune intensity and recovery."
        ).format(score=consistency_score)

        updated_plan = dict(plan)
        updated_plan['overview'] = dict(plan.get('overview', {}))
        updated_plan['overview']['latest_review'] = adjustments
        return updated_plan

    # --- Helper methods -------------------------------------------------

    def _resolve_api_key(self) -> Optional[str]:
        api_key = self._get_env_value(*self._ENV_KEY_PRIORITY)
        if not api_key:
            logger.info('Gemini API key not found in environment; using fallback prompts.')
        return api_key

    def _configure_gemini(self, api_key: Optional[str]) -> Optional[Any]:
        if not api_key:
            return None

        try:  # pragma: no cover - depends on external SDK availability
            import google.generativeai as genai

            genai.configure(api_key=api_key)
            return genai.GenerativeModel('gemini-pro')
        except Exception as exc:  # pragma: no cover - defensive logging
            logger.warning('Gemini integration disabled: %s', exc)
            return None

    @staticmethod
    def _get_env_value(*names: str) -> Optional[str]:
        for name in names:
            value = os.getenv(name)
            if value:
                return value
        return None

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
        transcript = self._format_conversation(conversation)
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
                " they want before the plan is drafted. End with an open invitation question."
            )

        return (
            "You are FitVision, a compassionate AI health companion guiding a user "
            "through an onboarding conversation. Keep responses concise (2-3 "
            "sentences), encouraging, and end with a clear follow-up question.\n"
            f"User name: {user_name}.\n"
            "Conversation so far:\n"
            f"{transcript}\n"
            f"{wellbeing_dimensions}\n"
            f"{topics_guidance}\n"
            "Provide the next assistant reply to continue the intake."
        )

    def _build_plan_prompt(
        self, conversation: List[Dict[str, str]], user: Dict[str, str]
    ) -> str:
        transcript = self._format_conversation(conversation)
        summary = self._summarize_conversation(conversation)
        user_name = user.get('name') or 'the user'
        today = datetime.utcnow().strftime('%B %d, %Y')

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
            "You are FitVision, an AI health companion who crafts detailed yet "
            "approachable wellness plans. Based on the onboarding transcript "
            "create a personalised plan for the user.\n"
            f"User name: {user_name}.\n"
            f"Today's date: {today}.\n"
            f"Conversation summary: {summary}.\n"
            "Conversation transcript:\n"
            f"{transcript}\n"
            "Return only valid JSON (no Markdown formatting) following this schema:\n"
            f"{schema}\n"
            "Keep each value to 1-3 sentences tailored to the user's goals."
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
                plan['overview']['generated_on'] = datetime.utcnow().strftime('%B %d, %Y')
            return plan
        return None

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
            response = self._gemini_model.generate_content(prompt)
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

    def _summarize_conversation(self, conversation: List[Dict[str, str]]) -> str:
        if not conversation:
            return 'balanced health foundations with gentle progression'
        user_highlights = [item['content'] for item in conversation if item['role'] == 'user']
        joined = ' '.join(user_highlights)
        return joined[-280:] if joined else 'holistic wellness focus'

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
