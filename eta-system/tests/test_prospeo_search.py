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
        {"desc": "Title Uppercase", "key": "person_job_title", "val": "OWNER"},
        {"desc": "Key: job_title", "key": "job_title", "val": "owner"},
        {"desc": "Key: title", "key": "title", "val": "owner"},
        {"desc": "List format w/ key person_job_title?", "key": "person_job_title", "val": ["Owner"]}
    ]

    print(f"Testing Syntax on {domain}")
    
    async with httpx.AsyncClient(timeout=30) as client:
        for v in variations:
            payload = {
                "filters": {
                    "company_websites": [domain], 
                    v["key"]: v["val"],
                    "email_required": True
                },
                "limit": 1
            }
            print(f"--- Testing: {v['desc']} ---")
            print(f"Key: {v['key']}, Value: {v['val']}")
            try:
                resp = await client.post(url, json=payload, headers={"Content-Type": "application/json", "X-KEY": api_key})
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

