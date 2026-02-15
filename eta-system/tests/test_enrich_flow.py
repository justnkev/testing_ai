import sys
import os
sys.path.append(os.path.abspath(os.path.join(os.path.dirname(__file__), '..')))
import asyncio
import os
import logging
from dotenv import load_dotenv

# Setup logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger("test_enrich_flow")

# Load Env
load_dotenv(r"c:\Users\Kevin Wong\Documents\GitHub\testing_ai\eta-system\.env")

from eta.models import Lead
from eta.enricher import Enricher

async def main():
    # 1. Setup
    print("--- Setting up Enricher ---")
    apollo_key = os.getenv("APOLLO_API_KEY", "")
    gemini_key = os.getenv("GEMINI_API_KEY", "")
    prospeo_key = os.getenv("PROSPEO_API_KEY", "")
    serper_key = os.getenv("SERPER_API_KEY", "") # Implicitly used by Enricher via os.environ

    if not serper_key or not prospeo_key:
        print("MISSING KEYS! Aborting.")
        return

    enricher = Enricher(apollo_key, gemini_key, prospeo_key)

    # 2. Create Dummy Lead
    lead = Lead(
        company_name="Casey Electrical Services",
        website="caseyelectricalservices.com",
        region="CT",
        status="new"
    )
    print(f"Initial Lead: {lead.company_name} (Status: {lead.status})")

    # 3. Step 1: Web Search
    print("\n--- Step 1: Search Best Contact via Web ---")
    lead = await enricher.search_best_contact_via_web(lead)
    
    print(f"Post-Search Contact: {lead.contact_name}")
    print(f"Post-Search Title: {lead.contact_title}")
    print(f"Post-Search LinkedIn: {lead.linkedin_url}")
    
    if not lead.contact_name or "casey" not in lead.contact_name.lower():
        print("FAILED: Did not find expected owner (Casey).")
    else:
        print("SUCCESS: Found likely owner.")

    # 4. Step 2: Prospeo Enrichment
    print("\n--- Step 2: Enrich Email via Prospeo ---")
    # We expect Prospeo to use the LinkedIn URL if present
    lead = await enricher.enrich_email_via_prospeo(lead)

    print(f"Final Contact: {lead.contact_name}")
    print(f"Final Email: {lead.contact_email}")
    print(f"Final Status: {lead.status}")

    if lead.contact_email and "@" in lead.contact_email:
        print("SUCCESS: Found email!")
    else:
        print("WARNING: No email found (might be valid if Prospeo has no data).")

if __name__ == "__main__":
    asyncio.run(main())

