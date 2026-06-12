"""Validate background sync loop syncs queued events automatically."""
import os
import time
import requests

BASE_URL = os.environ["REACT_APP_BACKEND_URL"].rstrip("/")


def _login(email: str, password: str) -> requests.Session:
    s = requests.Session()
    r = s.post(f"{BASE_URL}/api/auth/login", json={"email": email, "password": password}, timeout=15)
    assert r.status_code == 200, r.text
    s.headers.update({"Authorization": f"Bearer {r.json()['access_token']}"})
    return s


def test_background_loop_syncs_audit_events():
    admin = _login("admin@spotytags.com", "Admin@123")

    # Pick an active tag with assignments for tamper sim
    tags = admin.get(f"{BASE_URL}/api/tags").json()
    assert len(tags) > 0
    tag = next((t for t in tags if t.get("status") == "active" and t.get("assigned_room_id") and t.get("assigned_product_id")), None)
    if not tag:
        tag = tags[0]

    before = admin.get(f"{BASE_URL}/api/cloud/status").json()
    print("BEFORE:", before)

    # Trigger an audited action: a theme update is reliably audited
    admin.put(f"{BASE_URL}/api/settings/theme",
              json={"theme_name": "luxury_gold", "primary_color": "#FFB800"})
    # Also try a tamper sim (some tags may not be assignable)
    admin.post(f"{BASE_URL}/api/demo/simulate-tamper", json={"tag_id": tag["id"]})

    # Verify queue / synced grows
    mid = admin.get(f"{BASE_URL}/api/cloud/status").json()
    print("MID:", mid)

    # Wait for the background loop (interval default 30s) - max 45 sec
    deadline = time.time() + 45
    synced_grew = False
    cur = mid
    while time.time() < deadline:
        time.sleep(5)
        cur = admin.get(f"{BASE_URL}/api/cloud/status").json()
        print("POLL:", cur)
        if cur["synced_count"] > before["synced_count"]:
            synced_grew = True
            break

    assert synced_grew, f"synced_count did not increase within 45s. before={before}, last={cur}"


def test_license_is_professional_after_module_tests():
    """Sanity – previous license tests must have restored 'professional'."""
    admin = _login("admin@spotytags.com", "Admin@123")
    r = admin.get(f"{BASE_URL}/api/license/current")
    assert r.status_code == 200
    plan = r.json().get("plan")
    assert plan == "professional", f"License plan left as {plan!r}, should be 'professional'"
