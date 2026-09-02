import pytest
from app.core import security
from app.core.security import BCRYPT_MAX_BYTES, MIN_PASSWORD_LENGTH
from app.config import settings


def test_validate_password_strength_success():
    security.validate_password_strength("StrongPass1")


def test_validate_password_strength_too_short():
    with pytest.raises(ValueError, match="at least"):
        security.validate_password_strength("S1")


def test_validate_password_strength_requires_letter_and_number():
    with pytest.raises(ValueError, match="at least one letter and one number"):
        security.validate_password_strength("onlyletters")


def test_validate_password_strength_forbid_default():
    from unittest.mock import patch
    with patch("app.core.security.DEFAULT_BOOTSTRAP_PASSWORD", "admin123"):
        with pytest.raises(ValueError, match="cannot be the default"):
            security.validate_password_strength("admin123", forbid_default=True)




def test_hash_and_verify_password_roundtrip():
    hashed = security.hash_password("StrongPass1")
    assert isinstance(hashed, str)
    assert security.verify_password("StrongPass1", hashed)
    assert not security.verify_password("WrongPass", hashed)


def test_verify_password_invalid_length_returns_false():
    hashed = security.hash_password("ValidPass1")
    assert not security.verify_password("A" * (BCRYPT_MAX_BYTES + 1), hashed)


def test_create_and_decode_access_token():
    token = security.create_access_token({"sub": "1", "role": "teacher"})
    payload = security.decode_token(token)
    assert payload["sub"] == "1"
    assert payload["role"] == "teacher"


def test_decode_token_invalid_returns_empty():
    assert security.decode_token("not-a-token") == {}
