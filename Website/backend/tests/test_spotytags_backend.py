"""SpotyTags backend comprehensive test suite.

Covers: auth, RBAC, dashboard, rooms, tags, gateways, products, billing,
license, notifications, audit, reports, settings, users, gateway BLE flow.
"""
import os
import time
import pytest
import requests

BASE_URL = os.environ["REACT_APP_BACKEND_URL"].rstrip("/")
if not BASE_URL.startswith("http"):
    BASE_URL = "https://" + BASE_URL

CREDS = {
    "super_admin":  ("admin@spotytags.com",        "Admin@123"),
    "hotel_admin":  ("hotel.admin@spotytags.com",  "Hotel@123"),
    "reception":    ("reception@spotytags.com",    "Recep@123"),
    "housekeeping": ("housekeeping@spotytags.com", "House@123"),
    "technician":   ("tech@spotytags.com",         "Tech@123"),
}


def _login(role: str) -> requests.Session:
    s = requests.Session()
    email, password = CREDS[role]
    r = s.post(f"{BASE_URL}/api/auth/login", json={"email": email, "password": password}, timeout=15)
    assert r.status_code == 200, f"Login failed for {role}: {r.status_code} {r.text}"
    data = r.json()
    assert "user" in data and "access_token" in data
    assert data["user"]["role"] == role
    # Bearer header fallback (cookie also set)
    s.headers.update({"Authorization": f"Bearer {data['access_token']}"})
    return s


# ============ Fixtures ============
@pytest.fixture(scope="session")
def admin_session():
    return _login("super_admin")


@pytest.fixture(scope="session")
def hotel_admin_session():
    return _login("hotel_admin")


@pytest.fixture(scope="session")
def reception_session():
    return _login("reception")


@pytest.fixture(scope="session")
def housekeeping_session():
    return _login("housekeeping")


@pytest.fixture(scope="session")
def technician_session():
    return _login("technician")


# ============ Auth ============
class TestAuth:
    def test_health(self):
        r = requests.get(f"{BASE_URL}/api/health", timeout=10)
        assert r.status_code == 200
        assert r.json().get("status") == "ok"

    def test_login_success_super_admin(self):
        s = requests.Session()
        r = s.post(f"{BASE_URL}/api/auth/login",
                   json={"email": "admin@spotytags.com", "password": "Admin@123"}, timeout=10)
        assert r.status_code == 200
        data = r.json()
        assert data["user"]["email"] == "admin@spotytags.com"
        assert data["user"]["role"] == "super_admin"
        assert "access_token" in data
        # httpOnly cookies set
        cookies = {c.name: c for c in s.cookies}
        assert "access_token" in cookies
        assert "refresh_token" in cookies

    def test_login_invalid(self):
        r = requests.post(f"{BASE_URL}/api/auth/login",
                          json={"email": "admin@spotytags.com", "password": "wrong"}, timeout=10)
        assert r.status_code == 401

    @pytest.mark.parametrize("role", list(CREDS.keys()))
    def test_login_all_roles(self, role):
        s = _login(role)
        r = s.get(f"{BASE_URL}/api/auth/me", timeout=10)
        assert r.status_code == 200
        assert r.json()["role"] == role

    def test_me_unauthenticated(self):
        r = requests.get(f"{BASE_URL}/api/auth/me", timeout=10)
        assert r.status_code == 401

    def test_logout(self, admin_session):
        # Use a fresh session so we don't kill our admin_session fixture
        s = _login("super_admin")
        r = s.post(f"{BASE_URL}/api/auth/logout", timeout=10)
        assert r.status_code == 200


# ============ RBAC ============
class TestRBAC:
    def test_reception_cannot_create_room(self, reception_session):
        import secrets
        room_num = f"TEST-RBAC-{secrets.token_hex(3)}"
        r = reception_session.post(f"{BASE_URL}/api/rooms",
                                   json={"room_number": room_num, "floor": "9", "room_type": "Test"}, timeout=10)
        # Spec: reception cannot create rooms (only hotel_admin/super_admin)
        # Implementation note: routes_core grants reception this perm — spec violation
        assert r.status_code == 403, f"SPEC VIOLATION: reception got {r.status_code} for POST /api/rooms (expected 403)"

    def test_housekeeping_cannot_create_product(self, housekeeping_session):
        r = housekeeping_session.post(f"{BASE_URL}/api/products",
                                      json={"name": "TEST_X", "category": "water", "selling_price": 10},
                                      timeout=10)
        assert r.status_code == 403

    def test_technician_cannot_list_users(self, technician_session):
        r = technician_session.get(f"{BASE_URL}/api/users", timeout=10)
        assert r.status_code == 403


