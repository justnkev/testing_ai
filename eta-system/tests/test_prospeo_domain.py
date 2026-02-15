import sys
import os
sys.path.append(os.path.abspath(os.path.join(os.path.dirname(__file__), '..')))
import os
import asyncio
import httpx
import json
from dotenv import load_dotenv

load_dotenv(r"c:\Users\Kevin Wong\Documents\GitHub\testing_ai\eta-system\.env")

async def main():
    api_key = os.environ.get("PROSPEO_API_KEY")
    url = "https://api.prospeo.io/search-person"
    domain = "caseyelectricalservices.com"
    
    variations = [
        # Check if "domain" parameter works at top level (like enrichment endpoint)
        {"desc": "Top-level domain param", "payload": {"domain": domain, "limit": 1}},
        
        # Check if filters structure is valid by using a different filter
        # e.g. email_required (boolean)
        {"desc": "Generic Filter (Email Required only)", "payload": {"filters": {"email_required": True}, "limit": 1}},
        
        # Check if "domain" works inside filters
        {"desc": "Filter: domain", "payload": {"filters": {"domain": [domain]}, "limit": 1}}
    ]

    print(f"Testing Domain & Generic Filters")
    
    async with httpx.AsyncClient(timeout=30) as client:
        for v in variations:
            print(f"--- Testing: {v['desc']} ---")
            try:
                resp = await client.post(url, json=v["payload"], headers={"Content-Type": "application/json", "X-KEY": api_key})
                print(f"Status: {resp.status_code}")
                try:
                    print(json.dumps(resp.json(), indent=2))
                except:
                    print(f"Body: {resp.text}")
            except Exception as e:
                print(f"Error: {e}")
            
            await asyncio.sleep(1)

if __name__ == "__main__":
    asyncio.run(main())

