"""Pydantic data models for the ETA System."""

from __future__ import annotations

from pydantic import BaseModel, Field


class SearchFilters(BaseModel):
    """User-supplied search criteria passed via CLI."""

    industry: str = Field(..., description="Industry vertical, e.g. 'HVAC'")
    region: str = Field(..., description="Geography, e.g. 'NC' or 'North Carolina'")
    top_n: int = Field(default=20, ge=1, description="Max results to process")
    min_revenue: str = Field(default="Unknown", description="Minimum revenue filter (advisory)")


class EnrichmentResult(BaseModel):
    """Contact info returned by the enrichment provider."""

    contact_name: str | None = None
    contact_email: str | None = None
    contact_title: str | None = None


class Lead(BaseModel):
    """A single discovered business and all associated data."""

    # Identity
    company_name: str
    website: str | None = None
    industry: str = ""
    region: str = ""

    # Contact
    contact_name: str | None = None
    contact_email: str | None = None
    contact_title: str | None = None
    linkedin_url: str | None = None

    # Financials
    revenue: float | None = Field(default=None, description="Annual revenue ($)")
    ebitda: float | None = Field(default=None, description="EBITDA ($)")
    sde: float | None = Field(default=None, description="Seller's Discretionary Earnings ($)")
    profit: float | None = Field(default=None, description="Net profit ($)")
    employees: int | None = Field(default=None, description="Total headcount")
    for_sale: bool = Field(default=False, description="Listed for sale?")

    # Enriched content
    value_proposition: str | None = None
    email_draft: str | None = None

    # Workflow
    status: str = Field(default="new", description="new | enriched | analyzed | drafted | manual_research_needed")
