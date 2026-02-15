import sys
import os
sys.path.append(os.path.abspath(os.path.join(os.path.dirname(__file__), '..')))
from duckduckgo_search import DDGS
import json

def main():
    company = "Casey Electrical Services"
    query = f"site:linkedin.com/in '{company}' Owner OR CEO OR Founder OR President"
    print(f"Searching: {query}")
    
    try:
        # Simple sync usage
        results = DDGS().text(query, max_results=5)
        print(f"Found {len(results)} results:")
        for r in results:
            print(json.dumps(r, indent=2))
            
    except Exception as e:
        print(f"Error: {e}")

if __name__ == "__main__":
    main()

