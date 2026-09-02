import os
from sqlalchemy import create_engine, text

db_url = "postgresql://postgres@localhost:5432/credits_db"
engine = create_engine(db_url)

migration_path = "../database/migrations/006_multi_department.sql"
with open(migration_path, "r", encoding="utf-8") as f:
    sql_content = f.read()

# Split the ALTER TYPE block from the rest of the migration
# because PostgreSQL requires new enum values to be committed before usage.
split_token = "$$;"
parts = sql_content.split(split_token)

part1 = parts[0] + split_token
part2 = split_token.join(parts[1:])

print("Running database migration part 1 (altering enum types)...")
with engine.connect() as conn:
    conn.execute(text(part1))
    conn.commit()
print("Enum types committed successfully.")

print("Running database migration part 2 (updating schema and backfilling)...")
with engine.connect() as conn:
    conn.execute(text(part2))
    conn.commit()
print("Database migration completed successfully!")