# ============ Dashboard ============
class TestDashboard:
    def test_kpi(self, admin_session):
        r = admin_session.get(f"{BASE_URL}/api/dashboard/kpi", timeout=10)
        assert r.status_code == 200
        d = r.json()
        for key in ("total_rooms", "active_tags", "license_status", "license_expiry"):
            assert key in d
        assert d["total_rooms"] >= 6
        assert d["active_tags"] >= 1

    def test_recent(self, admin_session):
        r = admin_session.get(f"{BASE_URL}/api/dashboard/recent", timeout=10)
        assert r.status_code == 200
        d = r.json()
        assert "audits" in d and "events" in d


# ============ Rooms ============
class TestRooms:
    def test_list_rooms(self, admin_session):
        r = admin_session.get(f"{BASE_URL}/api/rooms", timeout=10)
        assert r.status_code == 200
        rooms = r.json()
        assert len(rooms) >= 6

    def test_get_room_detail(self, admin_session):
        rooms = admin_session.get(f"{BASE_URL}/api/rooms").json()
        rid = rooms[0]["id"]
        r = admin_session.get(f"{BASE_URL}/api/rooms/{rid}", timeout=10)
        assert r.status_code == 200
        d = r.json()
        assert "tags" in d
        assert d["id"] == rid

    def test_room_crud(self, hotel_admin_session):
        # CREATE
        payload = {"room_number": "TEST-901", "floor": "9", "room_type": "Test"}
        r = hotel_admin_session.post(f"{BASE_URL}/api/rooms", json=payload, timeout=10)
        assert r.status_code == 200, r.text
        room = r.json()
        rid = room["id"]
        assert room["room_number"] == "TEST-901"
        # UPDATE
        r2 = hotel_admin_session.patch(f"{BASE_URL}/api/rooms/{rid}",
                                       json={"status": "occupied", "guest_name": "TEST_Guest"}, timeout=10)
        assert r2.status_code == 200
        assert r2.json()["guest_name"] == "TEST_Guest"
        # GET verify
        r3 = hotel_admin_session.get(f"{BASE_URL}/api/rooms/{rid}", timeout=10)
        assert r3.json()["status"] == "occupied"
        # DELETE
        r4 = hotel_admin_session.delete(f"{BASE_URL}/api/rooms/{rid}", timeout=10)
        assert r4.status_code == 200
        r5 = hotel_admin_session.get(f"{BASE_URL}/api/rooms/{rid}", timeout=10)
        assert r5.status_code == 404


# ============ Tags ============
class TestTags:
    def test_list_tags_enriched(self, admin_session):
        r = admin_session.get(f"{BASE_URL}/api/tags", timeout=10)
        assert r.status_code == 200
        tags = r.json()
        assert len(tags) >= 12
        # check enrichment
        assigned = [t for t in tags if t.get("assigned_product_id")]
        assert assigned
        assert any(t.get("product_name") for t in assigned)
        assert any(t.get("room_number") for t in assigned)

    def test_restock_tag(self, housekeeping_session, admin_session):
        tags = admin_session.get(f"{BASE_URL}/api/tags").json()
        tag = next(t for t in tags if t.get("assigned_product_id"))
        r = housekeeping_session.post(f"{BASE_URL}/api/tags/{tag['id']}/restock",
                                      json={"tag_id": tag["tag_id"], "notes": "TEST_restock"}, timeout=10)
        assert r.status_code == 200
        assert r.json()["status"] == "active"


# ============ Gateways ============
class TestGateways:
    def test_list_gateways(self, admin_session):
        r = admin_session.get(f"{BASE_URL}/api/gateways", timeout=10)
        assert r.status_code == 200
        gws = r.json()
        assert len(gws) >= 4

    def test_get_gateway_includes_api_key(self, admin_session):
        gws = admin_session.get(f"{BASE_URL}/api/gateways").json()
        gid = gws[0]["id"]
        r = admin_session.get(f"{BASE_URL}/api/gateways/{gid}", timeout=10)
        assert r.status_code == 200
        d = r.json()
        assert d.get("api_key", "").startswith("gw_")


