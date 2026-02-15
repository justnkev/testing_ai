"""ETA System — Streamlit Dashboard.

A professional dark-mode UI for the ETA discovery pipeline.
Run: ``streamlit run ui.py``
"""

from __future__ import annotations

import asyncio
import io
import json
import os
import logging
from pathlib import Path

import pandas as pd
import streamlit as st
from dotenv import load_dotenv

# ── Bootstrap env ────────────────────────────────────────────────────
for env_path in [Path(".env"), Path("../.env")]:
    if env_path.exists():
        load_dotenv(env_path)
        break

from eta.analyzer import Analyzer
from eta.database import Database
from eta.drafter import DraftingEngine
from eta.enricher import Enricher
from eta.models import Lead, SearchFilters
from eta.searcher import Searcher
from eta.utils import setup_logging

setup_logging()
logger = logging.getLogger("eta.ui")

# ── Page Config ──────────────────────────────────────────────────────
st.set_page_config(
    page_title="ETA Discovery Engine",
    page_icon="🔍",
    layout="wide",
    initial_sidebar_state="expanded",
)

# ── Custom CSS ───────────────────────────────────────────────────────
st.markdown("""
<style>
    /* Top-level metric cards */
    div[data-testid="stMetric"] {
        background: linear-gradient(135deg, #1A1D29 0%, #252836 100%);
        border: 1px solid #2D3142;
        border-radius: 12px;
        padding: 16px 20px;
        box-shadow: 0 4px 12px rgba(0,0,0,0.3);
    }
    div[data-testid="stMetric"] label {
        color: #9CA3AF !important;
        font-size: 0.85rem;
        text-transform: uppercase;
        letter-spacing: 0.05em;
    }
    div[data-testid="stMetric"] [data-testid="stMetricValue"] {
        font-size: 2rem;
        font-weight: 700;
        color: #FAFAFA;
    }

    /* Sidebar polish */
    section[data-testid="stSidebar"] {
        background: #0E1117;
        border-right: 1px solid #1E2130;
    }
    section[data-testid="stSidebar"] h1 {
        font-size: 1.3rem;
        letter-spacing: 0.02em;
    }

    /* Table styles */
    .stDataFrame { border-radius: 8px; overflow: hidden; }

    /* Button */
    .stButton > button {
        width: 100%;
        border-radius: 8px;
        font-weight: 600;
        padding: 0.6rem 1rem;
        transition: all 0.2s ease;
    }
    .stButton > button:hover {
        transform: translateY(-1px);
        box-shadow: 0 4px 16px rgba(108, 99, 255, 0.3);
    }

    /* Expander */
    .streamlit-expanderHeader { font-weight: 600; }

    /* Status badges */
    .status-enriched { color: #34D399; font-weight: 600; }
    .status-manual { color: #FBBF24; font-weight: 600; }
    .status-new { color: #60A5FA; font-weight: 600; }
    .status-drafted { color: #A78BFA; font-weight: 600; }
</style>
""", unsafe_allow_html=True)


# ═══════════════════════════════════════════════════════════════════════
# ENV VALIDATION
# ═══════════════════════════════════════════════════════════════════════
REQUIRED_KEYS = ["GEMINI_API_KEY", "SERPER_API_KEY", "APOLLO_API_KEY", "SUPABASE_URL", "SUPABASE_SERVICE_ROLE_KEY"]


def _check_env() -> list[str]:
    """Return list of missing required env vars."""
    return [k for k in REQUIRED_KEYS if not os.getenv(k)]


missing = _check_env()
if missing:
    st.warning(
        f"⚠️ **Missing environment variables:** `{'`, `'.join(missing)}`. "
        "Please set them in your `.env` file and restart.",
        icon="🔑",
    )


# ═══════════════════════════════════════════════════════════════════════
# DATABASE HELPERS
# ═══════════════════════════════════════════════════════════════════════
def _get_db() -> Database:
    return Database(
        supabase_url=os.getenv("SUPABASE_URL", ""),
        supabase_key=os.getenv("SUPABASE_SERVICE_ROLE_KEY", ""),
    )


@st.cache_data(ttl=30, show_spinner=False)
def fetch_leads() -> pd.DataFrame:
    """Fetch all leads from Supabase, cached for 30 seconds."""
    try:
        db = _get_db()
        rows = db.get_all_leads()
        if not rows:
            return pd.DataFrame()
        df = pd.DataFrame(rows)
        # Sort most recent first
        if "created_at" in df.columns:
            df = df.sort_values("created_at", ascending=False).reset_index(drop=True)
        return df
    except Exception as exc:
        logger.error("Failed to fetch leads: %s", exc)
        return pd.DataFrame()


