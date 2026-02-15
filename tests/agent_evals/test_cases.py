"""
Gold-standard test cases for agent evaluation.

Each case is a dict with:
    - name:             Human-readable test name.
    - diff:             A fake PR diff containing a known issue (or clean code).
    - expected_flags:   Keywords the review MUST contain (empty → should not flag).
    - forbidden_flags:  Keywords the review MUST NOT contain.
    - severity:         Expected minimum severity the agent should report.
"""

CASES: list[dict] = [

    # ── Security ────────────────────────────────────────────────────────
    {
        "name": "sql_injection",
        "description": "Raw string interpolation in SQL query — should be flagged.",
        "diff": '''
diff --git a/app/db.py b/app/db.py
--- a/app/db.py
+++ b/app/db.py
@@ -10,0 +10,8 @@
+def get_user(username):
+    conn = sqlite3.connect("app.db")
+    cursor = conn.cursor()
+    query = f"SELECT * FROM users WHERE username = '{username}'"
+    cursor.execute(query)
+    return cursor.fetchone()
''',
        "expected_flags": ["sql injection", "parameterized", "sanitiz"],
        "forbidden_flags": [],
        "severity": "critical",
    },

    {
        "name": "hardcoded_secret",
        "description": "API key hardcoded in source — should be flagged.",
        "diff": '''
diff --git a/config.py b/config.py
--- a/config.py
+++ b/config.py
@@ -1,0 +1,5 @@
+API_KEY = "sk-proj-abc123def456ghi789"
+DATABASE_URL = "postgres://admin:password123@prod-db.example.com:5432/app"
+
+def get_config():
+    return {"api_key": API_KEY, "db": DATABASE_URL}
''',
        "expected_flags": ["secret", "hardcoded", "environment variable"],
        "forbidden_flags": [],
        "severity": "critical",
    },

    # ── Logic Errors ────────────────────────────────────────────────────
    {
        "name": "off_by_one",
        "description": "Classic off-by-one in loop boundary.",
        "diff": '''
diff --git a/utils.py b/utils.py
--- a/utils.py
+++ b/utils.py
@@ -5,0 +5,6 @@
+def process_items(items):
+    results = []
+    for i in range(1, len(items)):  # Bug: skips index 0
+        results.append(items[i] * 2)
+    return results
''',
        "expected_flags": ["off-by-one", "index 0", "skip"],
        "forbidden_flags": [],
        "severity": "warning",
    },

    # ── Clean Code (False-positive check) ───────────────────────────────
    {
        "name": "clean_code",
        "description": "Well-written code — agent should NOT flag major issues.",
        "diff": '''
diff --git a/utils.py b/utils.py
--- a/utils.py
+++ b/utils.py
@@ -0,0 +1,15 @@
+from typing import Optional
+
+
+def calculate_average(values: list[float]) -> Optional[float]:
+    """Return the arithmetic mean, or None for empty input."""
+    if not values:
+        return None
+    return sum(values) / len(values)
+
+
+def clamp(value: float, low: float, high: float) -> float:
+    """Clamp a value between low and high bounds."""
+    return max(low, min(high, value))
''',
        "expected_flags": [],  # Nothing should be flagged
        "forbidden_flags": ["bug", "vulnerability", "critical", "error"],
        "severity": "none",
    },

    # ── Performance ─────────────────────────────────────────────────────
    {
        "name": "n_plus_one_query",
        "description": "N+1 database query pattern — should be flagged.",
        "diff": '''
diff --git a/api/views.py b/api/views.py
--- a/api/views.py
+++ b/api/views.py
@@ -10,0 +10,10 @@
+def list_orders(request):
+    orders = Order.objects.all()
+    result = []
+    for order in orders:
+        customer = Customer.objects.get(id=order.customer_id)  # N+1 query!
+        result.append({
+            "order_id": order.id,
+            "customer_name": customer.name,
+        })
+    return JsonResponse(result, safe=False)
''',
        "expected_flags": ["n+1", "select_related", "prefetch", "query"],
        "forbidden_flags": [],
        "severity": "warning",
    },
]
