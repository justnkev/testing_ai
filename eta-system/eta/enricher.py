"""Enrichment client — Apollo for org data, 3-tier Gemini contact discovery."""

from __future__ import annotations

import asyncio
import json
import logging
from typing import Any
from urllib.parse import urljoin, urlparse

import httpx
from google import genai
from google.genai import types

from .models import Lead
from .utils import retry

logger = logging.getLogger(__name__)

APOLLO_ORG_ENRICH_URL = "https://api.apollo.io/api/v1/organizations/enrich"
PROSPEO_ENRICH_URL = "https://api.prospeo.io/enrich-person"
PROSPEO_ACCOUNT_URL = "https://api.prospeo.io/account-information"
SERPER_SEARCH_URL = "https://google.serper.dev/search"

# Subpage paths most likely to contain leadership / contact info
CONTACT_PAGE_PATTERNS = [
    "about", "about-us", "our-team", "team", "leadership",
    "management", "staff", "people", "contact", "our-story",
    "founder", "owner", "who-we-are", "company",
]

# Realistic browser User-Agent to reduce 403 blocks
_UA = (
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) "
    "AppleWebKit/537.36 (KHTML, like Gecko) "
    "Chrome/124.0.0.0 Safari/537.36"
)

# Delay between Gemini calls to stay under 20 RPM free-tier limit
_GEMINI_DELAY_S = 3.5


