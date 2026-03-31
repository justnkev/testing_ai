"""Supabase-backed persistence layer for ETA leads."""

from __future__ import annotations

import logging
from typing import Any

from supabase import Client, create_client

from .models import Lead

logger = logging.getLogger(__name__)

TABLE = "eta_leads"

# SQL executed via Supabase RPC or migration to bootstrap the table.
_CREATE_TABLE_SQL = """
CREATE TABLE IF NOT EXISTS eta_leads (
    id              BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    company_name    TEXT NOT NULL,
    website         TEXT,
    industry        TEXT,
    region          TEXT,
    contact_name    TEXT,
    contact_email   TEXT,
    contact_title   TEXT,
    revenue         DOUBLE PRECISION,
    ebitda          DOUBLE PRECISION,
    sde             DOUBLE PRECISION,
    profit          DOUBLE PRECISION,
    employees       INTEGER,
    for_sale        BOOLEAN DEFAULT FALSE,
    value_proposition TEXT,
    email_draft     TEXT,
    status          TEXT DEFAULT 'new',
    created_at      TIMESTAMPTZ DEFAULT now(),
    updated_at      TIMESTAMPTZ DEFAULT now(),
    UNIQUE(company_name, website)
);
"""


class Database:
    """Thin wrapper around Supabase for lead persistence."""

    def __init__(self, supabase_url: str, supabase_key: str) -> None:
        self._client: Client = create_client(supabase_url, supabase_key)
        logger.info("Supabase client initialised for %s", supabase_url)

    # ------------------------------------------------------------------
    # Bootstrap
    # ------------------------------------------------------------------
    def ensure_table(self) -> None:
        """Create the eta_leads table if it doesn't exist (via raw SQL RPC)."""
        try:
            self._client.rpc("exec_sql", {"query": _CREATE_TABLE_SQL}).execute()
            logger.info("Table '%s' verified / created.", TABLE)
        except Exception:
            logger.warning(
                "Could not auto-create table via RPC. "
                "Please run the migration manually in Supabase SQL Editor:\n%s",
                _CREATE_TABLE_SQL,
            )

    # ------------------------------------------------------------------
    # CRUD
    # ------------------------------------------------------------------
    def lead_exists(self, company_name: str, website: str | None) -> bool:
        """Return True if a lead with this (company_name, website) already exists."""
        query = self._client.table(TABLE).select("id").eq("company_name", company_name)
        if website:
            query = query.eq("website", website)
        result = query.execute()
        return len(result.data) > 0

    def upsert_lead(self, lead: Lead) -> dict[str, Any]:
        """Insert or update a lead (on conflict: company_name + website)."""
        data = lead.model_dump(exclude_none=False)
        result = (
            self._client.table(TABLE)
            .upsert(data, on_conflict="company_name,website")
            .execute()
        )
        logger.debug("Upserted lead: %s", lead.company_name)
        return result.data[0] if result.data else {}

    def get_all_leads(self) -> list[dict[str, Any]]:
        """Return every lead row."""
        result = self._client.table(TABLE).select("*").execute()
        return result.data

    def get_filter_bounds(self) -> dict[str, float | int]:
        """Return max values used to configure numeric UI sliders."""
        rows = (
            self._client.table(TABLE)
            .select("revenue,employees,sde")
            .execute()
            .data
        )
        revenues = [row["revenue"] for row in rows if row.get("revenue") is not None]
        employees = [row["employees"] for row in rows if row.get("employees") is not None]
        sde_values = [row["sde"] for row in rows if row.get("sde") is not None]
        return {
            "max_revenue": int(max(revenues, default=0)),
            "max_employees": int(max(employees, default=0)),
            "max_sde": int(max(sde_values, default=0)),
        }

    def fetch_leads(
        self,
        min_rev: float | None = None,
        max_rev: float | None = None,
        min_emp: int | None = None,
        max_emp: int | None = None,
        min_sde: float | None = None,
        max_sde: float | None = None,
        include_unknown_revenue: bool = False,
        include_unknown_employees: bool = False,
        include_unknown_sde: bool = True,
    ) -> list[dict[str, Any]]:
        """Fetch leads with optional numeric filters.

        Uses SQL-equivalent range semantics (BETWEEN) and optional OR IS NULL handling.
        """
        query = self._client.table(TABLE).select("*")

        if min_rev is not None and max_rev is not None:
            if include_unknown_revenue:
                query = query.or_(
                    f"revenue.is.null,and(revenue.gte.{min_rev},revenue.lte.{max_rev})"
                )
            else:
                query = query.gte("revenue", min_rev).lte("revenue", max_rev)

        if min_emp is not None and max_emp is not None:
            if include_unknown_employees:
                query = query.or_(
                    f"employees.is.null,and(employees.gte.{min_emp},employees.lte.{max_emp})"
                )
            else:
                query = query.gte("employees", min_emp).lte("employees", max_emp)

        if min_sde is not None and max_sde is not None:
            if include_unknown_sde:
                query = query.or_(f"sde.is.null,and(sde.gte.{min_sde},sde.lte.{max_sde})")
            else:
                query = query.gte("sde", min_sde).lte("sde", max_sde)

        result = query.execute()
        return result.data

    def update_lead(self, company_name: str, website: str | None, updates: dict[str, Any]) -> None:
        """Patch specific fields on an existing lead."""
        query = self._client.table(TABLE).update(updates).eq("company_name", company_name)
        if website:
            query = query.eq("website", website)
        query.execute()
        logger.debug("Updated lead %s with %s", company_name, list(updates.keys()))