# ═══════════════════════════════════════════════════════════════════════
# PIPELINE RUNNER
# ═══════════════════════════════════════════════════════════════════════
async def _run_pipeline_async(
    filters: SearchFilters,
    status_container,
) -> list[Lead]:
    """Execute the full pipeline with live status updates."""
    gemini_key = os.getenv("GEMINI_API_KEY", "")
    serper_key = os.getenv("SERPER_API_KEY", "")
    apollo_key = os.getenv("APOLLO_API_KEY", "")
    prospeo_key = os.getenv("PROSPEO_API_KEY")  # optional

    searcher = Searcher(api_key=serper_key)
    enricher = Enricher(apollo_key=apollo_key, gemini_key=gemini_key, prospeo_key=prospeo_key)
    analyzer = Analyzer(gemini_api_key=gemini_key)
    drafter = DraftingEngine(gemini_api_key=gemini_key)
    db = _get_db()

    # ── 1) Search ──
    status_container.update(label="🔍 Searching for companies...", state="running")
    leads = await searcher.search(filters)
    if not leads:
        status_container.update(label="No leads found", state="error")
        return []
    status_container.update(
        label=f"✅ Found {len(leads)} leads — enriching...", state="running"
    )

    # ── 2) Enrich ──
    for i, lead in enumerate(leads, 1):
        status_container.update(
            label=f"📊 Enriching lead {i}/{len(leads)}: {lead.company_name}",
            state="running",
        )
        leads[i - 1] = await enricher.enrich(lead)

    # ── 3) Analyse ──
    for i, lead in enumerate(leads, 1):
        status_container.update(
            label=f"🧠 Analysing lead {i}/{len(leads)}: {lead.company_name}",
            state="running",
        )
        leads[i - 1] = await analyzer.analyze(lead)

    # ── 4) Draft ──
    for i, lead in enumerate(leads, 1):
        status_container.update(
            label=f"✉️ Drafting email {i}/{len(leads)}: {lead.company_name}",
            state="running",
        )
        leads[i - 1] = await drafter.draft(lead)

    # ── 5) Save ──
    status_container.update(label="💾 Saving to Supabase...", state="running")
    for lead in leads:
        db.upsert_lead(lead)

    status_container.update(
        label=f"✅ Pipeline complete — {len(leads)} leads processed", state="complete"
    )
    return leads


def run_pipeline(filters: SearchFilters, status_container) -> list[Lead]:
    """Sync wrapper for the async pipeline."""
    return asyncio.run(_run_pipeline_async(filters, status_container))


# ═══════════════════════════════════════════════════════════════════════
# SIDEBAR
# ═══════════════════════════════════════════════════════════════════════
with st.sidebar:
    st.markdown("## 🔍 ETA Discovery Engine")
    st.markdown("---")

    st.markdown("### Search Filters")
    industry = st.text_input(
        "Industry",
        value="Landscaping",
        placeholder="e.g. HVAC, Plumbing, Roofing",
        help="The business vertical to search for.",
    )
    region = st.text_input(
        "Region",
        value="TX",
        placeholder="e.g. TX, North Carolina, FL",
        help="State abbreviation or full name.",
    )
    top_n = st.slider(
        "Limit (Top N)",
        min_value=1,
        max_value=50,
        value=5,
        help="Maximum number of leads to discover per run.",
    )

    st.markdown("---")
    st.markdown("### Export")
    export_format = st.toggle("JSON format", value=False, help="Toggle OFF for CSV, ON for JSON")

    st.markdown("---")

    start_clicked = st.button(
        "🚀 Start Discovery",
        type="primary",
        disabled=bool(missing),
        use_container_width=True,
    )

    # ── Pipeline runtime info ──
    st.markdown("---")
    st.caption("**How it works:**")
    st.caption(
        "1. Serper.dev searches Google\n"
        "2. Apollo enriches company data\n"
        "3. Gemini analyses websites\n"
        "4. Gemini drafts outreach emails\n"
        "5. Results saved to Supabase"
    )


# ═══════════════════════════════════════════════════════════════════════
# MAIN STAGE
# ═══════════════════════════════════════════════════════════════════════
st.markdown("# 📋 Lead Dashboard")

# ── Run pipeline if requested ────────────────────────────────────────
new_count = 0
if start_clicked and not missing:
    with st.status("Launching discovery pipeline...", expanded=True) as status:
        try:
            filters = SearchFilters(industry=industry, region=region, top_n=top_n)
            new_leads = run_pipeline(filters, status)
            new_count = len(new_leads)
            # Bust the cache so fresh data loads
            fetch_leads.clear()
        except Exception as exc:
            status.update(label=f"❌ Pipeline error: {exc}", state="error")
            logger.error("Pipeline failed: %s", exc)

# ── Load data ────────────────────────────────────────────────────────
df = fetch_leads()

