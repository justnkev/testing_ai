import json
import os
import re

# Define file paths
BASE_DIR = r"C:\Users\Kevin Wong\.gemini\antigravity\brain\92dd25e6-0495-4710-8968-c6b7c5ec0a7f\.system_generated\steps"
SCHEMA_FILE = os.path.join(BASE_DIR, "17", "output.txt")
DATA_FILES = {
    "profiles": os.path.join(BASE_DIR, "84", "output.txt"),
    "progress_logs": os.path.join(BASE_DIR, "80", "output.txt"),
    "meals": os.path.join(BASE_DIR, "76", "output.txt"),
    "sleep": os.path.join(BASE_DIR, "77", "output.txt"),
    "workouts": os.path.join(BASE_DIR, "83", "output.txt"),
    "visualizations": os.path.join(BASE_DIR, "78", "output.txt"),
    "conversations": os.path.join(BASE_DIR, "81", "output.txt"),
    "user_plans": os.path.join(BASE_DIR, "79", "output.txt"),
    "user_onboarding": r"c:\Users\Kevin Wong\Documents\GitHub\testing_ai\fit-vision-app\backend\user_onboarding_data.json",
    "policies": os.path.join(BASE_DIR, "96", "output.txt"),
}

OUTPUT_FILE = "fitvision_export.sql"

def load_json_file(filepath):
    """Loads JSON content from a file, handling potential 'untrusted-data' wrappers."""
    content = ""
    try:
        with open(filepath, 'r', encoding='utf-8') as f:
            content = f.read().strip()
            
        # 1. Try to unwrap outer JSON string if present
        if content.startswith('"') or content.startswith("'"):
            try:
                content = json.loads(content) 
            except json.JSONDecodeError:
                pass
        
        # 2. Extract JSON by finding first [ and last ]
        # This bypasses all the tag mess
        start_idx = content.find("[")
        end_idx = content.rfind("]")
        
        if start_idx != -1 and end_idx != -1 and end_idx > start_idx:
            candidate = content[start_idx : end_idx+1]
            try:
                return json.loads(candidate)
            except json.JSONDecodeError:
                # If first [ didn't work (maybe in header?), try iterating or just fail to step 3
                pass

        # 3. Parse actual JSON data (fallback if brackets logic didn't return)
        return json.loads(content)
    except Exception as e:
        print(f"Error reading {filepath}: {e}")
        # Debugging output to see what went wrong
        snippet = content[:100] if content else "EMPTY"
        print(f"DEBUG Snippet: {snippet!r}")
        return []

def get_safe_value(value, data_type=None):
    if value is None:
        return "NULL"
    if isinstance(value, bool):
        return "true" if value else "false"
    if isinstance(value, (int, float)):
        return str(value)
    if isinstance(value, (dict, list)):
        return "'" + json.dumps(value).replace("'", "''") + "'"
    
    # String escaping
    return "'" + str(value).replace("'", "''") + "'"

def generate_create_table(schema_list, target_tables):
    sql = []
    
    # Order matters for constraints
    ordered_tables = ["profiles", "progress_logs", "user_onboarding", "meals", "sleep", "workouts", "visualizations", "conversations", "user_plans"]
    
    # Re-order target_schemas
    schema_map = {t['name']: t for t in schema_list if t['name'] in target_tables}
    
    for table_name in ordered_tables:
        if table_name not in schema_map:
            continue
            
        table_def = schema_map[table_name]
        columns_sql = []
        for col in table_def['columns']:
            # Skip organization_id FK constraints logic usually, but here we just def columns
            col_sql = f'    "{col["name"]}" {col["format"]}'
            
            # Add constraints
            if col.get("default_value"):
                default_val = col["default_value"]
                col_sql += f" DEFAULT {default_val}"
            
            if "nullable" not in col.get("options", []):
                 col_sql += " NOT NULL"
                 
            columns_sql.append(col_sql)
            
        # Primary Keys
        if table_def.get("primary_keys"):
            pk_cols = ", ".join([f'"{c}"' for c in table_def["primary_keys"]])
            columns_sql.append(f'    CONSTRAINT {table_name}_pkey PRIMARY KEY ({pk_cols})')

        sql.append(f"CREATE TABLE IF NOT EXISTS public.{table_name} (")
        sql.append(",\n".join(columns_sql))
        sql.append(");\n")
        
        # Add Foreign Keys?
        if table_def.get("foreign_key_constraints"):
            for fk in table_def["foreign_key_constraints"]:
                if fk['target'].startswith("public.organizations"):
                    sql.append(f"-- FK skipped: {fk['name']} references organizations (not exported)")
                    continue
                if fk['target'].startswith("auth.users"):
                     sql.append(f"-- FK skipped: {fk['name']} references auth.users (ensure auth.users exists)")
                     continue
                
                if fk['target'].startswith("public."):
                    target = fk['target'].replace("public.", "")
                    if target in target_tables:
                         ids = fk['target'].split('.')
                         target_table = ids[1]
                         target_col = ids[2]
                         source_col = fk['source'].split('.')[-1]
                         
                         sql.append(f"ALTER TABLE public.{table_name} ADD CONSTRAINT {fk['name']} FOREIGN KEY (\"{source_col}\") REFERENCES public.\"{target_table}\"(\"{target_col}\");")

        sql.append("\n")

    return "\n".join(sql)

