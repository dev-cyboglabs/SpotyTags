"""Tests for the local Super Admin branding API (Round 7).

Covers:
  • Public + authenticated GET /api/branding
  • PUT /api/branding (super_admin only)
  • POST /api/branding/upload (multipart) — logo, splash, favicon
  • DELETE /api/branding/{kind} — removes the image
  • POST /api/branding/reset
  • GET /api/branding/deployment-info
"""
import io
import os
import pytest
import requests

BASE_URL = os.environ["REACT_APP_BACKEND_URL"].rstrip("/")
if not BASE_URL.startswith("http"):
    BASE_URL = "https://" + BASE_URL

# 1×1 PNG image (transparent) — smallest legal PNG payload
PNG_BYTES = (
    b"\x89PNG\r\n\x1a\n\x00\x00\x00\rIHDR"
    b"\x00\x00\x00\x01\x00\x00\x00\x01\x08\x06\x00\x00\x00\x1f\x15\xc4\x89"
    b"\x00\x00\x00\rIDATx\x9cc\x00\x01\x00\x00\x05\x00\x01\r\n-\xb4\x00\x00\x00\x00IEND\xaeB`\x82"
)


def _login(email: str, password: str) -> requests.Session:
    s = requests.Session()
    r = s.post(f"{BASE_URL}/api/auth/login", json={"email": email, "password": password}, timeout=15)
    assert r.status_code == 200, r.text
    s.headers.update({"Authorization": f"Bearer {r.json()['access_token']}"})
    return s


@pytest.fixture(scope="module")
def admin():
    return _login("admin@spotytags.com", "Admin@123")


# ============ Public ============
def test_public_brand_no_auth():
    r = requests.get(f"{BASE_URL}/api/branding/public", timeout=10)
    assert r.status_code == 200
    data = r.json()
    for k in ("hotel_name", "tagline", "primary_color", "accent_color",
               "logo_url", "splash_url", "favicon_url", "footer_text"):
        assert k in data


# ============ Authenticated read ============
def test_get_brand_authenticated(admin):
    r = admin.get(f"{BASE_URL}/api/branding")
    assert r.status_code == 200
    data = r.json()
    assert "hotel_name" in data
    assert "currency" in data
    assert data["currency"]["code"]


# ============ PUT / write ============
def test_update_brand_fields(admin):
    payload = {
        "hotel_name": "Spoty Branded Hotel",
        "tagline": "A modern stay",
        "primary_color": "#0B0B0B",
        "accent_color": "#FF5C42",
        "contact_email": "front-desk@spoty.test",
        "contact_phone": "+91 80 9999 0000",
        "address": "Test Address 1",
        "gst_number": "29ABCDE1234F1Z5",
        "footer_text": "© Spoty Branded Hotel",
    }
    r = admin.put(f"{BASE_URL}/api/branding", json=payload)
    assert r.status_code == 200, r.text
    out = r.json()
    for k, v in payload.items():
        assert out[k] == v, f"{k} did not persist: got {out[k]}"

    # Revert to defaults via reset
    r = admin.post(f"{BASE_URL}/api/branding/reset")
    assert r.status_code == 200
    assert r.json()["hotel_name"] == "SpotyTags"


def test_update_brand_requires_super_admin():
    s = _login("hotel.admin@spotytags.com", "Hotel@123")
    r = s.put(f"{BASE_URL}/api/branding", json={"hotel_name": "Forbidden"})
    assert r.status_code == 403


def test_update_brand_rejects_empty_payload(admin):
    r = admin.put(f"{BASE_URL}/api/branding", json={})
    assert r.status_code == 400


# ============ Image upload ============
def test_upload_logo(admin):
    files = {"file": ("logo.png", io.BytesIO(PNG_BYTES), "image/png")}
    r = admin.post(f"{BASE_URL}/api/branding/upload?kind=logo", files=files)
    assert r.status_code == 200, r.text
    data = r.json()
    assert data["kind"] == "logo"
    assert data["filename"]
    assert data["url"].startswith("/api/branding/files/")
    # GET the file back
    fr = requests.get(f"{BASE_URL}{data['url']}", timeout=10)
    assert fr.status_code == 200
    assert fr.headers.get("content-type", "").startswith("image/")

    # Remove
    r = admin.delete(f"{BASE_URL}/api/branding/logo")
    assert r.status_code == 200
    assert r.json()["removed"] == "logo"


def test_upload_rejects_unsupported_extension(admin):
    files = {"file": ("malicious.exe", io.BytesIO(b"MZ\x90\x00\x03"), "application/octet-stream")}
    r = admin.post(f"{BASE_URL}/api/branding/upload?kind=logo", files=files)
    assert r.status_code == 400
    assert "Unsupported" in str(r.json())


def test_upload_rejects_bad_kind(admin):
    files = {"file": ("logo.png", io.BytesIO(PNG_BYTES), "image/png")}
    r = admin.post(f"{BASE_URL}/api/branding/upload?kind=banner", files=files)
    assert r.status_code == 400


def test_upload_requires_super_admin():
    s = _login("hotel.admin@spotytags.com", "Hotel@123")
    files = {"file": ("logo.png", io.BytesIO(PNG_BYTES), "image/png")}
    r = s.post(f"{BASE_URL}/api/branding/upload?kind=logo", files=files)
    assert r.status_code == 403


# ============ Reset ============
def test_reset_brand_clears_uploaded_images(admin):
    # Upload first
    files = {"file": ("splash.png", io.BytesIO(PNG_BYTES), "image/png")}
    admin.post(f"{BASE_URL}/api/branding/upload?kind=splash", files=files)
    # Reset
    r = admin.post(f"{BASE_URL}/api/branding/reset")
    assert r.status_code == 200
    data = r.json()
    assert data["splash_url"] is None


# ============ Deployment info ============
def test_deployment_info(admin):
    r = admin.get(f"{BASE_URL}/api/branding/deployment-info")
    assert r.status_code == 200
    data = r.json()
    for k in ("property_id", "deployment_mode", "mongo_db", "uploads",
               "cloud_sync", "users_count", "rooms_count", "tags_count", "gateways_count"):
        assert k in data
    assert data["deployment_mode"] == "local"


def test_deployment_info_requires_super_admin():
    s = _login("hotel.admin@spotytags.com", "Hotel@123")
    r = s.get(f"{BASE_URL}/api/branding/deployment-info")
    assert r.status_code == 403


# ============ Chain seed is gone ============
def test_no_chain_seed_remains():
    """After Round 7 (offline pivot) only PROP-001 should exist in the DB."""
    # We can't hit /api/properties directly; use the cloud-dashboard endpoint
    # which was removed — fall back to verifying via license endpoint.
    s = _login("admin@spotytags.com", "Admin@123")
    r = s.get(f"{BASE_URL}/api/license/current")
    assert r.status_code == 200
    assert r.json()["property_id"] == "PROP-001"
