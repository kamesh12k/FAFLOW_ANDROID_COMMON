"""Shared validators for the two schedule-shape settings that are meant to
be customizable (see app/config.py for the full explanation of the
application-layer vs database-CHECK-constraint split). Every Pydantic
schema that validates a period_number or day_order imports from here
instead of hardcoding "1 <= v <= 5" / "1 <= v <= 6" directly, so changing
PERIODS_PER_DAY or DAY_ORDER_MAX in .env takes effect everywhere at once."""
from app.config import settings


def validate_period_number(v: int) -> int:
    if not (1 <= v <= settings.PERIODS_PER_DAY):
        raise ValueError(f"period_number must be between 1 and {settings.PERIODS_PER_DAY}")
    return v


def validate_day_order(v: int) -> int:
    if not (1 <= v <= settings.DAY_ORDER_MAX):
        raise ValueError(f"day_order must be between 1 and {settings.DAY_ORDER_MAX}")
    return v
