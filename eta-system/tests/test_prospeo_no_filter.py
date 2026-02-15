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
        {"desc": "Top-level company_websites", "payload": {"company_websites": [domain], "limit": 1}},
        {"desc": "Top-level company", "payload": {"company": [domain], "limit": 1}},
        {"desc": "Filters: company_website (singular)", "payload": {"filters": {"company_website": [domain]}, "limit": 1}},
        {"desc": "Filters: company (list)", "payload": {"filters": {"company": [domain]}, "limit": 1}}
    ]

    print(f"Testing Payload Structure")
    
    async with httpx.AsyncClient(timeout=30) as client:
        for v in variations:
            print(f"--- Testing: {v['desc']} ---")
            try:
                resp = await client.post(url, json=v["payload"], headers={"Content-Type": "application/json", "X-KEY": api_key})
                print(f"Status: {resp.status_code}")
                if resp.status_code == 200:
                    print("SUCCESS!")
                    try:
                        print(json.dumps(resp.json(), indent=2))
                    except:
                        pass
                    break
                else:
                    try:
                       print(json.dumps(resp.json(), indent=2))
                    except:
                       print(f"Body: {resp.text}")
            except Exception as e:
                print(f"Error: {e}")
            
            await asyncio.sleep(1)

if __name__ == "__main__":
    asyncio.run(main())

