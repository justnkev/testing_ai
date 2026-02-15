import sys
import os
sys.path.append(os.path.abspath(os.path.join(os.path.dirname(__file__), '..')))
import os
import asyncio
import httpx
from dotenv import load_dotenv

load_dotenv(r"c:\Users\Kevin Wong\Documents\GitHub\testing_ai\eta-system\.env")

async def main():
    api_key = os.environ.get("PROSPEO_API_KEY")
    # Trying different params for company suggestions
    params_list = [
        {"company_name_search": "Casey Electrical"},
        {"company_search": "Casey Electrical"},
        {"q": "Casey Electrical"}
    ]
    
    headers = {"X-KEY": api_key}
    
    for params in params_list:
        url = "https://api.prospeo.io/search-suggestions"
        print(f"Testing Suggestions with params: {params}")
        async with httpx.AsyncClient() as client:
            try:
                resp = await client.get(url, params=params, headers=headers)
                print(f"Status: {resp.status_code}")
                try:
                    print(resp.json())
                except:
                    print(resp.text)
            except Exception as e:
                print(f"Error: {e}")

if __name__ == "__main__":
    asyncio.run(main())

