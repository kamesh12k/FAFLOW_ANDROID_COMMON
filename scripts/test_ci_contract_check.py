"""
test_ci_contract_check.py – Unit tests for scripts/ci_contract_check.py

These tests use deliberately broken fixtures that MUST FAIL to prove the
checker catches real problems. Tests are self-contained: no network, no DB.
"""
import sys
import os
import json
import tempfile
import textwrap
from pathlib import Path

import pytest
import yaml

# Make scripts/ importable
sys.path.insert(0, str(Path(__file__).parent.parent / "scripts"))

# Import the module under test
import importlib
ci_mod = importlib.import_module("ci_contract_check")

_norm = ci_mod._norm
load_openapi_paths = ci_mod.load_openapi_paths
check_parity = ci_mod.check_parity
SpecPath = ci_mod.SpecPath


# ── Fixtures ──────────────────────────────────────────────────────────────────

MINIMAL_SPEC = {
    "openapi": "3.1.0",
    "info": {"title": "Test", "version": "1.0.0"},
    "paths": {
        "/auth/login": {
            "post": {
                "operationId": "login",
                "parameters": [],
                "responses": {"200": {"description": "ok"}},
                "security": [{"BearerAuth": []}],
            }
        },
        "/attendance/check-in": {
            "post": {
                "operationId": "checkIn",
                "parameters": [{"in": "query", "name": "lat", "required": True}],
                "responses": {"201": {"description": "ok"}},
                "security": [{"BearerAuth": []}],
            }
        },
        "/teachers/{teacher_id}": {
            "get": {
                "operationId": "getTeacher",
                "responses": {"200": {"description": "ok"}},
                "security": [{"BearerAuth": []}],
            }
        },
        "/leave-balances/{teacher_id}/ledger": {
            "get": {
                "operationId": "getLeaveLedger",
                "responses": {"200": {"description": "ok"}},
                "security": [{"BearerAuth": []}],
            }
        },
    },
    "components": {
        "securitySchemes": {
            "BearerAuth": {"type": "http", "scheme": "bearer", "bearerFormat": "JWT"}
        }
    },
    "security": [{"BearerAuth": []}],
}


@pytest.fixture
def spec_file(tmp_path):
    """Write MINIMAL_SPEC to a temp YAML file."""
    f = tmp_path / "test_openapi.yaml"
    f.write_text(yaml.dump(MINIMAL_SPEC), encoding="utf-8")
    return str(f)


@pytest.fixture
def spec_paths(spec_file):
    """Load SpecPath dict from minimal spec."""
    return load_openapi_paths(spec_file)


# ── _norm tests ───────────────────────────────────────────────────────────────

class TestNorm:
    def test_openapi_param_normalised(self):
        assert _norm("/teachers/{teacher_id}") == "/teachers/{*}"

    def test_retrofit_param_normalised(self):
        assert _norm("teachers/{teacher_id}") == "/teachers/{*}"

    def test_js_template_literal_normalised(self):
        assert _norm("/teachers/${id}") == "/teachers/{*}"

    def test_trailing_slash_stripped(self):
        assert _norm("/auth/login/") == "/auth/login"

    def test_lowercased(self):
        assert _norm("/Auth/Login") == "/auth/login"

    def test_no_leading_slash_added(self):
        assert _norm("auth/login").startswith("/")

    def test_multi_params(self):
        result = _norm("/campus-duties/{duty_id}/assignments/{assignment_id}/override")
        assert result == "/campus-duties/{*}/assignments/{*}/override"


# ── load_openapi_paths tests ──────────────────────────────────────────────────

class TestLoadSpec:
    def test_paths_loaded(self, spec_paths):
        assert len(spec_paths) == 4

    def test_login_has_post(self, spec_paths):
        assert "POST" in spec_paths["/auth/login"].methods

    def test_login_has_security(self, spec_paths):
        assert spec_paths["/auth/login"].has_security is True

    def test_teacher_path_normalised(self, spec_paths):
        assert "/teachers/{*}" in spec_paths

    def test_leave_ledger_normalised(self, spec_paths):
        assert "/leave-balances/{*}/ledger" in spec_paths

    def test_query_params_captured(self, spec_paths):
        # /attendance/check-in has required query param 'lat'
        check_in = spec_paths.get("/attendance/check-in")
        assert check_in is not None
        assert "lat" in check_in.query_params
        assert check_in.query_params["lat"] is True  # required=True


# ── check_parity: MUST FAIL cases ────────────────────────────────────────────

