import os
from sqlalchemy import create_engine, text
from dotenv import load_dotenv

# Load env from backend/.env if available
load_dotenv(os.path.join(os.path.dirname(__file__), ".env"))
db_url = os.getenv("DATABASE_URL", "postgresql://postgres@localhost:5432/credits_db")
if db_url.startswith("postgres://"):
    db_url = db_url.replace("postgres://", "postgresql://", 1)

print(f"Connecting to database: {db_url}")
engine = create_engine(db_url)

migration_path = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "database", "migrations", "012_policy_enforcement_mode.sql"))
with open(migration_path, "r", encoding="utf-8") as f:
    sql_content = f.read()

# Separate enum DO $$ block from the rest
split_token = "$$;"
parts = sql_content.split(split_token)

if len(parts) > 1:
    part1 = parts[0] + split_token
    part2 = split_token.join(parts[1:])
    print("Executing Part 1 (enum changes)...")
    with engine.connect() as conn:
        conn.execute(text(part1))
        conn.commit()
    print("Enum committed.")
    print("Executing Part 2 (DDL & table updates)...")
    with engine.connect() as conn:
        conn.execute(text(part2))
        conn.commit()
    print("DDL committed.")
else:
    with engine.connect() as conn:
        conn.execute(text(sql_content))
        conn.commit()

print("Migration 012 completed successfully!")
