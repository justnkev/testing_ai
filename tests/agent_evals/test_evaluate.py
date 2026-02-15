"""
Agent Evaluation — pytest test suite.

Runs the Gemini-powered review logic against gold-standard test cases
and scores its ability to detect (or correctly ignore) known issues.

Usage:
    GEMINI_API_KEY=... python -m pytest tests/agent_evals/test_evaluate.py -v

Requires a live Gemini API key because it tests the full LLM pipeline.
For CI, the key is injected via GitHub Secrets.
"""

import os
import logging
import pytest
from unittest.mock import MagicMock

from google import genai
from google.genai import types

# Import the test cases and the reviewer's prompt engineering
from .test_cases import CASES

logger = logging.getLogger(__name__)

# ── Helpers ─────────────────────────────────────────────────────────────

REVIEW_SYSTEM_PROMPT = """\
You are a senior software engineer conducting a code review.
You will be given the diff of a Pull Request.  Analyze it and produce a
structured review.

Your review MUST cover:
1. Bugs & Logic Errors
2. Security Vulnerabilities
3. Performance Issues
4. Code Quality
5. Best Practices

For each issue found, include: File, Line, Severity (Critical/Warning/Info),
and Description with a suggested fix.
If the code looks good, say so briefly.
Be constructive, specific, and concise.  Do NOT invent issues.
"""


def _get_review_for_diff(diff_text: str) -> str:
    """Send a diff to Gemini and return the review text."""
    api_key = os.environ.get("GEMINI_API_KEY") or os.environ.get("GOOGLE_API_KEY")
    if not api_key:
        pytest.skip("GEMINI_API_KEY not set — skipping live evaluation.")

    client = genai.Client(api_key=api_key)
    response = client.models.generate_content(
        model="gemini-2.0-flash",
        contents=[
            types.Content(
                role="user",
                parts=[types.Part.from_text(text=f"Review this diff:\n```diff\n{diff_text}\n```")],
            ),
        ],
        config=types.GenerateContentConfig(
            system_instruction=REVIEW_SYSTEM_PROMPT,
        ),
    )
    return response.text or ""


def _check_flags(review: str, expected: list[str], forbidden: list[str]) -> tuple[list[str], list[str]]:
    """
    Check which expected keywords are present and which forbidden ones leaked.

    Returns:
        (missing_expected, found_forbidden)
    """
    review_lower = review.lower()

    missing = [
        kw for kw in expected
        if kw.lower() not in review_lower
    ]
    found_forbidden = [
        kw for kw in forbidden
        if kw.lower() in review_lower
    ]
    return missing, found_forbidden


# ── Parametrized tests ──────────────────────────────────────────────────

@pytest.mark.parametrize(
    "case",
    CASES,
    ids=[c["name"] for c in CASES],
)
def test_agent_review(case: dict) -> None:
    """
    For each test case, verify the agent's review contains expected keywords
    and does NOT contain forbidden keywords.
    """
    review = _get_review_for_diff(case["diff"])

    logger.info("=== Case: %s ===", case["name"])
    logger.info("Review:\n%s", review[:500])

    missing, found_forbidden = _check_flags(
        review,
        case["expected_flags"],
        case["forbidden_flags"],
    )

    errors = []
    if missing:
        errors.append(
            f"Agent MISSED expected flags: {missing}"
        )
    if found_forbidden:
        errors.append(
            f"Agent produced FORBIDDEN flags (false positives): {found_forbidden}"
        )

    if errors:
        # Provide the full review for debugging
        error_msg = "\n".join(errors) + f"\n\nFull review:\n{review}"
        pytest.fail(error_msg)
