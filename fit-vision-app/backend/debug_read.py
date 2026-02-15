import os
import json

path = r"C:\Users\Kevin Wong\.gemini\antigravity\brain\92dd25e6-0495-4710-8968-c6b7c5ec0a7f\.system_generated\steps\83\output.txt"

try:
    with open(path, 'r', encoding='utf-8') as f:
        content = f.read().strip()
    
    print(f"Length: {len(content)}")
    print(f"Start: {content[:20]!r}")
    print(f"End: {content[-20:]!r}")
    
    if content.startswith('"') and content.endswith('"'):
        content = content[1:-1]
        print("Stripped outer quotes")

    if "<untrusted-data-" in content:
        start = content.find("<untrusted-data-")
        close = content.find(">", start)
        end = content.find("</untrusted-data-", close)
        print(f"Tags found: {start}, {close}, {end}")
        if start != -1 and close != -1 and end != -1:
            extracted = content[close+1:end].strip()
            print(f"Extracted len: {len(extracted)}")
            print(f"Extracted start: {extracted[:50]!r}")
            
            try:
                json.loads(extracted)
                print("JSON load success")
            except Exception as e:
                print(f"JSON load fail: {e}")
                if '\\"' in extracted:
                    print("Found escaped quotes")
                    fixed = extracted.replace('\\"', '"')
                    try:
                        json.loads(fixed)
                        print("Fixed and loaded")
                    except Exception as e2:
                        print(f"Fixed fail: {e2}")

except Exception as e:
    print(f"Error: {e}")
