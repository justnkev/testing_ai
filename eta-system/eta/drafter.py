"""Gemini-powered email drafter — generates personalised search-fund outreach."""

from __future__ import annotations

import logging

from google import genai

from .models import Lead
from .utils import retry

logger = logging.getLogger(__name__)

GEMINI_MODEL = "gemini-2.5-flash"


class DraftingEngine:
    """Generates a cold-outreach email using the search-fund acquisition angle."""

    def __init__(self, gemini_api_key: str) -> None:
        self._gemini = genai.Client(api_key=gemini_api_key)

    @retry(max_retries=2, backoff_factor=1.0)
    async def _generate(self, lead: Lead) -> str:
        """Prompt Gemini to draft a personalised email."""
        financials_block = ""
        if any([lead.revenue, lead.ebitda, lead.sde, lead.profit, lead.employees]):
            parts: list[str] = []
            if lead.revenue is not None:
                parts.append(f"Revenue: ${lead.revenue:,.0f}")
            if lead.ebitda is not None:
                parts.append(f"EBITDA: ${lead.ebitda:,.0f}")
            if lead.sde is not None:
                parts.append(f"SDE: ${lead.sde:,.0f}")
            if lead.profit is not None:
                parts.append(f"Profit: ${lead.profit:,.0f}")
            if lead.employees is not None:
                parts.append(f"Employees: {lead.employees}")
            financials_block = (
                "\n\nKnown financial data about the company:\n" + "\n".join(parts)
            )

        vp = lead.value_proposition or "No website summary available."

        prompt = f"""You are an expert outreach copywriter for a Search Fund entrepreneur.

Write a personalised cold email to {lead.contact_name or 'the Founder'} at {lead.company_name}.

Context:
- The sender is an individual entrepreneur backed by a group of investors.
- They are looking to acquire and personally operate ONE small-to-medium business.
- The tone should be respectful, warm, and professionally personal — NOT salesy.
- Reference at least ONE specific detail from the Company Summary below.
- Mention the search-fund angle: honouring the owner's legacy, continuing the culture,
  and providing a smooth leadership transition.

Company Summary:
{vp}
{financials_block}

Rules:
1. Subject line first (prefix "Subject: ").
2. Keep the body under 200 words.
3. End with a soft ask for a 15-minute call.
4. Do NOT include placeholder brackets like [Name] — use real names/details.
"""
        response = self._gemini.models.generate_content(
            model=GEMINI_MODEL,
            contents=prompt,
        )
        return response.text.strip()

    async def draft(self, lead: Lead) -> Lead:
        """Generate an outreach email for the lead."""
        try:
            email_text = await self._generate(lead)
            lead.email_draft = email_text
            if lead.status not in ("manual_research_needed",):
                lead.status = "drafted"
            logger.info("Drafted email for '%s'.", lead.company_name)
        except Exception as exc:
            logger.error("Drafting failed for '%s': %s", lead.company_name, exc)
        return lead