# ============ Products ============
class TestProducts:
    def test_list_products(self, admin_session):
        r = admin_session.get(f"{BASE_URL}/api/products", timeout=10)
        assert r.status_code == 200
        assert len(r.json()) >= 5

    def test_product_crud(self, hotel_admin_session):
        r = hotel_admin_session.post(f"{BASE_URL}/api/products",
                                     json={"name": "TEST_Product", "category": "snack",
                                           "selling_price": 99.0}, timeout=10)
        assert r.status_code == 200, r.text
        pid = r.json()["id"]
        r2 = hotel_admin_session.patch(f"{BASE_URL}/api/products/{pid}",
                                       json={"selling_price": 199.0}, timeout=10)
        assert r2.status_code == 200
        assert r2.json()["selling_price"] == 199.0
        r3 = hotel_admin_session.delete(f"{BASE_URL}/api/products/{pid}", timeout=10)
        assert r3.status_code == 200


# ============ Billing + Tamper ============
class TestBillingAndTamper:
    def test_simulate_tamper_creates_pending(self, admin_session, reception_session):
        # Find an assigned tag
        tags = admin_session.get(f"{BASE_URL}/api/tags").json()
        tag = next(t for t in tags if t.get("assigned_product_id") and t.get("assigned_room_id"))
        before = len(admin_session.get(f"{BASE_URL}/api/billing/pending").json())
        r = admin_session.post(f"{BASE_URL}/api/demo/simulate-tamper",
                               json={"tag_id": tag["id"]}, timeout=15)
        assert r.status_code == 200, r.text
        time.sleep(1)
        after_list = admin_session.get(f"{BASE_URL}/api/billing/pending").json()
        assert len(after_list) >= before + 1
        # confirm one
        evt_id = after_list[0]["id"]
        r2 = reception_session.post(f"{BASE_URL}/api/billing/{evt_id}/action",
                                    json={"action": "confirm", "notes": "TEST_confirm"}, timeout=10)
        assert r2.status_code == 200, r2.text
        assert r2.json()["status"] == "confirmed"

    def test_billing_lists(self, admin_session):
        for path in ("pending", "confirmed", "events"):
            r = admin_session.get(f"{BASE_URL}/api/billing/{path}", timeout=10)
            assert r.status_code == 200, f"{path}: {r.text}"
            assert isinstance(r.json(), list)

    def test_manual_bill(self, reception_session, admin_session):
        rooms = admin_session.get(f"{BASE_URL}/api/rooms").json()
        products = admin_session.get(f"{BASE_URL}/api/products").json()
        r = reception_session.post(f"{BASE_URL}/api/billing/manual",
                                   json={"room_id": rooms[0]["id"], "product_id": products[0]["id"],
                                         "notes": "TEST_manual"}, timeout=10)
        assert r.status_code == 200, r.text
        assert r.json()["status"] == "confirmed"


# ============ Gateway BLE event ============
class TestGatewayBLE:
    def test_ble_event_tamper_edge_creates_one_bill(self, admin_session):
        # Pick a gateway with an assigned room
        gws = admin_session.get(f"{BASE_URL}/api/gateways").json()
        # GW-101 -> room 101 in seed
        gw101 = next((g for g in gws if g["gateway_id"] == "GW-101"), gws[0])
        detail = admin_session.get(f"{BASE_URL}/api/gateways/{gw101['id']}").json()
        api_key = detail["api_key"]
        room_id = detail.get("room_id")
        assert room_id

        # Find a tag assigned to that room
        tags = admin_session.get(f"{BASE_URL}/api/tags").json()
        target_tag = next((t for t in tags if t.get("assigned_room_id") == room_id and t.get("assigned_product_id")), None)
        assert target_tag, "No tag assigned to GW-101 room"
        # Reset tamper via restock first
        s = _login("hotel_admin")
        s.post(f"{BASE_URL}/api/tags/{target_tag['id']}/restock",
               json={"tag_id": target_tag["tag_id"], "notes": "reset"}, timeout=10)
        # Confirm/waive any existing pending bill for this tag to clear idempotency lock
        pending = admin_session.get(f"{BASE_URL}/api/billing/pending").json()
        for e in pending:
            if e.get("tag_db_id") == target_tag["id"]:
                admin_session.post(f"{BASE_URL}/api/billing/{e['id']}/action",
                                   json={"action": "waive", "notes": "TEST_reset"}, timeout=10)

        before = len(admin_session.get(f"{BASE_URL}/api/billing/pending").json())

        # Send tamper=true (edge: false -> true)
        body = {
            "gateway_id": gw101["gateway_id"], "api_key": api_key,
            "tag_id": target_tag["tag_id"], "ble_mac": target_tag["ble_mac"],
            "rssi": -60, "battery": 90, "tamper_status": True, "gpio_status": 1,
        }
        r1 = requests.post(f"{BASE_URL}/api/gateway/ble-event", json=body, timeout=10)
        assert r1.status_code == 200, r1.text
        time.sleep(1)
        mid = len(admin_session.get(f"{BASE_URL}/api/billing/pending").json())
        assert mid >= before + 1, "First tamper edge should create a pending bill"

        # Send tamper=true again - should NOT create duplicate
        r2 = requests.post(f"{BASE_URL}/api/gateway/ble-event", json=body, timeout=10)
        assert r2.status_code == 200
        time.sleep(1)
        after = len(admin_session.get(f"{BASE_URL}/api/billing/pending").json())
        assert after == mid, "Repeated tamper=true should NOT create another bill"

    def test_ble_event_invalid_api_key(self):
        r = requests.post(f"{BASE_URL}/api/gateway/ble-event",
                          json={"gateway_id": "GW-101", "api_key": "bad",
                                "tag_id": "X", "ble_mac": "00:00:00:00:00:00",
                                "rssi": -50, "battery": 100, "tamper_status": False, "gpio_status": 0},
                          timeout=10)
        assert r.status_code == 401


