# ETA System — Entrepreneurship Through Acquisition Discovery Engine

A modular Python CLI that **discovers SMBs**, **enriches contacts**, **analyses websites**, and **drafts personalised search-fund outreach emails**.

## Architecture

```
main.py   →  Searcher  →  Enricher  →  Analyzer  →  DraftingEngine  →  Supabase + CSV
(CLI)         Serper.dev    Apollo.io    Gemini 2.5    Gemini 2.5         Persistence
```

## Quick Start

```bash
# 1. Install dependencies
cd eta-system
pip install -r requirements.txt

# 2. Configure environment
cp .env.example .env
# Fill in: GEMINI_API_KEY, SERPER_API_KEY, APOLLO_API_KEY, SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY

# 3. Run Web UI (Recommended)
streamlit run ui.py

# ...or Run CLI
python main.py --industry "Landscaping" --region "TX" --top-n 10
```

## CLI Options

| Flag | Default | Description |
|------|---------|-------------|
| `--industry` | *(required)* | Industry vertical |
| `--region` | *(required)* | Geography / state |
| `--top-n` | 20 | Max leads to process |
| `--min-revenue` | "Unknown" | Revenue hint for search query |
| `--output` | `leads_output.csv` | Output file path |

## Output

**CSV columns**: Company Name, Website, Contact Name, Email, Title, Revenue, EBITDA, SDE, Profit, Employees, For Sale, Value Proposition, Email Draft, Status.

**Supabase table**: `eta_leads` — same columns with deduplication on `(company_name, website)`.

## Edge Cases

- **No contact found** → flagged `"Manual Research Needed"`, never skipped or crashed.
- **Rate limiting** → exponential backoff on all API calls (configurable retries).
- **100+ results** → capped at `--top-n` with pagination; logged total available count.
- **Unreachable website** → analysis skipped gracefully, remaining pipeline continues.
