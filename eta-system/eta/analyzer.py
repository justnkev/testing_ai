"""Gemini-powered website analyser — summarises a company's value proposition."""

from __future__ import annotations

import logging

import httpx
from bs4 import BeautifulSoup
from google import genai

from .models import Lead
from .utils import retry

logger = logging.getLogger(__name__)

GEMINI_MODEL = "gemini-2.5-flash"


class Analyzer:
    """Fetches a company website and uses Gemini to summarise its value proposition."""

    def __init__(self, gemini_api_key: str) -> None:
        self._gemini = genai.Client(api_key=gemini_api_key)

    @staticmethod
    async def _fetch_page_text(url: str) -> str | None:
        """Download a webpage and return its visible text."""
        try:
            async with httpx.AsyncClient(timeout=20, follow_redirects=True) as client:
                resp = await client.get(url)
                resp.raise_for_status()
                soup = BeautifulSoup(resp.text, "html.parser")
                # Strip scripts/styles
                for tag in soup(["script", "style", "nav", "footer", "header"]):
                    tag.decompose()
                text = soup.get_text(separator="\n", strip=True)
                # Truncate to ~6 000 chars to stay within token budget
                return text[:6000]
        except Exception as exc:
            logger.warning("Could not fetch %s: %s", url, exc)
            return None

    @retry(max_retries=2, backoff_factor=1.0)
    async def _summarise(self, company_name: str, page_text: str) -> str:
        """Ask Gemini to summarise the company's value proposition."""
        prompt = (
            f"You are a business analyst. Given the following website text for "
            f"'{company_name}', provide a concise 2–3 sentence summary of their "
            f"core value proposition, services, and target market. "
            f"Be specific — mention real service names and industries.\n\n"
            f"--- WEBSITE TEXT ---\n{page_text}\n--- END ---"
        )
        response = self._gemini.models.generate_content(
            model=GEMINI_MODEL,
            contents=prompt,
        )
        return response.text.strip()

    async def analyze(self, lead: Lead) -> Lead:
        """Fetch the lead's website and generate a value-prop summary."""
        if not lead.website:
            logger.info("No website for '%s' — skipping analysis.", lead.company_name)
            return lead

        page_text = await self._fetch_page_text(lead.website)
        if not page_text:
            logger.info("Empty page text for '%s' — skipping analysis.", lead.company_name)
            return lead

        try:
            summary = await self._summarise(lead.company_name, page_text)
            lead.value_proposition = summary
            if lead.status not in ("manual_research_needed",):
                lead.status = "analyzed"
            logger.info("Analysed '%s': %s…", lead.company_name, summary[:80])
        except Exception as exc:
            logger.error("Analysis failed for '%s': %s", lead.company_name, exc)

        return lead