# ── KPI Metrics Row ──────────────────────────────────────────────────
st.markdown("---")
col1, col2, col3, col4 = st.columns(4)

total_leads = len(df)
with_emails = (
    len(df[df["contact_email"].notna() & (df["contact_email"] != "Manual Research Needed")])
    if not df.empty and "contact_email" in df.columns
    else 0
)
enriched = (
    len(df[df["status"].isin(["enriched", "analyzed", "drafted"])])
    if not df.empty and "status" in df.columns
    else 0
)

col1.metric("Total Leads", total_leads)
col2.metric("With Emails", with_emails)
col3.metric("Enriched", enriched)
col4.metric("New This Session", new_count if start_clicked else "—")


# ── Lead Table ───────────────────────────────────────────────────────
st.markdown("---")
st.markdown("### 📊 All Leads")

if df.empty:
    st.info(
        "No leads in the database yet. Use the sidebar to configure your search "
        "and click **🚀 Start Discovery** to populate leads.",
        icon="📭",
    )
else:
    # Prepare display columns
    display_cols = [
        "company_name", "website", "industry", "region",
        "contact_name", "contact_email", "contact_title",
        "employees", "revenue", "status",
    ]
    available_cols = [c for c in display_cols if c in df.columns]
    display_df = df[available_cols].copy()

    # Format revenue as currency
    if "revenue" in display_df.columns:
        display_df["revenue"] = display_df["revenue"].apply(
            lambda x: f"${x:,.0f}" if pd.notna(x) else "—"
        )
    if "employees" in display_df.columns:
        display_df["employees"] = display_df["employees"].apply(
            lambda x: f"{int(x):,}" if pd.notna(x) else "—"
        )

    # Searchable filter
    search_query = st.text_input(
        "🔎 Filter leads",
        placeholder="Type to filter by company name, region, status...",
        label_visibility="collapsed",
    )
    if search_query:
        mask = display_df.apply(
            lambda row: search_query.lower() in " ".join(row.astype(str)).lower(),
            axis=1,
        )
        display_df = display_df[mask]

    st.dataframe(
        display_df,
        use_container_width=True,
        hide_index=True,
        height=min(400, 50 + len(display_df) * 35),
        column_config={
            "company_name": st.column_config.TextColumn("Company", width="medium"),
            "website": st.column_config.LinkColumn("Website", width="medium"),
            "industry": st.column_config.TextColumn("Industry", width="small"),
            "region": st.column_config.TextColumn("Region", width="small"),
            "contact_name": st.column_config.TextColumn("Contact", width="medium"),
            "contact_email": st.column_config.TextColumn("Email", width="medium"),
            "contact_title": st.column_config.TextColumn("Title", width="small"),
            "employees": st.column_config.TextColumn("Employees", width="small"),
            "revenue": st.column_config.TextColumn("Revenue", width="small"),
            "status": st.column_config.TextColumn("Status", width="small"),
        },
    )

    st.caption(f"Showing {len(display_df)} of {total_leads} leads")


