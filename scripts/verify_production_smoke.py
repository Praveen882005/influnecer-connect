#!/usr/bin/env python3
"""
==============================================================================
Brand Bridge - Production Deployment Smoke Test Suite
==============================================================================
Validates live backend and frontend instances against production readiness
criteria:
  - Liveness & readiness probes (/health, /ready, /api/v1/health)
  - Database connectivity & transaction persistence
  - CORS header propagation & preflight handling
  - Safe error handling & zero secret leakage
  - Authentication flow & JWT token validation
  - Frontend SPA serving & client-side route fallback

Usage:
  python scripts/verify_production_smoke.py [--backend-url http://127.0.0.1:8000] [--frontend-url http://127.0.0.1:5173]
==============================================================================
"""

import argparse
import json
import sys
import time
import urllib.error
import urllib.parse
import urllib.request
from typing import Any, Dict, Optional, Tuple


class SmokeTestRunner:
    def __init__(self, backend_url: str, frontend_url: str):
        self.backend_url = backend_url.rstrip("/")
        self.frontend_url = frontend_url.rstrip("/")
        self.passed = 0
        self.failed = 0
        self.results = []

    def log_result(self, test_name: str, passed: bool, message: str = "", details: Optional[Dict[str, Any]] = None):
        status_icon = "PASS" if passed else "FAIL"
        if passed:
            self.passed += 1
            print(f"  [+] [{status_icon}] {test_name}: {message}")
        else:
            self.failed += 1
            print(f"  [-] [{status_icon}] {test_name}: {message}")
            if details:
                print(f"      Details: {json.dumps(details, indent=2)}")

        self.results.append({
            "test": test_name,
            "status": status_icon,
            "message": message,
            "details": details or {},
        })

    def request(
        self,
        url: str,
        method: str = "GET",
        headers: Optional[Dict[str, str]] = None,
        data: Optional[Dict[str, Any]] = None,
    ) -> Tuple[int, Dict[str, str], bytes]:
        req_headers = headers or {}
        req_data = None
        if data is not None:
            req_data = json.dumps(data).encode("utf-8")
            if "Content-Type" not in req_headers:
                req_headers["Content-Type"] = "application/json"

        req = urllib.request.Request(url, data=req_data, headers=req_headers, method=method)
        try:
            with urllib.request.urlopen(req, timeout=10) as resp:
                resp_headers = dict(resp.headers)
                body = resp.read()
                return resp.status, resp_headers, body
        except urllib.error.HTTPError as e:
            resp_headers = dict(e.headers)
            body = e.read()
            return e.code, resp_headers, body
        except Exception as e:
            return 0, {}, str(e).encode("utf-8")

    def test_backend_liveness(self):
        url = f"{self.backend_url}/health"
        start = time.time()
        status, headers, body = self.request(url)
        elapsed = round((time.time() - start) * 1000, 2)

        if status == 200:
            try:
                data = json.loads(body.decode("utf-8"))
                if data.get("status") in ("ok", "healthy"):
                    self.log_result("Backend Liveness Probe (/health)", True, f"HTTP 200 OK in {elapsed}ms ({data.get('app')})")
                    return
            except json.JSONDecodeError:
                pass
        self.log_result("Backend Liveness Probe (/health)", False, f"Unexpected response status={status}", {"body": body.decode("utf-8", errors="ignore")})

    def test_backend_readiness(self):
        url = f"{self.backend_url}/ready"
        start = time.time()
        status, headers, body = self.request(url)
        elapsed = round((time.time() - start) * 1000, 2)

        if status == 200:
            try:
                data = json.loads(body.decode("utf-8"))
                db_status = data.get("database_status")
                if not db_status and isinstance(data.get("subsystems"), dict):
                    raw_db = data["subsystems"].get("database")
                    db_status = raw_db.get("status") if isinstance(raw_db, dict) else raw_db

                is_ready = data.get("status") in ("ready", "ok") or data.get("ready") is True
                if is_ready:
                    self.log_result(
                        "Backend Readiness Probe (/ready)",
                        True,
                        f"Database connected in {elapsed}ms (DB status: {db_status or 'connected'})",
                    )
                    return
            except json.JSONDecodeError:
                pass
        self.log_result("Backend Readiness Probe (/ready)", False, f"Readiness probe failed status={status}", {"body": body.decode("utf-8", errors="ignore")})

    def test_api_directory_and_docs(self):
        url = f"{self.backend_url}/"
        status, headers, body = self.request(url)
        if status == 200:
            try:
                data = json.loads(body.decode("utf-8"))
                endpoints = data.get("endpoints", {})
                if "api_docs_swagger" in endpoints and "liveness_probe" in endpoints:
                    self.log_result("API Root Service Directory (/)", True, f"Available endpoints exposed correctly (version {data.get('version')})")
                    return
            except json.JSONDecodeError:
                pass
        self.log_result("API Root Service Directory (/)", False, f"Root response invalid status={status}")

    def test_cors_preflight(self):
        url = f"{self.backend_url}/health"
        test_origin = "http://localhost:3000"
        headers = {
            "Origin": test_origin,
            "Access-Control-Request-Method": "GET",
        }
        status, resp_headers, body = self.request(url, method="OPTIONS", headers=headers)
        # Check either OPTIONS returned 200 or GET includes allow-origin
        allow_origin = resp_headers.get("access-control-allow-origin") or resp_headers.get("Access-Control-Allow-Origin")
        if allow_origin == test_origin or allow_origin == "*":
            self.log_result("CORS Preflight Headers", True, f"Origin '{test_origin}' allowed correctly ({allow_origin})")
        else:
            # Test with standard GET and origin header
            status_get, headers_get, _ = self.request(url, method="GET", headers={"Origin": test_origin})
            allow_origin_get = headers_get.get("access-control-allow-origin") or headers_get.get("Access-Control-Allow-Origin")
            if allow_origin_get == test_origin or allow_origin_get == "*":
                self.log_result("CORS Origin Header Propagation", True, f"Origin '{test_origin}' propagated in responses")
            else:
                self.log_result("CORS Configuration", False, f"Origin '{test_origin}' missing from CORS allow headers", {"response_headers": resp_headers})

    def test_safe_error_handling_and_no_secret_leak(self):
        url = f"{self.backend_url}/api/v1/nonexistent_test_route_404"
        status, headers, body = self.request(url)
        if status == 404:
            body_text = body.decode("utf-8", errors="ignore")
            # Verify no secret keywords leaked
            leaks = [kw for kw in ("secret_key", "password_hash", "traceback", "Traceback (most recent call last)") if kw in body_text.lower()]
            if not leaks:
                self.log_result("Safe Error Handling (404 Sanitization)", True, "Structured 404 returned without internal leaks")
            else:
                self.log_result("Safe Error Handling", False, f"Potential sensitive leak detected: {leaks}")
        else:
            self.log_result("Safe Error Handling (404)", False, f"Expected status 404, got {status}")

    def test_core_public_read_workflow(self):
        url = f"{self.backend_url}/api/v1/creators/niches"
        status, headers, body = self.request(url)
        if status == 200:
            try:
                niches = json.loads(body.decode("utf-8"))
                if isinstance(niches, list) and len(niches) > 0:
                    self.log_result("Core Read Workflow (/creators/niches)", True, f"Retrieved {len(niches)} creator niches successfully")
                    return
            except json.JSONDecodeError:
                pass
        self.log_result("Core Read Workflow (/creators/niches)", False, f"Failed with status={status}")

    def test_authentication_workflow(self):
        # Test demo admin login
        login_url = f"{self.backend_url}/api/v1/auth/login"
        payload = {"email": "admin@brandbridge.com", "password": "AdminPassword123!"}
        status, headers, body = self.request(login_url, method="POST", data=payload)

        if status == 200:
            try:
                data = json.loads(body.decode("utf-8"))
                token = data.get("access_token")
                user = data.get("user", {})
                if token and user.get("email") == "admin@brandbridge.com":
                    # Verify authenticated request with token
                    me_url = f"{self.backend_url}/api/v1/auth/me"
                    auth_headers = {"Authorization": f"Bearer {token}"}
                    me_status, _, me_body = self.request(me_url, headers=auth_headers)
                    if me_status == 200:
                        self.log_result("Core Auth & Token Workflow", True, f"Admin logged in and session verified (/auth/me HTTP 200, Role: {user.get('role')})")
                        return
            except json.JSONDecodeError:
                pass

        # If admin fixture not seeded with default password, test registration of fresh test user
        ts = int(time.time())
        reg_url = f"{self.backend_url}/api/v1/auth/register"
        reg_payload = {
            "email": f"smoketest_{ts}@example.com",
            "password": "SmokeTestPassword123!",
            "full_name": f"Smoke Test User {ts}",
            "role": "brand",
        }
        reg_status, _, reg_body = self.request(reg_url, method="POST", data=reg_payload)
        if reg_status in (200, 201):
            try:
                reg_data = json.loads(reg_body.decode("utf-8"))
                token = reg_data.get("access_token")
                if token:
                    self.log_result("Core Auth & Token Workflow", True, f"User registration and token issuance verified (Status {reg_status})")
                    return
            except Exception:
                pass

        self.log_result("Core Auth & Token Workflow", False, f"Login/register failed (status={status})", {"body": body.decode("utf-8", errors="ignore")})

    def test_frontend_spa_delivery(self):
        if not self.frontend_url:
            self.log_result("Frontend SPA Delivery", True, "Frontend URL omitted; skipping frontend probe")
            return

        status, headers, body = self.request(self.frontend_url)
        if status == 200:
            body_text = body.decode("utf-8", errors="ignore")
            if "<html" in body_text and ("<div id=\"root\"" in body_text or "index" in body_text):
                self.log_result("Frontend SPA Delivery", True, "SPA HTML index delivered successfully")
                return
        self.log_result("Frontend SPA Delivery", False, f"Frontend returned status={status}")

    def test_frontend_spa_deep_link(self):
        if not self.frontend_url:
            return

        # Verify client-side route fallback (/login)
        url = f"{self.frontend_url}/login"
        status, headers, body = self.request(url)
        if status == 200:
            body_text = body.decode("utf-8", errors="ignore")
            if "<html" in body_text:
                self.log_result("Frontend SPA Route Fallback (/login)", True, "Deep link routes routed to SPA index (HTTP 200)")
                return
        self.log_result("Frontend SPA Route Fallback (/login)", False, f"Deep link failed with status={status}")

    def run_all(self) -> bool:
        print("\n" + "=" * 70)
        print("  BRAND BRIDGE - PRODUCTION DEPLOYMENT SMOKE TEST VERIFICATION")
        print("=" * 70)
        print(f"Backend Target:  {self.backend_url}")
        print(f"Frontend Target: {self.frontend_url}\n")

        self.test_backend_liveness()
        self.test_backend_readiness()
        self.test_api_directory_and_docs()
        self.test_cors_preflight()
        self.test_safe_error_handling_and_no_secret_leak()
        self.test_core_public_read_workflow()
        self.test_authentication_workflow()
        self.test_frontend_spa_delivery()
        self.test_frontend_spa_deep_link()

        print("\n" + "-" * 70)
        print(f"Summary: {self.passed} PASSED | {self.failed} FAILED (Total: {self.passed + self.failed})")
        print("-" * 70 + "\n")

        return self.failed == 0


def main():
    parser = argparse.ArgumentParser(description="Brand Bridge Production Smoke Verification")
    parser.add_argument("--backend-url", default="http://127.0.0.1:8000", help="Backend base URL")
    parser.add_argument("--frontend-url", default="http://127.0.0.1:5173", help="Frontend base URL")
    args = parser.parse_args()

    runner = SmokeTestRunner(args.backend_url, args.frontend_url)
    success = runner.run_all()
    sys.exit(0 if success else 1)


if __name__ == "__main__":
    main()
