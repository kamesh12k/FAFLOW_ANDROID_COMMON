import os
import sys
import re
from sqlalchemy import create_engine, inspect, text

# 1. Load connection string from backend/.env
env_path = r"c:\Users\kames\Downloads\FACREDIT original bug free\FACREDIT-main\backend\.env"
db_url = None
if os.path.exists(env_path):
    with open(env_path, "r") as f:
        for line in f:
            if line.startswith("DATABASE_URL="):
                db_url = line.split("=", 1)[1].strip()
                break

if not db_url:
    print("[-] Error: DATABASE_URL not found in backend/.env")
    sys.exit(1)

# 2. Connect to database
try:
    engine = create_engine(db_url)
    connection = engine.connect()
    print("[+] Successfully connected to the target database.")
except Exception as e:
    print(f"[-] Database connection failed: {e}")
    sys.exit(1)

# 3. Parse Schema file to extract target tables and columns
schema_path = r"c:\Users\kames\Downloads\FACREDIT original bug free\FACREDIT-main\database\schema.sql"
schema_tables = {}

if os.path.exists(schema_path):
    with open(schema_path, "r", encoding="utf-8") as f:
        content = f.read()
    
    # Simple regex to extract CREATE TABLE blocks
    table_matches = re.findall(r"CREATE TABLE\s+(\w+)\s*\((.*?)\);", content, re.DOTALL | re.IGNORECASE)
    for table_name, body in table_matches:
        cols = []
        for line in body.split("\n"):
            line = line.strip()
            # Match columns that start with name and data type, avoiding constraints
            match = re.match(r"^(\w+)\s+(\w+)", line)
            if match and match.group(1).upper() not in ("CONSTRAINT", "PRIMARY", "FOREIGN", "UNIQUE", "CHECK"):
                cols.append(match.group(1).lower())
        schema_tables[table_name.lower()] = cols
else:
    print("[-] Error: schema.sql file not found.")
    sys.exit(1)

# 4. Compare with Active DB schema
inspector = inspect(engine)
db_tables = inspector.get_table_names()
mismatches = 0

print("\n--- SCHEMA COMPARISON REPORT ---")
for table, schema_cols in schema_tables.items():
    if table not in db_tables:
        print(f"[!] Mismatch: Table '{table}' exists in schema.sql but is missing in active database.")
        mismatches += 1
        continue
    
    db_cols = [c["name"].lower() for c in inspector.get_columns(table)]
    missing_cols = [c for c in schema_cols if c not in db_cols]
    if missing_cols:
        print(f"[!] Mismatch in table '{table}': Columns {missing_cols} exist in schema.sql but are missing in active database.")
        mismatches += 1

if mismatches == 0:
    print("[+] Schema Check: PASS! All tables and columns match schema.sql.")
else:
    print(f"[-] Schema Check: FAIL! Found {mismatches} mismatches.")
    sys.exit(1)


# 5. Importer function with error handling
def run_import(sql_file_path):
    if not os.path.exists(sql_file_path):
        print(f"\n[-] Import file not found: {sql_file_path}")
        return False
        
    print(f"\n[~] Reading seed SQL file: {sql_file_path}")
    with open(sql_file_path, "r", encoding="utf-8-sig") as f:
        lines = f.readlines()
        
    # Split into statements (simple parser that ignores comments)
    statements = []
    current = []
    for line_num, line in enumerate(lines, 1):
        clean_line = line.strip()
        if not clean_line or clean_line.startswith("--"):
            continue
        current.append((line_num, line))
        if clean_line.endswith(";"):
            stmt_text = "".join([x[1] for x in current])
            start_line = current[0][0]
            statements.append((start_line, stmt_text))
            current = []
            
    print(f"[~] Found {len(statements)} SQL statements to execute.")
    print("[~] Starting transaction...")
    
    trans = connection.begin()
    try:
        for start_line, stmt in statements:
            # We don't execute BEGIN/COMMIT inside the connection transaction
            if stmt.strip().upper() in ("BEGIN;", "COMMIT;"):
                continue
            try:
                connection.execute(text(stmt))
            except Exception as stmt_err:
                print("\n[-] IMPORT FAILED!")
                print(f"  Error on Line: {start_line}")
                stmt_clean = stmt.strip().encode('ascii', 'replace').decode('ascii')
                print(f"  Statement: {stmt_clean}")
                err_clean = str(stmt_err).encode('ascii', 'replace').decode('ascii')
                print(f"  PostgreSQL Error Details: {err_clean}")
                print("[~] Rolling back all changes...")
                trans.rollback()
                return False
                
        print("\n[+] SUCCESS! All statements executed smoothly.")
        print("[~] Committing transaction...")
        trans.commit()
        return True
    except Exception as e:
        err_clean = str(e).encode('ascii', 'replace').decode('ascii')
        print(f"\n[-] Fatal error during transaction: {err_clean}")
        trans.rollback()
        return False

# Execute import if input seed file is provided via arguments
if len(sys.argv) > 1:
    run_import(sys.argv[1])
else:
    print("\n[i] To run import: run script passing the seed file path as argument.")
    print("    Example: python validate_and_import.py database/import_seed.sql")
