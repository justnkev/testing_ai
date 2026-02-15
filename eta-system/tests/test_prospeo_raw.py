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
        {"desc": "Root key 'domains'", "payload": {"domains": [domain], "limit": 1}, "method": "POST"},
        {"desc": "Root key 'websites'", "payload": {"websites": [domain], "limit": 1}, "method": "POST"},
        {"desc": "Root List", "payload": [domain], "method": "POST"},
        {"desc": "GET Query Param", "params": {"company": domain}, "method": "GET"}
    ]

    print(f"Testing Raw Payloads")
    
    async with httpx.AsyncClient(timeout=30) as client:
        for v in variations:
            print(f"--- Testing: {v['desc']} ---")
            try:
                if v["method"] == "POST":
                    resp = await client.post(url, json=v["payload"], headers={"Content-Type": "application/json", "X-KEY": api_key})
                else:
                    resp = await client.get(url, params=v.get("params"), headers={"X-KEY": api_key})
                
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

