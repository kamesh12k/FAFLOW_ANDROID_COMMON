from datetime import datetime, timedelta, timezone
import bcrypt
from jose import JWTError, jwt

from app.config import settings

# Using bcrypt directly rather than passlib's CryptContext wrapper.
# passlib 1.7.4 (the latest release) reads an internal `bcrypt.__about__`
# attribute that newer bcrypt releases (4.1+) removed, producing a noisy
# "(trapped) error reading bcrypt version" AttributeError on every hash/
# verify call. It's non-fatal but confusing, and passlib has not shipped a
# fix. Calling bcrypt's stable hashpw/checkpw API directly avoids it
# entirely while keeping the same hash format ($2b$ — interchangeable with
# any existing passlib-bcrypt hashes, including the ones in seed.sql).

BCRYPT_ROUNDS = 12
BCRYPT_MAX_BYTES = 72  # hard limit of the bcrypt/Blowfish algorithm itself

DEFAULT_BOOTSTRAP_PASSWORD = "admin"
MIN_PASSWORD_LENGTH = 8


def _validate_password_length(password: str) -> None:
    """bcrypt silently truncated passwords over 72 bytes in older releases;
    bcrypt 5.0+ raises ValueError instead. Either way, checking explicitly
    here gives a clear 400 error message instead of a confusing exception
    (or, in pre-5.0 bcrypt, a security footgun where only the first 72
    bytes actually matter). Measured in UTF-8 bytes, not characters, since
    multi-byte characters make those two counts diverge."""
    if len(password.encode("utf-8")) > BCRYPT_MAX_BYTES:
        raise ValueError(f"Password must be at most {BCRYPT_MAX_BYTES} bytes long")


def validate_password_strength(password: str, *, forbid_default: bool = False) -> None:
    """Used wherever a human picks a *new* password (registration, admin
    creation, first-login setup) — not on every login verify, where we just
    want to compare hashes regardless of how weak a legacy password is.
    Raises ValueError with a user-facing message on failure."""
    if len(password) < MIN_PASSWORD_LENGTH:
        raise ValueError(f"Password must be at least {MIN_PASSWORD_LENGTH} characters long")
    if not any(c.isalpha() for c in password) or not any(c.isdigit() for c in password):
        raise ValueError("Password must contain at least one letter and one number")
    if forbid_default and password.lower() == DEFAULT_BOOTSTRAP_PASSWORD:
        raise ValueError(f'Password cannot be the default value ("{DEFAULT_BOOTSTRAP_PASSWORD}")')


def hash_password(password: str) -> str:
    _validate_password_length(password)
    return bcrypt.hashpw(password.encode("utf-8"), bcrypt.gensalt(rounds=BCRYPT_ROUNDS)).decode("utf-8")


def verify_password(plain: str, hashed: str) -> bool:
    try:
        _validate_password_length(plain)
        return bcrypt.checkpw(plain.encode("utf-8"), hashed.encode("utf-8"))
    except (ValueError, TypeError):
        # Malformed/foreign hash format, or an over-length password —
        # treat as a failed verification rather than letting an exception
        # bubble up as an unhandled 500.
        return False


def create_access_token(data: dict) -> str:
    payload = data.copy()
    expire = datetime.now(timezone.utc) + timedelta(minutes=settings.ACCESS_TOKEN_EXPIRE_MINUTES)
    payload.update({"exp": expire})
    return jwt.encode(payload, settings.SECRET_KEY, algorithm=settings.ALGORITHM)


def decode_token(token: str) -> dict:
    try:
        return jwt.decode(token, settings.SECRET_KEY, algorithms=[settings.ALGORITHM])
    except JWTError:
        return {}
