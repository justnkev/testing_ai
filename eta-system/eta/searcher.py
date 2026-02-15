"""Serper.dev search client — discovers SMBs by industry and geography."""

from __future__ import annotations

import logging
from typing import Any

import httpx

from .models import Lead, SearchFilters
from .utils import retry

logger = logging.getLogger(__name__)

SERPER_SEARCH_URL = "https://google.serper.dev/search"


class Searcher:
    """Wraps the Serper.dev Google Search API."""

    def __init__(self, api_key: str) -> None:
        self._api_key = api_key

    @retry(max_retries=3, backoff_factor=1.5)
    async def _search_page(self, query: str, page: int = 1) -> dict[str, Any]:
        """Execute a single paginated search request."""
        headers = {
            "X-API-KEY": self._api_key,
            "Content-Type": "application/json",
        }
        payload: dict[str, Any] = {"q": query, "page": page, "num": 10}
        async with httpx.AsyncClient(timeout=30) as client:
            resp = await client.post(SERPER_SEARCH_URL, json=payload, headers=headers)
            resp.raise_for_status()
            return resp.json()

    async def search(self, filters: SearchFilters) -> list[Lead]:
        """Run a search and return up to ``filters.top_n`` Lead stubs.

        If more than ``top_n`` results are available, only the first
        ``top_n`` are returned and a log message is emitted.
        """
        query = f"{filters.industry} companies in {filters.region}"
        if filters.min_revenue and filters.min_revenue.lower() != "unknown":
            query += f" revenue {filters.min_revenue}+"
        logger.info("Searching Serper: '%s' (top_n=%d)", query, filters.top_n)

        leads: list[Lead] = []
        page = 1

        while len(leads) < filters.top_n:
            data = await self._search_page(query, page=page)
            organic: list[dict[str, Any]] = data.get("organic", [])
            if not organic:
                logger.info("No more results at page %d", page)
                break

            for item in organic:
                if len(leads) >= filters.top_n:
                    break
                lead = Lead(
                    company_name=item.get("title", "Unknown"),
                    website=item.get("link"),
                    industry=filters.industry,
                    region=filters.region,
                    status="new",
                )
                leads.append(lead)

            page += 1

        logger.info(
            "Found %d leads. Returning top %d.",
            len(leads),
            filters.top_n,
        )
        return leads
