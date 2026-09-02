"""Tests for app.core.security — password hashing, JWT, validation."""
import pytest
from app.core.security import (
    hash_password, verify_password, create_access_token, decode_token,
    validate_password_strength, _validate_password_length,
    BCRYPT_MAX_BYTES, MIN_PASSWORD_LENGTH, DEFAULT_BOOTSTRAP_PASSWORD,
)


class TestPasswordHashing:
    def test_hash_and_verify_roundtrip(self):
        pw = "Securepass1"
        hashed = hash_password(pw)
        assert hashed != pw
        assert verify_password(pw, hashed) is True

    def test_wrong_password_fails(self):
        hashed = hash_password("Correct1")
        assert verify_password("Wrong1234", hashed) is False

    def test_password_too_long_raises(self):
        long_pw = "a" * (BCRYPT_MAX_BYTES + 1)
        with pytest.raises(ValueError, match="at most"):
            hash_password(long_pw)

    def test_verify_too_long_returns_false(self):
        hashed = hash_password("Normal123")
        assert verify_password("a" * 100, hashed) is False

    def test_verify_malformed_hash_returns_false(self):
        assert verify_password("Test1234", "not-a-valid-hash") is False


class TestPasswordStrength:
    def test_short_password(self):
        with pytest.raises(ValueError, match="at least"):
            validate_password_strength("Ab1")

    def test_no_digits(self):
        with pytest.raises(ValueError, match="letter and one number"):
            validate_password_strength("abcdefgh")

    def test_no_letters(self):
        with pytest.raises(ValueError, match="letter and one number"):
            validate_password_strength("12345678")

    def test_forbid_default(self):
        # "admin" is too short anyway, but test the forbid_default path with
        # a password that passes length/complexity
        from unittest.mock import patch
        with patch("app.core.security.DEFAULT_BOOTSTRAP_PASSWORD", "admin123"):
            with pytest.raises(ValueError, match="default"):
                validate_password_strength("admin123", forbid_default=True)



    def test_valid_password(self):
        validate_password_strength("GoodPass1")  # should not raise


class TestJWT:
    def test_create_and_decode_roundtrip(self):
        data = {"sub": "42", "role": "teacher"}
        token = create_access_token(data)
        payload = decode_token(token)
        assert payload["sub"] == "42"
        assert payload["role"] == "teacher"
        assert "exp" in payload

    def test_invalid_token_returns_empty(self):
        assert decode_token("not.a.valid.token") == {}

    def test_tampered_token_returns_empty(self):
        token = create_access_token({"sub": "1"})
        tampered = token[:-5] + "XXXXX"
        assert decode_token(tampered) == {}
