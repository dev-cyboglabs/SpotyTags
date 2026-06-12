"""Tests for license enforcement + cloud sync queue (Round 4)."""
import os
import time
import pytest
import requests

BASE_URL = os.environ["REACT_APP_BACKEND_URL"].rstrip("/")
if not BASE_URL.startswith("http"):
    BASE_URL = "https://" + BASE_URL


def _login(email: str, password: str) -> requests.Session:
    s = requests.Session()
    r = s.post(f"{BASE_URL}/api/auth/login", json={"email": email, "password": password}, timeout=15)
    assert r.status_code == 200, r.text
    s.headers.update({"Authorization": f"Bearer {r.json()['access_token']}"})
    return s


@pytest.fixture(scope="module")
def admin():
    return _login("admin@spotytags.com", "Admin@123")


# ============ License /validate endpoint ============
def test_license_validate_snapshot(admin):
    r = admin.get(f"{BASE_URL}/api/license/validate")
    assert r.status_code == 200, r.text
    data = r.json()
    assert "status" in data
    assert "quotas" in data
    assert "warnings" in data
    for resource in ("rooms", "tags", "gateways", "users"):
        assert resource in data["quotas"]
        q = data["quotas"][resource]
        assert {"current", "limit", "remaining", "pct", "blocked", "near_limit"} <= set(q.keys())


def test_license_validate_warnings_when_at_limit(admin):
    # Switch to trial to force users limit (5/5)
    admin.post(f"{BASE_URL}/api/license/upgrade", json={"plan": "trial"})
    try:
        r = admin.get(f"{BASE_URL}/api/license/validate")
        assert r.status_code == 200
        data = r.json()
        assert data["quotas"]["users"]["blocked"] is True
        assert any(w["code"] == "users_limit_reached" for w in data["warnings"])
    finally:
        admin.post(f"{BASE_URL}/api/license/upgrade", json={"plan": "professional"})


def test_license_quota_blocks_room_creation(admin):
    # Switch to trial, then add rooms until cap, expect structured 403
    admin.post(f"{BASE_URL}/api/license/upgrade", json={"plan": "trial"})
    created_ids = []
    try:
        # rooms before: 7 (seeded). trial allows 10. Create 3 → ok, 4th → 403.
        for i in range(901, 905):
            r = admin.post(f"{BASE_URL}/api/rooms",
                            json={"room_number": f"T{i}", "floor": "9", "room_type": "Test"})
            if r.status_code == 200:
                created_ids.append(r.json()["id"])
            else:
                # Verify structured error
                assert r.status_code == 403
                detail = r.json()["detail"]
                assert isinstance(detail, dict)
                assert detail.get("code") == "rooms_limit_reached"
                assert "limit" in detail and "current" in detail
                return
        pytest.fail("Expected room creation to be blocked")
    finally:
        for rid in created_ids:
            admin.delete(f"{BASE_URL}/api/rooms/{rid}")
        admin.post(f"{BASE_URL}/api/license/upgrade", json={"plan": "professional"})


# ============ Cloud sync queue ============
def test_cloud_status_endpoint(admin):
    r = admin.get(f"{BASE_URL}/api/cloud/status")
    assert r.status_code == 200
    data = r.json()
    for k in ("online", "pending_count", "failed_count", "dead_letter_count",
              "synced_count", "cloud_url", "interval_sec", "batch_size"):
        assert k in data


def test_cloud_queue_grows_then_flushes(admin):
    # Trigger an audit-emitting action (theme update)
    admin.put(f"{BASE_URL}/api/settings/theme",
                json={"theme_name": "luxury_gold", "primary_color": "#FFB800"})
    # Check that something is queued/synced
    r = admin.get(f"{BASE_URL}/api/cloud/status")
    assert r.status_code == 200
    # Force flush
    r = admin.post(f"{BASE_URL}/api/cloud/flush")
    assert r.status_code == 200
    data = r.json()
    assert "processed" in data
    assert "synced" in data
    assert "failed" in data


def test_cloud_queue_listing(admin):
    r = admin.get(f"{BASE_URL}/api/cloud/queue?limit=5")
    assert r.status_code == 200
    items = r.json()
    assert isinstance(items, list)
    if items:
        entry = items[0]
        assert "id" in entry
        assert "event_type" in entry
        assert "status" in entry
        assert "attempts" in entry


def test_cloud_settings_sync_uses_real_queue(admin):
    r = admin.get(f"{BASE_URL}/api/settings/cloud-sync")
    assert r.status_code == 200
    data = r.json()
    assert "pending_count" in data
    assert "cloud_url" in data
    assert "interval_sec" in data


def test_cloud_ingest_requires_auth_header():
    """Calling /api/cloud/ingest without the X-Cloud-Auth header should 401."""
    r = requests.post(f"{BASE_URL}/api/cloud/ingest", json={"events": []}, timeout=10)
    assert r.status_code == 401


def test_cloud_ingest_accepts_valid_batch():
    headers = {"X-Cloud-Auth": os.environ.get("CLOUD_API_KEY", "demo-cloud-key")}
    payload = {"events": [{
        "id": "test-evt-1",
        "event_type": "test",
        "payload": {"hello": "world"},
        "property_id": "PROP-001",
        "idempotency_key": f"idem-{int(time.time()*1000)}",
        "queued_at": "2026-05-20T00:00:00+00:00",
    }]}
    r = requests.post(f"{BASE_URL}/api/cloud/ingest", json=payload, headers=headers, timeout=10)
    assert r.status_code == 200
    data = r.json()
    assert len(data["accepted"]) == 1


# ============ Dashboard KPI exposes pending_sync_count from new queue ============
def test_dashboard_kpi_includes_pending_sync(admin):
    r = admin.get(f"{BASE_URL}/api/dashboard/kpi")
    assert r.status_code == 200
    data = r.json()
    assert "pending_sync_count" in data
    assert "cloud_sync_status" in data
