from sqlalchemy.orm import Session
from app.models.system_setting import SystemSetting

def get_setting(db: Session, key: str, default: str = None, department_id: int | None = None) -> str:
    if department_id is not None:
        row = db.query(SystemSetting).filter(SystemSetting.key == key, SystemSetting.department_id == department_id).first()
        if row:
            return row.value
    # Fallback to global setting (department_id is None)
    row = db.query(SystemSetting).filter(SystemSetting.key == key, SystemSetting.department_id == None).first()
    return row.value if row else default

def set_setting(db: Session, key: str, value: str, department_id: int | None = None) -> None:
    row = db.query(SystemSetting).filter(SystemSetting.key == key, SystemSetting.department_id == department_id).first()
    if not row:
        row = SystemSetting(key=key, value=value, department_id=department_id)
        db.add(row)
    else:
        row.value = value
