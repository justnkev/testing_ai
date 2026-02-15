import base64
import json
import logging
import os
from datetime import datetime
from pathlib import Path
from typing import Any, Dict, List, Optional
from dotenv import load_dotenv
load_dotenv()   


test_key = os.getenv('GOOGLE_API_KEY', 'no-key-found')
print(test_key)
