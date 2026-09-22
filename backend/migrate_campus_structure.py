import os
import sys
from sqlalchemy import text
from app.database import Base, engine
import app.models

print("Creating new tables if not exist...")
Base.metadata.create_all(bind=engine)
print("Base tables created/verified.")

print("Running ALTER TABLE statements for newly added columns...")
with engine.connect() as conn:
    alter_stmts = [
        "ALTER TABLE rooms ADD COLUMN IF NOT EXISTS block_id INTEGER REFERENCES campus_blocks(id) ON DELETE SET NULL;",
        "ALTER TABLE rooms ADD COLUMN IF NOT EXISTS floor_id INTEGER REFERENCES campus_floors(id) ON DELETE SET NULL;",
        "ALTER TABLE rooms ADD COLUMN IF NOT EXISTS area_id INTEGER REFERENCES campus_areas(id) ON DELETE SET NULL;",
        "ALTER TABLE rooms ADD COLUMN IF NOT EXISTS primary_class_id INTEGER REFERENCES classes(id) ON DELETE SET NULL;",
        "ALTER TABLE rooms ADD COLUMN IF NOT EXISTS room_name VARCHAR(150);",
        "ALTER TABLE rooms ADD COLUMN IF NOT EXISTS is_exam_eligible BOOLEAN DEFAULT FALSE;",
        "ALTER TABLE rooms ADD COLUMN IF NOT EXISTS exam_capacity INTEGER;",
        "ALTER TABLE rooms ADD COLUMN IF NOT EXISTS required_invigilators INTEGER DEFAULT 1;",
        "ALTER TABLE rooms ADD COLUMN IF NOT EXISTS lab_type VARCHAR(100);",
        "ALTER TABLE rooms ADD COLUMN IF NOT EXISTS equipment_category VARCHAR(100);",
        "ALTER TABLE rooms ADD COLUMN IF NOT EXISTS is_timetable_eligible BOOLEAN DEFAULT TRUE;",
        "ALTER TABLE rooms ADD COLUMN IF NOT EXISTS is_active BOOLEAN DEFAULT TRUE;",
        "ALTER TABLE rooms ADD COLUMN IF NOT EXISTS created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW();",
        "ALTER TABLE rooms ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW();",
        "ALTER TABLE rooms ADD COLUMN IF NOT EXISTS notes TEXT;",
        
        "ALTER TABLE campus_areas ADD COLUMN IF NOT EXISTS block_id INTEGER REFERENCES campus_blocks(id) ON DELETE SET NULL;",
        "ALTER TABLE campus_areas ADD COLUMN IF NOT EXISTS floor_id INTEGER REFERENCES campus_floors(id) ON DELETE SET NULL;",
        
        "ALTER TABLE campus_duties ADD COLUMN IF NOT EXISTS room_id INTEGER REFERENCES rooms(id) ON DELETE SET NULL;",
    ]
    for stmt in alter_stmts:
        try:
            conn.execute(text(stmt))
            conn.commit()
            print(f"Executed: {stmt[:45]}...")
        except Exception as e:
            print(f"Notice on stmt {stmt[:30]}: {e}")

print("Campus structure schema sync completed successfully.")