# ============ License ============
class TestLicense:
    def test_current(self, admin_session):
        r = admin_session.get(f"{BASE_URL}/api/license/current", timeout=10)
        assert r.status_code == 200
        d = r.json()
        assert d.get("plan")
        assert d.get("room_limit")

    def test_plans(self, admin_session):
        r = admin_session.get(f"{BASE_URL}/api/license/plans", timeout=10)
        assert r.status_code == 200
        assert isinstance(r.json(), list)


# ============ Notifications + Audit + Reports + Settings ============
class TestMisc:
    def test_notifications(self, admin_session):
        r = admin_session.get(f"{BASE_URL}/api/notifications", timeout=10)
        assert r.status_code == 200
        assert isinstance(r.json(), list)

    def test_audit(self, admin_session):
        r = admin_session.get(f"{BASE_URL}/api/audit", timeout=10)
        assert r.status_code == 200
        assert isinstance(r.json(), list)

    def test_reports(self, admin_session):
        for path in ("/api/reports/revenue", "/api/reports/item-consumption", "/api/reports/room-consumption"):
            r = admin_session.get(f"{BASE_URL}{path}", timeout=15)
            assert r.status_code == 200, f"{path}: {r.text}"

    def test_settings_theme(self, hotel_admin_session):
        r = hotel_admin_session.get(f"{BASE_URL}/api/settings/theme", timeout=10)
        assert r.status_code == 200
        r2 = hotel_admin_session.put(f"{BASE_URL}/api/settings/theme",
                                     json={"theme": "ocean"}, timeout=10)
        assert r2.status_code == 200

    def test_cloud_sync(self, admin_session):
        r = admin_session.get(f"{BASE_URL}/api/settings/cloud-sync", timeout=10)
        assert r.status_code == 200
        r2 = admin_session.post(f"{BASE_URL}/api/settings/cloud-sync/trigger", timeout=15)
        assert r2.status_code == 200


# ============ Users CRUD ============
class TestUsers:
    def test_users_crud(self, admin_session):
        r = admin_session.get(f"{BASE_URL}/api/users", timeout=10)
        assert r.status_code == 200
        assert len(r.json()) >= 5
        # create
        payload = {"email": "TEST_user@example.com", "name": "TEST",
                   "password": "Test@1234", "role": "reception"}
        cr = admin_session.post(f"{BASE_URL}/api/users", json=payload, timeout=10)
        if cr.status_code == 409:
            # cleanup any leftover
            users = admin_session.get(f"{BASE_URL}/api/users").json()
            uid = next(u["id"] for u in users if u["email"] == "TEST_user@example.com")
            admin_session.delete(f"{BASE_URL}/api/users/{uid}")
            cr = admin_session.post(f"{BASE_URL}/api/users", json=payload, timeout=10)
        assert cr.status_code == 200, cr.text
        uid = cr.json()["id"]
        # delete
        dr = admin_session.delete(f"{BASE_URL}/api/users/{uid}", timeout=10)
        assert dr.status_code == 200
