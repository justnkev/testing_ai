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
    api_key = os.environ.get("SERPER_API_KEY")
    url = "https://google.serper.dev/search"
    
    company = "Casey Electrical Services"
    query = f"site:linkedin.com/in \"{company}\" Owner OR CEO OR Founder"
    
    payload = {
        "q": query,
        "num": 5
    }
    
    print(f"Testing Serper Search: {query}")
    
    async with httpx.AsyncClient(timeout=30) as client:
        try:
            resp = await client.post(url, json=payload, headers={"X-API-KEY": api_key, "Content-Type": "application/json"})
            print(f"Status: {resp.status_code}")
            if resp.status_code == 200:
                data = resp.json()
                print(f"Found {len(data.get('organic', []))} organic results:")
                for r in data.get("organic", []):
                    print(f"  Title: {r.get('title')}")
                    print(f"  Link: {r.get('link')}")
                    print(f"  Snippet: {r.get('snippet')}")
            else:
                print(resp.text)
                
        except Exception as e:
            print(f"Error: {e}")

if __name__ == "__main__":
    asyncio.run(main())