class TestParityMustFail:
    """These tests verify the checker catches real problems. They MUST produce HIGH mismatches."""

    def test_unknown_endpoint_detected(self, spec_paths):
        """A client calling an endpoint not in the spec must produce HIGH."""
        endpoints = [{"method": "GET", "path": "/nonexistent/route", "norm": "/nonexistent/route",
                      "source": "test.kt"}]
        mismatches = check_parity(spec_paths, endpoints, "Android", verbose=False)
        assert len(mismatches) == 1
        assert mismatches[0]["severity"] == "HIGH"
        assert mismatches[0]["type"] == "UNKNOWN_ENDPOINT"

    def test_wrong_method_detected(self, spec_paths):
        """A client calling GET on a POST-only endpoint must produce HIGH."""
        endpoints = [{"method": "GET", "path": "/auth/login", "norm": "/auth/login",
                      "source": "test.kt"}]
        mismatches = check_parity(spec_paths, endpoints, "Android", verbose=False)
        assert len(mismatches) == 1
        assert mismatches[0]["severity"] == "HIGH"
        assert mismatches[0]["type"] == "METHOD_MISMATCH"

    def test_old_leave_ledger_path_fails(self, spec_paths):
        """The OLD path 'leave-balances/teacher/{id}/ledger' must produce HIGH (it's not in spec)."""
        endpoints = [{"method": "GET", "path": "leave-balances/teacher/1/ledger",
                      "norm": "/leave-balances/teacher/{*}/ledger", "source": "old_api.kt"}]
        mismatches = check_parity(spec_paths, endpoints, "Android", verbose=False)
        # /leave-balances/teacher/{*}/ledger is not in the spec
        high = [m for m in mismatches if m["severity"] == "HIGH"]
        assert len(high) == 1, f"Expected 1 HIGH, got: {mismatches}"

    def test_multiple_broken_clients_all_caught(self, spec_paths):
        """Multiple broken endpoints all produce HIGH."""
        endpoints = [
            {"method": "GET", "path": "/fake/one", "norm": "/fake/one", "source": "a.kt"},
            {"method": "GET", "path": "/fake/two", "norm": "/fake/two", "source": "b.kt"},
            {"method": "DELETE", "path": "/auth/login", "norm": "/auth/login", "source": "c.kt"},  # wrong method
        ]
        mismatches = check_parity(spec_paths, endpoints, "Android", verbose=False)
        assert len(mismatches) == 3
        for m in mismatches:
            assert m["severity"] == "HIGH"

    def test_empty_spec_everything_fails(self):
        """An empty spec means every client call is HIGH."""
        empty_spec: dict[str, SpecPath] = {}
        endpoints = [
            {"method": "POST", "path": "/auth/login", "norm": "/auth/login", "source": "a.kt"},
        ]
        mismatches = check_parity(empty_spec, endpoints, "Android", verbose=False)
        assert len(mismatches) == 1
        assert mismatches[0]["severity"] == "HIGH"


# ── check_parity: MUST PASS cases ────────────────────────────────────────────

class TestParityMustPass:
    """These tests confirm the checker accepts correct client calls."""

    def test_correct_post_login_passes(self, spec_paths):
        endpoints = [{"method": "POST", "path": "/auth/login", "norm": "/auth/login",
                      "source": "test.kt"}]
        mismatches = check_parity(spec_paths, endpoints, "Android", verbose=False)
        assert mismatches == []

    def test_parametrised_path_passes(self, spec_paths):
        # /teachers/{teacher_id} -> normalises to /teachers/{*}
        endpoints = [{"method": "GET", "path": "teachers/{teacher_id}",
                      "norm": "/teachers/{*}", "source": "test.kt"}]
        mismatches = check_parity(spec_paths, endpoints, "Android", verbose=False)
        assert mismatches == []

    def test_corrected_leave_ledger_passes(self, spec_paths):
        """The FIXED path 'leave-balances/{id}/ledger' must PASS."""
        endpoints = [{"method": "GET", "path": "leave-balances/{teacher_id}/ledger",
                      "norm": "/leave-balances/{*}/ledger", "source": "FaflowApiService.kt"}]
        mismatches = check_parity(spec_paths, endpoints, "Android", verbose=False)
        assert mismatches == []

    def test_duplicates_deduplicated(self, spec_paths):
        """Same (method, norm) twice must only be checked once."""
        endpoints = [
            {"method": "POST", "path": "/auth/login", "norm": "/auth/login", "source": "a.kt"},
            {"method": "POST", "path": "/auth/login", "norm": "/auth/login", "source": "b.kt"},
        ]
        mismatches = check_parity(spec_paths, endpoints, "Android", verbose=False)
        assert mismatches == []

    def test_empty_client_list_passes(self, spec_paths):
        mismatches = check_parity(spec_paths, [], "Android", verbose=False)
        assert mismatches == []


# ── Report output test ────────────────────────────────────────────────────────

class TestReport:
    def test_report_written_with_correct_status(self, spec_paths, tmp_path):
        report_file = str(tmp_path / "parity.json")
        # Run with a known-broken endpoint
        endpoints = [{"method": "DELETE", "path": "/nonexistent", "norm": "/nonexistent",
                      "source": "x.kt"}]
        mismatches = check_parity(spec_paths, endpoints, "Android", verbose=False)
        report = {
            "summary": {"status": "FAIL" if mismatches else "PASS", "high_severity": len(mismatches)},
            "mismatches": mismatches,
        }
        with open(report_file, "w") as f:
            json.dump(report, f)
        with open(report_file) as f:
            loaded = json.load(f)
        assert loaded["summary"]["status"] == "FAIL"
        assert loaded["summary"]["high_severity"] == 1
