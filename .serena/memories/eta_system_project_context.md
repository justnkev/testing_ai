# ETA System — Project Context

## What It Is
A Python CLI discovery engine for a **Search Fund** (Entrepreneurship Through Acquisition). Finds SMBs, enriches contacts, analyzes websites, and drafts personalized cold-outreach emails.

## Location
`c:\Users\Kevin Wong\Documents\GitHub\testing_ai\eta-system\`

## Architecture
```
main.py          → CLI entrypoint (argparse + asyncio pipeline)
eta/models.py    → Pydantic: Lead, SearchFilters, EnrichmentResult
eta/database.py  → Supabase CRUD (eta_leads table, upsert with dedup)
eta/searcher.py  → Serper.dev API (pagination, top-N)
eta/enricher.py  → Apollo.io (CEO/Founder lookup, org financials)
eta/analyzer.py  → Gemini 2.5 Flash (website value-prop summary)
eta/drafter.py   → Gemini 2.5 Flash (search-fund outreach email)
eta/utils.py     → Logging setup + @retry async decorator
```

## Key Tech Decisions
- **LLM**: Gemini 2.5 Flash (via `google-genai` SDK), NOT OpenAI
- **Database**: Supabase Postgres (NEW dedicated instance), NOT SQLite
- **Supabase instance**: `https://xsynxzlszezjiehmqivh.supabase.co`
- **Table**: `eta_leads` with UNIQUE(company_name, website)
- **Lead model includes**: revenue, ebitda, sde, profit, employees, for_sale (bool)
- **Env vars**: GEMINI_API_KEY, SERPER_API_KEY, APOLLO_API_KEY, SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY
- **.env** already created with Gemini key + new Supabase creds pre-filled

## Status (as of 2026-02-12)
- ✅ All 12 source files created and syntax-validated
- ✅ .env configured with new Supabase instance + Gemini key
- ⚠️ Migration accidentally applied to OLD Supabase instance (field-service-app's `skolvxmcritlzepnaogd`). Just an empty table, user may want it dropped.
- ❌ Migration NOT yet applied to NEW instance (`xsynxzlszezjiehmqivh`) — user needs to run CREATE TABLE SQL in SQL Editor
- ❌ SERPER_API_KEY and APOLLO_API_KEY still blank in .env — user needs to add these
- ❌ No end-to-end test run yet (needs live API keys)

## CLI Usage
```bash
cd eta-system
pip install -r requirements.txt
python main.py --industry "Landscaping" --region "TX" --top-n 5
```

## Pipeline Flow
Search (Serper) → Enrich (Apollo) → Analyze (Gemini) → Draft (Gemini) → Save (Supabase) → Export (CSV)
