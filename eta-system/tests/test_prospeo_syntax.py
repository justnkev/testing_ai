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
    
    variations = [
        # Syntax check on boolean
        {"desc": "Email Required: String 'true'", "payload": {"filters": {"email_required": "true"}, "limit": 1}},
        {"desc": "Email Required: Int 1", "payload": {"filters": {"email_required": 1}, "limit": 1}},
        
        # Company key variations that might match internal names
        {"desc": "Filter: current_company", "payload": {"filters": {"current_company": ["caseyelectricalservices.com"]}, "limit": 1}},
        {"desc": "Filter: company_domain", "payload": {"filters": {"company_domain": ["caseyelectricalservices.com"]}, "limit": 1}},
        
        # Test exact snippet from Step 855: "company.websites"
        # But maybe the value needs to be a list of objects? or something?
        # Just retrying explicitly
        {"desc": "Filter: company.websites (list)", "payload": {"filters": {"company.websites": ["caseyelectricalservices.com"]}, "limit": 1}}
    ]

    print(f"Testing Syntax Types")
    
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

