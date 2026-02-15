import sys
import os
sys.path.append(os.path.abspath(os.path.join(os.path.dirname(__file__), '..')))
from duckduckgo_search import DDGS
import json

def main():
    queries = [
        "site:linkedin.com/in \"Casey Electrical Services\" Owner",
        "Casey Electrical Services Owner LinkedIn",
        "Casey Electrical Services CEO LinkedIn",
        "Casey Electrical Services LinkedIn"
    ]
    
    ddgs = DDGS()
    
    for q in queries:
        print(f"--- Searching: {q} ---")
        try:
            results = ddgs.text(q, max_results=3)
            print(f"Found {len(results)} results:")
            for r in results:
                print(f"  Title: {r.get('title')}")
                print(f"  URL: {r.get('href')}")
        except Exception as e:
            print(f"Error: {e}")

if __name__ == "__main__":
    main()

