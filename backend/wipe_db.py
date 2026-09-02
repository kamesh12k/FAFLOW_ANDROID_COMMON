from sqlalchemy import create_engine, text
from app.database import SessionLocal
from app.services.admin_service import bootstrap_default_super_admin

engine = create_engine("postgresql://postgres@localhost:5432/credits_db")
print("Wiping database tables...")
with engine.begin() as conn:
    conn.execute(text("""
        TRUNCATE TABLE 
            push_subscriptions, 
            notifications, 
            credit_transactions, 
            teacher_credits, 
            substitution_preferences, 
            alter_assignments, 
            leave_requests, 
            timetable_slots, 
            calendar_days, 
            semesters, 
            academic_years, 
            classes, 
            rooms, 
            subjects, 
            departments, 
            audit_logs, 
            users, 
            system_settings 
        CASCADE;
    """))

# Re-run bootstrap
db = SessionLocal()
print("Bootstrapping default System Admin...")
bootstrap_default_super_admin(db)
db.close()
print("Wipe and bootstrap completed successfully!")