class Enricher:
    """Enriches leads with org financials (Apollo) and contacts (Gemini).

    Contact discovery uses a 3-tier fallback:
      1. Multi-page website scrape → Gemini extraction
      2. Gemini with Google Search Grounding (web search)
      3. Flag as manual_research_needed
    """

    def __init__(self, apollo_key: str, gemini_key: str, prospeo_key: str | None = None) -> None:
        self._apollo_key = apollo_key
        self._apollo_headers = {
            "Content-Type": "application/json",
            "Cache-Control": "no-cache",
            "X-Api-Key": apollo_key,
        }
        self._gemini = genai.Client(api_key=gemini_key)
        self._gemini = genai.Client(api_key=gemini_key)
        self._prospeo_key = prospeo_key
        # Serper key from same env or explicit? Assuming env for now or passed in init?
        # Actually init signature didn't change, so I'll grab from env or use a passed key if I add it.
        # But for now I'll assume os.environ is available or I should add it to __init__.
        # Existing code uses os.environ for keys? No, it passes them in __init__.
        # I should add serper_key to __init__.
        self._serper_key = None

    @staticmethod
    def _extract_domain(url: str | None) -> str | None:
        """Pull a clean domain from a URL, e.g. 'acme.com'."""
        if not url:
            return None
        parsed = urlparse(url if url.startswith("http") else f"https://{url}")
        domain = parsed.netloc or parsed.path
        return domain.removeprefix("www.")

    # ------------------------------------------------------------------
    # Apollo: org-level data (free tier)
    # ------------------------------------------------------------------
    @retry(max_retries=3, backoff_factor=2.0)
    async def _enrich_org(self, domain: str) -> dict[str, Any]:
        """Enrich organization data (employee count, revenue, etc.)."""
        params = {"domain": domain}
        async with httpx.AsyncClient(timeout=30) as client:
            resp = await client.get(
                APOLLO_ORG_ENRICH_URL,
                params=params,
                headers=self._apollo_headers,
            )
            resp.raise_for_status()
            data = resp.json()
            return data.get("organization", {})

    # ------------------------------------------------------------------
    # Website fetching — multi-page crawl
    # ------------------------------------------------------------------
    async def _fetch_page_text(self, url: str) -> str:
        """Fetch a single webpage and return visible text."""
        async with httpx.AsyncClient(
            timeout=15,
            follow_redirects=True,
            verify=False,  # bypass Windows SSL cert issues
        ) as client:
            resp = await client.get(url, headers={"User-Agent": _UA})
            resp.raise_for_status()
            from bs4 import BeautifulSoup

            soup = BeautifulSoup(resp.text, "html.parser")
            for tag in soup(["script", "style", "nav", "footer", "header"]):
                tag.decompose()
            return soup.get_text(separator=" ", strip=True)

    async def _discover_contact_pages(self, base_url: str) -> list[str]:
        """Crawl the homepage and find links to about/team/contact pages."""
        try:
            async with httpx.AsyncClient(
                timeout=15,
                follow_redirects=True,
                verify=False,
            ) as client:
                resp = await client.get(base_url, headers={"User-Agent": _UA})
                resp.raise_for_status()

            from bs4 import BeautifulSoup

            soup = BeautifulSoup(resp.text, "html.parser")
            found: list[str] = []
            seen: set[str] = set()

            for anchor in soup.find_all("a", href=True):
                href = anchor["href"].lower().strip()
                # Build absolute URL
                abs_url = urljoin(base_url, anchor["href"])
                # Only keep same-domain links
                if urlparse(abs_url).netloc != urlparse(base_url).netloc:
                    continue
                # Check if path matches contact-related patterns
                for pattern in CONTACT_PAGE_PATTERNS:
                    if pattern in href and abs_url not in seen:
                        seen.add(abs_url)
                        found.append(abs_url)
                        logger.info("Found contact page: %s", abs_url)
                        break
                if len(found) >= 3:  # limit to 3 subpages
                    break

            return found
        except Exception as exc:
            logger.debug("Subpage discovery failed for %s: %s", base_url, exc)
            return []

    async def _fetch_multi_page_text(self, website: str) -> str:
        """Fetch homepage + up to 3 contact-related subpages, return combined text."""
        base_url = website if website.startswith("http") else f"https://{website}"

        # Fetch homepage
        try:
            homepage_text = await self._fetch_page_text(base_url)
        except Exception as exc:
            logger.warning("Homepage fetch failed for %s: %s", base_url, exc)
            homepage_text = ""

        # Discover and fetch subpages
        subpage_urls = await self._discover_contact_pages(base_url)
        subpage_texts: list[str] = []

        for url in subpage_urls:
            try:
                text = await self._fetch_page_text(url)
                if text and len(text) > 50:
                    subpage_texts.append(text)
                    logger.info("Fetched subpage (%d chars): %s", len(text), url)
            except Exception as exc:
                logger.debug("Subpage fetch failed for %s: %s", url, exc)

        combined = "\n\n".join(filter(None, [homepage_text] + subpage_texts))
        return combined

    # ------------------------------------------------------------------
    # Tier 1: Gemini extraction from scraped website text
    # ------------------------------------------------------------------
    async def _find_contact_via_gemini(self, lead: Lead, page_text: str) -> bool:
        """Use Gemini to extract CEO/Founder/Owner from website text.

        Returns True if a contact name was found.
        """
        prompt = (
            "You are a research assistant. From the following company website text, "
            "extract the CEO, Founder, Owner, or President's information.\n\n"
            "Return ONLY a JSON object with these keys (use null if not found):\n"
            '{"name": "...", "title": "...", "email": "..."}\n\n'
            f"Company: {lead.company_name}\n"
            f"Website text:\n{page_text[:6000]}"
        )
        try:
            await asyncio.sleep(_GEMINI_DELAY_S)  # rate limiter
            response = self._gemini.models.generate_content(
                model="gemini-2.5-flash",
                contents=prompt,
            )
            text = response.text.strip()
            # Handle markdown code blocks
            if text.startswith("```"):
                text = text.split("\n", 1)[1].rsplit("```", 1)[0].strip()
            data = json.loads(text)

            found = False
            if data.get("name"):
                lead.contact_name = data["name"]
                found = True
            if data.get("title"):
                lead.contact_title = data["title"]
            if data.get("email"):
                lead.contact_email = data["email"]

            logger.info(
                "Tier 1 (scrape) for '%s': name=%s, email=%s",
                lead.company_name, data.get("name"), data.get("email"),
            )
            return found
        except Exception as exc:
            logger.warning(
                "Tier 1 Gemini extraction failed for '%s': %s",
                lead.company_name, exc,
            )
            return False

    # ------------------------------------------------------------------
    # Tier 2: Gemini with Google Search Grounding
    # ------------------------------------------------------------------
    async def _find_contact_via_grounding(self, lead: Lead) -> bool:
        """Use Gemini + Google Search to find leadership info on the web.

        Returns True if a contact name was found.
        """
        query = (
            f"Who is the CEO, owner, founder, or president of {lead.company_name}? "
            f"Their website is {lead.website}. "
            "Search the web and return ONLY a JSON object with these keys "
            '(use null if not found): {"name": "...", "title": "...", "email": "..."}'
        )
        try:
            await asyncio.sleep(_GEMINI_DELAY_S)  # rate limiter
            logger.info("Tier 2 (grounding) search for '%s'...", lead.company_name)
            response = self._gemini.models.generate_content(
                model="gemini-2.5-flash",
                contents=query,
                config=types.GenerateContentConfig(
                    tools=[types.Tool(google_search=types.GoogleSearch())]
                ),
            )
            text = response.text.strip()
            # Handle markdown code blocks
            if text.startswith("```"):
                text = text.split("\n", 1)[1].rsplit("```", 1)[0].strip()
            data = json.loads(text)

            found = False
            if data.get("name"):
                lead.contact_name = data["name"]
                found = True
            if data.get("title"):
                lead.contact_title = data["title"]
            if data.get("email"):
                lead.contact_email = data["email"]

            # Log grounding sources if available
            if response.candidates and response.candidates[0].grounding_metadata:
                meta = response.candidates[0].grounding_metadata
                sources = [
                    c.web.title
                    for c in (meta.grounding_chunks or [])
                    if c.web
                ]
                logger.info(
                    "Tier 2 grounding for '%s': name=%s, sources=%s",
                    lead.company_name, data.get("name"), sources[:3],
                )
            else:
                logger.info(
                    "Tier 2 grounding for '%s': name=%s",
                    lead.company_name, data.get("name"),
                )

            return found
        except Exception as exc:
            logger.warning(
                "Tier 2 grounding failed for '%s': %s",
                lead.company_name, exc,
            )
            return False
        except Exception as exc:
            logger.warning(
                "Tier 2 grounding failed for '%s': %s",
                lead.company_name, exc,
            )
            return False

    # ------------------------------------------------------------------
    # Web Search (Serper) -> Ranking -> Selection
    # ------------------------------------------------------------------
    async def _search_serper(self, query: str) -> list[dict[str, Any]]:
        """Execute a Google Search via Serper.dev."""
        if not self._serper_key:
            import os
            self._serper_key = os.environ.get("SERPER_API_KEY")
            if not self._serper_key:
                logger.warning("No SERPER_API_KEY found.")
                return []

        try:
            async with httpx.AsyncClient(timeout=15) as client:
                resp = await client.post(
                    SERPER_SEARCH_URL,
                    json={"q": query, "num": 10},
                    headers={
                        "X-API-KEY": self._serper_key,
                        "Content-Type": "application/json",
                    },
                )
                resp.raise_for_status()
                data = resp.json()
                return data.get("organic", [])
        except Exception as exc:
            logger.warning("Serper search failed for query '%s': %s", query, exc)
            return []

    # Map common US state codes to full names for better matching
    US_STATES = {
        "AL": "Alabama", "AK": "Alaska", "AZ": "Arizona", "AR": "Arkansas", "CA": "California",
        "CO": "Colorado", "CT": "Connecticut", "DE": "Delaware", "FL": "Florida", "GA": "Georgia",
        "HI": "Hawaii", "ID": "Idaho", "IL": "Illinois", "IN": "Indiana", "IA": "Iowa",
        "KS": "Kansas", "KY": "Kentucky", "LA": "Louisiana", "ME": "Maine", "MD": "Maryland",
        "MA": "Massachusetts", "MI": "Michigan", "MN": "Minnesota", "MS": "Mississippi", "MO": "Missouri",
        "MT": "Montana", "NE": "Nebraska", "NV": "Nevada", "NH": "New Hampshire", "NJ": "New Jersey",
        "NM": "New Mexico", "NY": "New York", "NC": "North Carolina", "ND": "North Dakota", "OH": "Ohio",
        "OK": "Oklahoma", "OR": "Oregon", "PA": "Pennsylvania", "RI": "Rhode Island", "SC": "South Carolina",
        "SD": "South Dakota", "TN": "Tennessee", "TX": "Texas", "UT": "Utah", "VT": "Vermont",
        "VA": "Virginia", "WA": "Washington", "WV": "West Virginia", "WI": "Wisconsin", "WY": "Wyoming"
    }

    def _parse_serper_result(self, item: dict[str, Any], region: str = "") -> tuple[int, str, str, str | None]:
        """Rank a search result and extract (score, name, title, url).
        
        Score: Lower is better (1=Owner, 2=C-Level, etc). 99=Irrelevant.
        """
        title_text = item.get("title", "")
        snippet = item.get("snippet", "")
        link = item.get("link", "")
        full_text =f"{title_text} {snippet}".lower()

        # Normalize Link (force www.linkedin.com)
        if link and "//" in link:
            parts = link.split("//", 1)
            if "linkedin.com" in parts[1]:
                 # Replace subdomain (e.g. ie.linkedin.com -> www.linkedin.com)
                 link = "https://www.linkedin.com" + parts[1][parts[1].find("/"):]

        # Name Extraction heuristic
        name_candidate = title_text.split("-")[0].split("|")[0].strip()
        
        # Ranking Logic
        score = 99
        extracted_title = "Contact"

        # Tier 0: Region Match (Boost/Penalize)
        # Use simple word boundary check for state code and full name
        region_match = False
        if region:
            import re
            # Expand state code if possible
            state_full = self.US_STATES.get(region.upper(), region)
            
            # Check for " CT " or " Connecticut "
            # We escape region just in case, though usually simple text
            pattern_str = f"\\b({re.escape(region)}|{re.escape(state_full)})\\b"
            if re.search(pattern_str, full_text, re.IGNORECASE):
                region_match = True

        # Role Logic
        if any(x in full_text for x in ["owner", "founder", "proprietor", "principal", "managing director"]):
            score = 1
            extracted_title = "Owner"
            if "founder" in full_text: extracted_title = "Founder"
        elif any(x in full_text for x in ["ceo", "chief executive", "president"]):
            score = 2
            extracted_title = "CEO"
        elif any(x in full_text for x in ["cfo", "coo", "cto", "cmo"]):
            score = 3
            extracted_title = "Executive"
        elif any(x in full_text for x in ["vp", "vice president", "director"]):
            score = 4
            extracted_title = "Director"
        elif "manager" in full_text:
            score = 5
            extracted_title = "Manager"
        
        # Region Adjustments
        if region:
            if region_match:
                # Confirming local presence is good
                score -= 0.5 
            else:
                # If we asked for a region and it's NOT in the text, 
                # likelihood of it being a false positive (same company name, wrong place) is high.
                # Penalize significantly.
                score += 50

        return score, name_candidate, extracted_title, link

    async def search_best_contact_via_web(self, lead: Lead) -> Lead:
        """Find the best contact (Owner/CEO) via Google Search.
        
        Updates lead.contact_name, lead.contact_title, lead.linkedin_url.
        """
        company = lead.company_name
        
        # Build Query
        keywords = "Owner OR CEO OR Founder OR President OR Director"
        region_query = ""
        if lead.region:
            # Expand for query: Use Full Name (worked best in testing)
            state_full = self.US_STATES.get(lead.region.upper(), lead.region)
            region_query = f"{state_full}"
            query = f"site:linkedin.com/in \"{company}\" {region_query} {keywords}"
        else:
            query = f"site:linkedin.com/in \"{company}\" {keywords}"
        
        results = await self._search_serper(query)
        if not results:
            logger.info("No Serper results found for '%s'", company)
            return lead

        candidates = []
        for r in results:
            score, name, title, url = self._parse_serper_result(r, region=lead.region)
            if score < 90:
                candidates.append((score, name, title, url))
        
        # Sort by Score (ascending)
        candidates.sort(key=lambda x: x[0])

        if candidates:
            best = candidates[0]
            lead.contact_name = best[1]
            lead.contact_title = best[2]
            lead.linkedin_url = best[3]
            lead.status = "enriched" 
            logger.info(
                "Serper found best contact for '%s': %s (%s) - Rank %.1f",
                company, best[1], best[2], best[0]
            )
        else:
            logger.info("Serper found results but no leadership/location match for '%s'", company)

        return lead

    # ------------------------------------------------------------------
    # Tier 3: Prospeo — user-initiated email lookup
    # ------------------------------------------------------------------
    async def enrich_email_via_prospeo(self, lead: Lead) -> Lead:
        """Look up a verified email via Prospeo Enrich Person API.

        This is a standalone method meant to be called on-demand from the UI,
        NOT as part of the automatic pipeline, to conserve free-tier credits.
        """
        if not self._prospeo_key:
            logger.warning("Prospeo API key not configured — skipping.")
            return lead

        if not lead.contact_name or lead.contact_name == "Manual Research Needed":
            logger.warning("No contact name for '%s' — cannot query Prospeo.", lead.company_name)
            return lead

        domain = self._extract_domain(lead.website)
        
        # Always provide 'data' object as fallback/context
        payload: dict[str, Any] = {
            "data": {
                "full_name": lead.contact_name,
                "company_name": lead.company_name,
            }
        }
        if domain:
            payload["data"]["company_website"] = domain

        # If we have a specific LinkedIn URL (from Serper), use it as primary
        if lead.linkedin_url:
            payload["url"] = lead.linkedin_url
            logger.info("Enriching via LinkedIn URL: %s", lead.linkedin_url)

        try:
            async with httpx.AsyncClient(timeout=30) as client:
                resp = await client.post(
                    PROSPEO_ENRICH_URL,
                    json=payload,
                    headers={
                        "Content-Type": "application/json",
                        "X-KEY": self._prospeo_key,
                    },
                )

                # Prospeo returns 400 via "NO_MATCH" if no email is found
                if resp.status_code != 200:
                    logger.warning(
                        "Prospeo enrichment failed for '%s': %s - %s",
                        lead.company_name, resp.status_code, resp.text
                    )
                    # If allow NO_MATCH
                    try:
                        err_data = resp.json()
                        if err_data.get("error_code") == "NO_MATCH":
                            logger.info("Prospeo returned NO_MATCH for '%s'.", lead.company_name)
                            return lead
                    except Exception:
                        pass
                    
                    return lead # Return lead without email on error (don't crash)

                data = resp.json()

            person = data.get("response", {}).get("person", {}) or {}
            email = person.get("email")
            title = person.get("title")

            if email:
                lead.contact_email = email
                lead.status = "enriched"
                logger.info(
                    "Prospeo found email for '%s': %s",
                    lead.company_name, email,
                )
            else:
                logger.info("Prospeo returned no email for '%s'.", lead.company_name)

            if title and not lead.contact_title:
                lead.contact_title = title

        except Exception as exc:
            logger.warning("Prospeo enrichment failed for '%s': %s", lead.company_name, exc)

        return lead

    async def get_prospeo_credits(self) -> int | None:
        """Fetch remaining Prospeo credits from the Account Info API."""
        if not self._prospeo_key:
            return None
        try:
            async with httpx.AsyncClient(timeout=15) as client:
                resp = await client.get(
                    PROSPEO_ACCOUNT_URL,
                    headers={"X-KEY": self._prospeo_key},
                )
                resp.raise_for_status()
                data = resp.json()
            return data.get("response", {}).get("credits_remaining")
        except Exception as exc:
            logger.debug("Failed to fetch Prospeo credits: %s", exc)
            return None

    # ------------------------------------------------------------------
    # Main enrich pipeline
    # ------------------------------------------------------------------
    async def enrich(self, lead: Lead) -> Lead:
        """Enrich a lead with org data (Apollo) and contact info (3-tier Gemini).

        On failure the lead is flagged ``manual_research_needed`` (never crashes).
        """
        domain = self._extract_domain(lead.website)
        if not domain:
            logger.warning("No domain for '%s' — flagging for manual research.", lead.company_name)
            lead.contact_name = "Manual Research Needed"
            lead.contact_email = "Manual Research Needed"
            lead.status = "manual_research_needed"
            return lead

        # --- Apollo: org enrichment (financials) ---
        try:
            org = await self._enrich_org(domain)
            if org:
                lead.employees = org.get("estimated_num_employees")
                lead.company_name = org.get("name") or lead.company_name
                raw_rev = org.get("annual_revenue")
                if raw_rev is not None:
                    try:
                        lead.revenue = float(raw_rev)
                    except (ValueError, TypeError):
                        pass
                logger.info(
                    "Apollo org enriched '%s': %s employees, revenue=%s",
                    lead.company_name, lead.employees, lead.revenue,
                )
        except Exception as exc:
            logger.warning("Apollo org enrichment failed for '%s': %s", lead.company_name, exc)

        # --- Tier 1: Multi-page scrape → Gemini extraction ---
        contact_found = False
        try:
            if lead.website:
                page_text = await self._fetch_multi_page_text(lead.website)
                if page_text and len(page_text) > 50:
                    contact_found = await self._find_contact_via_gemini(lead, page_text)
        except Exception as exc:
            logger.warning("Tier 1 (website scrape) failed for '%s': %s", lead.company_name, exc)

        # --- Tier 2: Gemini Grounding (Google Search) fallback ---
        if not contact_found:
            try:
                contact_found = await self._find_contact_via_grounding(lead)
            except Exception as exc:
                logger.warning("Tier 2 (grounding) failed for '%s': %s", lead.company_name, exc)

        # --- Tier 3: Flag as manual_research_needed ---
        if lead.contact_email and lead.contact_email != "Manual Research Needed":
            lead.status = "enriched"
        else:
            lead.contact_name = lead.contact_name or "Manual Research Needed"
            lead.contact_email = lead.contact_email or "Manual Research Needed"
            lead.status = "manual_research_needed"

        return lead