# ═══════════════════════════════════════════════════════════════════════
# PROSPEO EMAIL LOOKUP (user-initiated)
# ═══════════════════════════════════════════════════════════════════════
if not df.empty and "contact_name" in df.columns and "contact_email" in df.columns:
    # Filter: leads that HAVE a name but are MISSING a real email
    needs_email = df[
        df["contact_name"].notna()
        & (df["contact_name"] != "Manual Research Needed")
        & (df["contact_name"] != "")
        & (
            df["contact_email"].isna()
            | (df["contact_email"] == "Manual Research Needed")
            | (df["contact_email"] == "")
        )
    ]

    if not needs_email.empty:
        st.markdown("---")
        st.markdown("### 🔎 Best Contact Discovery (Web + Prospeo)")

        prospeo_key = os.getenv("PROSPEO_API_KEY")
        serper_key = os.getenv("SERPER_API_KEY")
        
        if not prospeo_key or not serper_key:
            st.warning(
                "⚠️ **Missing Keys**: Ensure `PROSPEO_API_KEY` and `SERPER_API_KEY` are set in `.env`.",
                icon="🔑",
            )
        else:
            st.caption(
                "Find the **Owner/CEO** via Google Search and look up their email via Prospeo. "
                "**~1 credit per enriched lead**."
            )

            # Credit counter
            async def _fetch_credits():
                enricher = Enricher(
                    apollo_key=os.getenv("APOLLO_API_KEY", ""),
                    gemini_key=os.getenv("GEMINI_API_KEY", ""),
                    prospeo_key=prospeo_key,
                )
                return await enricher.get_prospeo_credits()

            credits = asyncio.run(_fetch_credits())
            if credits is not None:
                st.info(f"💳 **Prospeo credits remaining:** {credits}", icon="💳")

            # Multiselect for companies
            company_options = needs_email["company_name"].tolist()
            selected = st.multiselect(
                "Select companies to research",
                options=company_options,
                default=[],
                help="We will search for the Owner/CEO and then enrich them.",
            )

            if st.button(
                f"🚀 Find & Enrich Contacts ({len(selected)} selected)",
                disabled=len(selected) == 0,
                type="primary",
                use_container_width=True,
            ):
                async def _run_discovery(companies: list[str]):
                    enricher = Enricher(
                        apollo_key=os.getenv("APOLLO_API_KEY", ""),
                        gemini_key=os.getenv("GEMINI_API_KEY", ""),
                        prospeo_key=prospeo_key,
                    )
                    # We assume serper key is loaded from env in Enricher
                    
                    db = _get_db()
                    results = []
                    def _clean(val):
                        return val if pd.notna(val) else None

                    for company in companies:
                        # Reconstruct lead object from dataframe
                        row = needs_email[needs_email["company_name"] == company].iloc[0]
                        lead = Lead(
                            company_name=row.get("company_name", ""),
                            website=row.get("website", ""),
                            contact_name=_clean(row.get("contact_name")),
                            contact_email=_clean(row.get("contact_email")),
                            contact_title=_clean(row.get("contact_title")),
                            industry=_clean(row.get("industry")),
                            region=_clean(row.get("region")),
                            employees=_clean(row.get("employees")),
                            revenue=_clean(row.get("revenue")),
                            status=_clean(row.get("status")),
                        )
                        
                        # Step 1: Web Search for Best Contact
                        lead = await enricher.search_best_contact_via_web(lead)
                        
                        # Step 2: Prospeo Enrichment (if we found someone or fallback)
                        lead = await enricher.enrich_email_via_prospeo(lead)
                        
                        db.upsert_lead(lead)
                        results.append(lead)
                    return results

                with st.spinner(f"Researching & enriching {len(selected)} companies..."):
                    enriched_leads = asyncio.run(_run_discovery(selected))

                # Report results
                found = [l for l in enriched_leads if l.contact_email and l.contact_email != "Manual Research Needed"]
                if found:
                    msg = f"✅ Found emails for {len(found)}/{len(selected)} companies:\n"
                    for l in found:
                        msg += f"- **{l.company_name}**: {l.contact_name} ({l.contact_title}) → {l.contact_email}\n"
                    st.success(msg)
                else:
                    st.warning("No emails found for the selected companies.", icon="😔")

                # Bust cache and rerun to refresh table
                fetch_leads.clear()
                st.rerun()


# ── Email Previews ───────────────────────────────────────────────────
if not df.empty and "email_draft" in df.columns:
    st.markdown("---")
    st.markdown("### ✉️ Email Previews")

    leads_with_drafts = df[df["email_draft"].notna() & (df["email_draft"] != "")]
    if leads_with_drafts.empty:
        st.info("No email drafts generated yet.", icon="📝")
    else:
        for _, row in leads_with_drafts.iterrows():
            with st.expander(f"📧 {row.get('company_name', 'Unknown')} — {row.get('status', '')}"):
                st.markdown(row["email_draft"])

                # Copy-friendly text area
                st.text_area(
                    "Raw text (copy-friendly)",
                    value=row["email_draft"],
                    height=150,
                    key=f"email_{row.get('company_name', '')}_{row.get('website', '')}",
                    label_visibility="collapsed",
                )


# ── Download Section ─────────────────────────────────────────────────
if not df.empty:
    st.markdown("---")
    st.markdown("### ⬇️ Export Data")

    export_cols = [
        "company_name", "website", "industry", "region",
        "contact_name", "contact_email", "contact_title",
        "revenue", "ebitda", "sde", "profit", "employees",
        "for_sale", "value_proposition", "email_draft", "status",
    ]
    export_available = [c for c in export_cols if c in df.columns]
    export_df = df[export_available]

    col_dl1, col_dl2 = st.columns(2)

    # CSV download
    csv_data = export_df.to_csv(index=False, encoding="utf-8")
    col_dl1.download_button(
        label="📄 Download CSV",
        data=csv_data,
        file_name="eta_leads.csv",
        mime="text/csv",
        use_container_width=True,
    )

    # JSON download
    json_data = export_df.to_json(orient="records", indent=2)
    col_dl2.download_button(
        label="📋 Download JSON",
        data=json_data,
        file_name="eta_leads.json",
        mime="application/json",
        use_container_width=True,
    )


# ── Footer ───────────────────────────────────────────────────────────
st.markdown("---")
st.caption(
    "ETA Discovery Engine • Built for Search Fund Entrepreneurs • "
    "Powered by Serper.dev, Apollo.io, and Google Gemini"
)
