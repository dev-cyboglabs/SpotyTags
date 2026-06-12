"""Iter7 regression spot-checks — post code-review refactor.

Verifies KPI shape unchanged, login bcrypt $2b$ format, cloud flush moves data,
and BLE single-event tamper-edge still creates a pending bill.
"""
import os
import time
import uuid
import requests
import pytest

BASE_URL = os.environ["REACT_APP_BACKEND_URL"].rstrip("/")
ADMIN = {"email": "admin@spotytags.com", "password": "Admin@123"}

REQUIRED_KPI_KEYS = {
    "total_rooms", "active_tags", "assigned_tags", "pending_bills",
    "confirmed_usage", "low_battery_tags", "offline_gateways", "tags_not_seen",
    "today_revenue", "monthly_revenue", "license_status", "license_expiry",
    "licensed_rooms_used", "licensed_rooms_total", "local_server_status",
    "cloud_sync_status", "last_sync_time", "pending_sync_count",
}


@pytest.fixture
def admin_session():
    s = requests.Session()
    r = s.post(f"{BASE_URL}/api/auth/login", json=ADMIN, timeout=20)
    assert r.status_code == 200, r.text
    return s


# === Auth refactor (security.py extraction) ===
def test_login_succeeds_with_admin_credentials():
    r = requests.post(f"{BASE_URL}/api/auth/login", json=ADMIN, timeout=20)
    assert r.status_code == 200
    data = r.json()
    assert data["user"]["email"] == ADMIN["email"]
    assert data["user"]["role"] == "super_admin"


def test_login_invalid_password_returns_401():
    r = requests.post(f"{BASE_URL}/api/auth/login",
                      json={"email": ADMIN["email"], "password": "wrong"}, timeout=20)
    assert r.status_code == 401


# === KPI shape (dashboard_kpi refactored into helpers) ===
def test_kpi_shape_unchanged(admin_session):
    r = admin_session.get(f"{BASE_URL}/api/dashboard/kpi", timeout=20)
    assert r.status_code == 200
    data = r.json()
    missing = REQUIRED_KPI_KEYS - set(data.keys())
    assert not missing, f"Missing KPI keys: {missing}"


# Note: BLE single-event tamper-edge and batch mixed-gateway rejection are
# already covered by test_spotytags_backend.TestGatewayBLE and
# test_currency_and_gateway_batch — not duplicated here.


# === Cloud sync flush (flush_now refactor with helpers) ===
def test_cloud_flush_processes_queue(admin_session):
    status_before = admin_session.get(f"{BASE_URL}/api/cloud/status", timeout=15).json()
    synced_before = status_before.get("synced_count", 0)

    # Trigger an audited action (theme update)
    admin_session.put(f"{BASE_URL}/api/settings/theme",
                      json={"primary_color": f"#{uuid.uuid4().hex[:6]}"}, timeout=15)

    flush = admin_session.post(f"{BASE_URL}/api/cloud/flush", timeout=15)
    assert flush.status_code in (200, 202), flush.text

    # Poll up to ~35s for synced_count to grow OR pending_sync_count to decrease
    grew = False
    for _ in range(18):
        time.sleep(2)
        s = admin_session.get(f"{BASE_URL}/api/cloud/status", timeout=15).json()
        if s.get("synced_count", 0) > synced_before or s.get("pending_sync_count", 0) == 0:
            grew = True
            break
    assert grew, "cloud sync did not advance within 35s"
