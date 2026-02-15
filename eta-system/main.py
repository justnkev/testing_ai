#!/usr/bin/env python3
"""ETA System — CLI entrypoint and async pipeline orchestrator.

Usage::

    python main.py --industry "Landscaping" --region "TX" --top-n 10
"""

from __future__ import annotations

import argparse
import asyncio
import logging
import os
import sys
from pathlib import Path

import pandas as pd
from dotenv import load_dotenv

from eta.analyzer import Analyzer
from eta.database import Database
from eta.drafter import DraftingEngine
from eta.enricher import Enricher
from eta.models import SearchFilters
from eta.searcher import Searcher
from eta.utils import setup_logging

logger = logging.getLogger("eta")


# ------------------------------------------------------------------
# CLI argument parser
# ------------------------------------------------------------------
def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(
        description="ETA System — SMB discovery engine for search-fund outreach.",
    )
    parser.add_argument("--industry", required=True, help="Industry vertical (e.g. 'HVAC')")
    parser.add_argument("--region", required=True, help="Geography (e.g. 'TX', 'North Carolina')")
    parser.add_argument("--top-n", type=int, default=20, help="Max results to process (default 20)")
    parser.add_argument("--min-revenue", default="Unknown", help="Minimum revenue hint (default 'Unknown')")
    parser.add_argument("--output", default="leads_output.csv", help="Output CSV path")
    return parser.parse_args()


# ------------------------------------------------------------------
# Environment helpers
# ------------------------------------------------------------------
def _require_env(name: str) -> str:
    val = os.getenv(name)
    if not val:
        logger.critical("Missing required environment variable: %s", name)
        sys.exit(1)
    return val


# ------------------------------------------------------------------
# Pipeline
# ------------------------------------------------------------------
async def run_pipeline(
    filters: SearchFilters,
    output_path: str,
) -> None:
    """Search → Enrich → Analyse → Draft → Save → Export."""

    # --- Initialise components ---
    gemini_key = _require_env("GEMINI_API_KEY")
    serper_key = _require_env("SERPER_API_KEY")
    apollo_key = _require_env("APOLLO_API_KEY")
    supabase_url = _require_env("SUPABASE_URL")
    supabase_key = _require_env("SUPABASE_SERVICE_ROLE_KEY")
    prospeo_key = os.getenv("PROSPEO_API_KEY")  # optional

    searcher = Searcher(api_key=serper_key)
    enricher = Enricher(apollo_key=apollo_key, gemini_key=gemini_key, prospeo_key=prospeo_key)
    analyzer = Analyzer(gemini_api_key=gemini_key)
    drafter = DraftingEngine(gemini_api_key=gemini_key)
    db = Database(supabase_url=supabase_url, supabase_key=supabase_key)

    db.ensure_table()

    # --- 1) Search ---
    logger.info("=" * 60)
    logger.info("STAGE 1 — SEARCH  (industry=%s, region=%s)", filters.industry, filters.region)
    logger.info("=" * 60)
    leads = await searcher.search(filters)
    logger.info("Discovered %d leads.", len(leads))

    if not leads:
        logger.warning("No leads found. Try broadening your search criteria.")
        return

    # --- 2) Enrich ---
    logger.info("=" * 60)
    logger.info("STAGE 2 — ENRICH  (%d leads)", len(leads))
    logger.info("=" * 60)
    for i, lead in enumerate(leads, 1):
        if db.lead_exists(lead.company_name, lead.website):
            logger.info("[%d/%d] '%s' already in DB — skipping enrichment.", i, len(leads), lead.company_name)
            continue
        leads[i - 1] = await enricher.enrich(lead)

    # --- 3) Analyse ---
    logger.info("=" * 60)
    logger.info("STAGE 3 — ANALYSE (%d leads)", len(leads))
    logger.info("=" * 60)
    for i, lead in enumerate(leads, 1):
        leads[i - 1] = await analyzer.analyze(lead)

    # --- 4) Draft ---
    logger.info("=" * 60)
    logger.info("STAGE 4 — DRAFT   (%d leads)", len(leads))
    logger.info("=" * 60)
    for i, lead in enumerate(leads, 1):
        leads[i - 1] = await drafter.draft(lead)

    # --- 5) Persist ---
    logger.info("=" * 60)
    logger.info("STAGE 5 — SAVE TO SUPABASE")
    logger.info("=" * 60)
    for lead in leads:
        db.upsert_lead(lead)
    logger.info("Upserted %d leads into Supabase.", len(leads))

    # --- 6) Export ---
    logger.info("=" * 60)
    logger.info("STAGE 6 — EXPORT CSV")
    logger.info("=" * 60)
    export_columns = [
        "company_name",
        "website",
        "contact_name",
        "contact_email",
        "contact_title",
        "revenue",
        "ebitda",
        "sde",
        "profit",
        "employees",
        "for_sale",
        "value_proposition",
        "email_draft",
        "status",
    ]
    rows = [lead.model_dump(include=set(export_columns)) for lead in leads]
    df = pd.DataFrame(rows, columns=export_columns)
    df.to_csv(output_path, index=False, encoding="utf-8")
    logger.info("Exported %d leads → %s", len(df), output_path)

    # --- Summary ---
    drafted = sum(1 for l in leads if l.status == "drafted")
    manual = sum(1 for l in leads if l.status == "manual_research_needed")
    logger.info("Pipeline complete: %d drafted, %d need manual research.", drafted, manual)


# ------------------------------------------------------------------
# Entrypoint
# ------------------------------------------------------------------
def main() -> None:
    # Load .env from project root or parent
    for env_path in [Path(".env"), Path("../.env")]:
        if env_path.exists():
            load_dotenv(env_path)
            break

    setup_logging()
    args = parse_args()

    filters = SearchFilters(
        industry=args.industry,
        region=args.region,
        top_n=args.top_n,
        min_revenue=args.min_revenue,
    )

    asyncio.run(run_pipeline(filters, args.output))


if __name__ == "__main__":
    main()
