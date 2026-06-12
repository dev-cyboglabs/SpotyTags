"""Tests for Round 9 — mobile app supporting endpoints."""
import os
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


def test_lookup_tag_by_printed_id_success(admin):
    """Native scan: lookup by printed Tag ID returns the tag."""
    tags = admin.get(f"{BASE_URL}/api/tags").json()
    assert len(tags) > 0, "demo seed should have tags"
    sample = tags[0]
    r = admin.get(f"{BASE_URL}/api/tags/by-tag-id/{sample['tag_id']}")
    assert r.status_code == 200, r.text
    data = r.json()
    assert data["tag_id"] == sample["tag_id"]
    assert "battery" in data
    assert "status" in data


def test_lookup_tag_by_qr_code(admin):
    """Lookup also works when scanning the QR code (which equals tag_id by default)."""
    tags = admin.get(f"{BASE_URL}/api/tags").json()
    sample = tags[0]
    qr = sample.get("qr_code") or sample["tag_id"]
    r = admin.get(f"{BASE_URL}/api/tags/by-tag-id/{qr}")
    assert r.status_code == 200


def test_lookup_tag_includes_room_when_assigned(admin):
    """When the tag is assigned, the response should include assigned_room_number."""
    tags = admin.get(f"{BASE_URL}/api/tags").json()
    assigned = [t for t in tags if t.get("assigned_room_id")]
    if not assigned:
        pytest.skip("no assigned tag in seed")
    r = admin.get(f"{BASE_URL}/api/tags/by-tag-id/{assigned[0]['tag_id']}")
    assert r.status_code == 200
    data = r.json()
    assert "assigned_room_number" in data


def test_lookup_tag_not_found(admin):
    r = admin.get(f"{BASE_URL}/api/tags/by-tag-id/ST-DOES-NOT-EXIST-999")
    assert r.status_code == 404


def test_lookup_tag_requires_auth():
    r = requests.get(f"{BASE_URL}/api/tags/by-tag-id/anything", timeout=10)
    assert r.status_code == 401
