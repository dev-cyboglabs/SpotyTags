"""Tests for Round 5 features:
   - Currency / locale settings
   - ESP32 gateway batch ingestion + config endpoint
"""
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


# ============ Currency ============
def test_currency_get(admin):
    r = admin.get(f"{BASE_URL}/api/settings/currency")
    assert r.status_code == 200
    data = r.json()
    assert "current" in data
    assert data["current"]["code"]
    assert data["current"]["symbol"]
    assert data["current"]["locale"]
    assert "available" in data
    assert len(data["available"]) >= 15
    codes = [c["code"] for c in data["available"]]
    for must_have in ("USD", "EUR", "GBP", "INR", "AED", "JPY", "CNY", "SGD", "AUD", "CAD"):
        assert must_have in codes, f"Missing currency {must_have}"


def test_currency_update_and_revert(admin):
    # Switch to USD
    r = admin.put(f"{BASE_URL}/api/settings/currency",
                  json={"currency_code": "USD", "country": "United States"})
    assert r.status_code == 200
    data = r.json()
    assert data["current"]["code"] == "USD"
    assert data["current"]["symbol"] == "$"

    # GET reflects new currency
    r = admin.get(f"{BASE_URL}/api/settings/currency")
    assert r.json()["current"]["code"] == "USD"
    assert r.json()["country"] == "United States"

    # Switch to EUR
    r = admin.put(f"{BASE_URL}/api/settings/currency",
                  json={"currency_code": "EUR", "country": "Germany"})
    assert r.status_code == 200
    assert r.json()["current"]["code"] == "EUR"

    # Revert to INR
    r = admin.put(f"{BASE_URL}/api/settings/currency",
                  json={"currency_code": "INR", "country": "India"})
    assert r.status_code == 200
    assert r.json()["current"]["code"] == "INR"


def test_currency_invalid_code_rejected(admin):
    r = admin.put(f"{BASE_URL}/api/settings/currency",
                  json={"currency_code": "XYZ"})
    assert r.status_code == 400
    assert r.json()["detail"]["code"] == "invalid_currency"
    assert "supported" in r.json()["detail"]


def test_currency_requires_admin():
    # Reception cannot update currency
    s = _login("reception@spotytags.com", "Recep@123")
    r = s.put(f"{BASE_URL}/api/settings/currency", json={"currency_code": "USD"})
    assert r.status_code == 403


# ============ ESP32 batch endpoint ============
def test_gateway_config_endpoint(admin):
    gws = admin.get(f"{BASE_URL}/api/gateways").json()
    assert len(gws) > 0
    gw = gws[0]
    r = requests.get(f"{BASE_URL}/api/gateway/{gw['gateway_id']}/config",
                      headers={"X-API-Key": gw["api_key"]}, timeout=10)
    assert r.status_code == 200
    data = r.json()
    assert data["ok"] is True
    assert data["gateway_id"] == gw["gateway_id"]
    assert "scan_interval_sec" in data["config"]
    assert "batch_max_size" in data["config"]
    assert data["endpoints"]["batch"] == "/api/gateway/ble-events/batch"


def test_gateway_config_wrong_key():
    r = requests.get(f"{BASE_URL}/api/gateway/GW-101/config",
                      headers={"X-API-Key": "gw_nonexistent"}, timeout=10)
    assert r.status_code == 401


def test_gateway_batch_accepts_multiple_events(admin):
    gws = admin.get(f"{BASE_URL}/api/gateways").json()
    gw = gws[0]
    tags = admin.get(f"{BASE_URL}/api/tags").json()
    assert len(tags) >= 2
    payload = {
        "events": [
            {
                "api_key": gw["api_key"], "gateway_id": gw["gateway_id"],
                "tag_id": tags[i]["tag_id"], "ble_mac": tags[i]["ble_mac"],
                "battery": 90 - i, "rssi": -60 - i,
                "gpio_status": 0, "tamper_status": False,
                "timestamp": "2026-05-20T01:00:00Z",
            }
            for i in range(min(3, len(tags)))
        ]
    }
    r = requests.post(f"{BASE_URL}/api/gateway/ble-events/batch", json=payload, timeout=10)
    assert r.status_code == 200, r.text
    data = r.json()
    assert data["accepted"] == len(payload["events"])
    assert data["rejected"] == 0
    assert len(data["results"]) == len(payload["events"])
    for res in data["results"]:
        assert res["ok"] is True


def test_gateway_batch_rejects_mixed_gateway(admin):
    gws = admin.get(f"{BASE_URL}/api/gateways").json()
    if len(gws) < 2:
        pytest.skip("need >=2 gateways")
    tag = admin.get(f"{BASE_URL}/api/tags").json()[0]
    payload = {
        "events": [
            {
                "api_key": gws[0]["api_key"], "gateway_id": gws[0]["gateway_id"],
                "tag_id": tag["tag_id"], "ble_mac": tag["ble_mac"],
                "battery": 90, "rssi": -60, "gpio_status": 0, "tamper_status": False,
            },
            {
                "api_key": gws[0]["api_key"], "gateway_id": gws[1]["gateway_id"],  # mismatch!
                "tag_id": tag["tag_id"], "ble_mac": tag["ble_mac"],
                "battery": 89, "rssi": -61, "gpio_status": 0, "tamper_status": False,
            },
        ]
    }
    r = requests.post(f"{BASE_URL}/api/gateway/ble-events/batch", json=payload, timeout=10)
    assert r.status_code == 200, r.text
    data = r.json()
    assert data["accepted"] == 1
    assert data["rejected"] == 1


def test_gateway_batch_too_large_rejected():
    payload = {"events": [{"api_key": "x", "gateway_id": "y", "tag_id": "z",
                            "ble_mac": "00:00:00:00:00:00", "battery": 1, "rssi": -1,
                            "gpio_status": 0, "tamper_status": False}] * 501}
    r = requests.post(f"{BASE_URL}/api/gateway/ble-events/batch", json=payload, timeout=10)
    assert r.status_code == 413


def test_gateway_batch_empty_returns_zero(admin):
    payload = {"events": []}
    r = requests.post(f"{BASE_URL}/api/gateway/ble-events/batch", json=payload, timeout=10)
    assert r.status_code == 200
    assert r.json()["accepted"] == 0


def test_gateway_batch_queues_for_cloud_sync(admin):
    """Each accepted ble-event should produce a ble_event entry in the cloud sync queue."""
    before = admin.get(f"{BASE_URL}/api/cloud/status").json()
    gws = admin.get(f"{BASE_URL}/api/gateways").json()
    gw = gws[0]
    tag = admin.get(f"{BASE_URL}/api/tags").json()[0]
    payload = {"events": [{
        "api_key": gw["api_key"], "gateway_id": gw["gateway_id"],
        "tag_id": tag["tag_id"], "ble_mac": tag["ble_mac"],
        "battery": 88, "rssi": -65, "gpio_status": 0, "tamper_status": False,
        "timestamp": "2026-05-20T01:02:00Z",
    }]}
    r = requests.post(f"{BASE_URL}/api/gateway/ble-events/batch", json=payload, timeout=10)
    assert r.status_code == 200
    after = admin.get(f"{BASE_URL}/api/cloud/status").json()
    # Total (pending + synced) must have grown
    before_total = before["pending_count"] + before["synced_count"]
    after_total = after["pending_count"] + after["synced_count"]
    assert after_total > before_total, f"Cloud queue did not grow: {before} → {after}"