def generate_policies(policies_list, target_tables):
    sql = ["-- RLS Policies"]
    
    # Group by table
    by_table = {}
    for p in policies_list:
        if p['tablename'] in target_tables:
            by_table.setdefault(p['tablename'], []).append(p)
            
    for table_name in by_table:
        sql.append(f"ALTER TABLE public.{table_name} ENABLE ROW LEVEL SECURITY;")
        
        for p in by_table[table_name]:
            cmd = p['cmd']
            roles = p['roles'].replace('{', '').replace('}', '') 
            # pg_policies returns {public} or {authenticated}
            if not roles: roles = "public"
            
            sql.append(f"""
CREATE POLICY "{p['policyname']}" ON public.{table_name}
AS {p.get('permissive', 'PERMISSIVE')}
FOR {cmd}
TO {roles}
USING ({p['qual'] or 'true'})
{f"WITH CHECK ({p['with_check']})" if p['with_check'] else ""};
""")
    return "\n".join(sql)

def generate_inserts(data_dict, schema_map):
    sql = []
    
    ordered_tables = ["profiles", "progress_logs", "user_onboarding", "meals", "sleep", "workouts", "visualizations", "conversations", "user_plans"]

    for table_name in ordered_tables:
        rows = data_dict.get(table_name, [])
        if not rows:
            print(f"No rows for {table_name}")
            continue
            
        print(f"Processing {len(rows)} rows for {table_name}")
        
        schema = schema_map.get(table_name)
        if not schema:
             print(f"Warning: No schema found for {table_name}")
             continue
             
        columns = [c['name'] for c in schema['columns']]
        
        sql.append(f"-- Data for {table_name}")
        
        for row in rows:
            values = []
            for col in columns:
                val = row.get(col)
                values.append(get_safe_value(val))
            
            cols_str = ", ".join([f'"{c}"' for c in columns])
            vals_str = ", ".join(values)
            sql.append(f"INSERT INTO public.{table_name} ({cols_str}) VALUES ({vals_str}) ON CONFLICT DO NOTHING;")
        
        sql.append("\n")
        
    return "\n".join(sql)

def main():
    print("Starting SQL Export Generation...")
    
    # 1. Load Schema
    schema_list = load_json_file(SCHEMA_FILE)
    if not schema_list:
        print("Failed to load schema.")
        return

    target_tables = [k for k in DATA_FILES.keys() if k != "policies"]
    schema_map = {t['name']: t for t in schema_list if t['name'] in target_tables}

    # 2. Load Data & Policies
    data_map = {}
    for name, path in DATA_FILES.items():
        print(f"Loading {name} from {path}...")
        data = load_json_file(path)
        if data:
             print(f"  Loaded {len(data)} items.")
        data_map[name] = data
        
    policies_list = data_map.pop("policies", [])

    # 3. Generate SQL
    print("Generating SQL...")
    create_sql = generate_create_table(schema_list, target_tables)
    insert_sql = generate_inserts(data_map, schema_map)
    policy_sql = generate_policies(policies_list, target_tables)

    # 4. Write Output
    full_sql = f"""-- FitVision Database Export
-- Generated automatically

BEGIN;

{create_sql}

{insert_sql}

{policy_sql}

COMMIT;
"""
    
    with open(OUTPUT_FILE, "w", encoding='utf-8') as f:
        f.write(full_sql)

    print(f"Successfully generated {OUTPUT_FILE}")

if __name__ == "__main__":
    main()
