from datetime import datetime, date, time, timezone, timedelta
from zoneinfo import ZoneInfo
from app.config import settings

# Explicit Institution Timezone (defaults to "Asia/Kolkata")
INSTITUTION_TIMEZONE_NAME: str = getattr(settings, "TIMEZONE", "Asia/Kolkata")
try:
    INSTITUTION_TZ = ZoneInfo(INSTITUTION_TIMEZONE_NAME)
except Exception:
    INSTITUTION_TZ = timezone(timedelta(hours=5, minutes=30), name="Asia/Kolkata")

CUTOFF_HOUR: int = 17  # 5:00 PM (17:00:00)


# Aliases for convenience
IST = INSTITUTION_TZ


def get_institution_now() -> datetime:
    """Returns the current timezone-aware datetime in the configured institution timezone (Asia/Kolkata)."""
    return datetime.now(INSTITUTION_TZ)


get_ist_now = get_institution_now


def get_institution_today() -> date:
    """Returns today's date in the institution timezone."""
    return get_institution_now().date()


get_ist_today = get_institution_today



def is_substitution_expired(sub_date: date) -> bool:
    """Determines whether a substitution record is expired according to the 5:00 PM cutoff
    in the institution timezone (Asia/Kolkata).

    Exact Rule:
    - If sub_date < today in Asia/Kolkata -> True (Past/Completed)
    - If sub_date == today in Asia/Kolkata and current time in Asia/Kolkata >= 17:00:00 -> True (Expired/Completed)
    - If sub_date == today in Asia/Kolkata and current time in Asia/Kolkata < 17:00:00 -> False (Active/Current)
    - If sub_date > today in Asia/Kolkata -> False (Upcoming/Active)
    """
    now = get_institution_now()
    today = now.date()
    if sub_date < today:
        return True
    if sub_date == today and now.time() >= time(CUTOFF_HOUR, 0, 0):
        return True
    return False
