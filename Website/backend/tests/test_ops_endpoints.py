"""Test suite for NEW operations endpoints (Round 3):
check-in/check-out/cleaning-done, tag report-damaged/missing,
gateway test, front-desk dashboard, billing note.
"""
import os
import time
import requests
import pytest

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
    assert r.status_code == 200, f"Login {role}: {r.status_code} {r.text}"
    s.headers.update({"Authorization": f"Bearer {r.json()['access_token']}"})
    return s


@pytest.fixture(scope="module")
def admin():
    return _login("super_admin")


@pytest.fixture(scope="module")
def hotel():
    return _login("hotel_admin")


@pytest.fixture(scope="module")
def reception():
    return _login("reception")


@pytest.fixture(scope="module")
def housekeeping():
    return _login("housekeeping")


@pytest.fixture(scope="module")
def technician():
    return _login("technician")


def _find_room(admin, statuses=("vacant", "cleaning")):
    rooms = admin.get(f"{BASE_URL}/api/rooms", timeout=10).json()
    for r in rooms:
        if r["status"] in statuses:
            return r
    return None


# ============ Front Desk Ops Dashboard ============
class TestFrontDesk:
    def test_front_desk_reception(self, reception):
        r = reception.get(f"{BASE_URL}/api/operations/front-desk", timeout=15)
        assert r.status_code == 200, r.text
        d = r.json()
        for k in ("rooms", "rooms_by_status", "occupied_count",
                  "vacant_count", "cleaning_count", "checkout_pending_count",
                  "pending_bills", "today_revenue", "folio_by_room"):
            assert k in d, f"missing key {k} in front-desk payload"
        assert isinstance(d["rooms"], list) and len(d["rooms"]) >= 6
        assert isinstance(d["today_revenue"], (int, float))

    def test_front_desk_hotel_admin(self, hotel):
        r = hotel.get(f"{BASE_URL}/api/operations/front-desk", timeout=15)
        assert r.status_code == 200

    def test_front_desk_super_admin(self, admin):
        r = admin.get(f"{BASE_URL}/api/operations/front-desk", timeout=15)
        assert r.status_code == 200

    def test_front_desk_forbidden_housekeeping(self, housekeeping):
        r = housekeeping.get(f"{BASE_URL}/api/operations/front-desk", timeout=10)
        assert r.status_code == 403

    def test_front_desk_forbidden_technician(self, technician):
        r = technician.get(f"{BASE_URL}/api/operations/front-desk", timeout=10)
        assert r.status_code == 403


# ============ Room workflow: check-in / check-out / cleaning-done ============
class TestRoomWorkflow:
    def test_full_lifecycle(self, admin, reception, housekeeping, hotel):
        # Find a vacant room
        room = _find_room(admin)
        assert room, "Need at least one vacant room in seed"
        rid = room["id"]
        _ = room["room_number"]

        # CHECK-IN — guest_name required
        r_bad = reception.post(f"{BASE_URL}/api/rooms/{rid}/check-in",
                               json={"guest_name": ""}, timeout=10)
        assert r_bad.status_code == 400

        r_ci = reception.post(f"{BASE_URL}/api/rooms/{rid}/check-in",
                              json={"guest_name": "TEST_Guest_Smith", "notes": "VIP"}, timeout=10)
        assert r_ci.status_code == 200, r_ci.text
        room_after = r_ci.json()
        assert room_after["status"] == "occupied"
        assert room_after["guest_name"] == "TEST_Guest_Smith"
        assert room_after.get("guest_check_in_at")

        # Cannot check-in occupied room
        r_dup = reception.post(f"{BASE_URL}/api/rooms/{rid}/check-in",
                               json={"guest_name": "TEST_X"}, timeout=10)
        assert r_dup.status_code == 400

        # CHECK-OUT
        r_co = reception.post(f"{BASE_URL}/api/rooms/{rid}/check-out", timeout=10)
        assert r_co.status_code == 200, r_co.text
        d = r_co.json()
        for k in ("room", "folio_items", "subtotal", "tax", "total"):
            assert k in d
        assert d["room"]["status"] == "checkout_pending"

        # Cannot check-out twice
        r_co2 = reception.post(f"{BASE_URL}/api/rooms/{rid}/check-out", timeout=10)
        assert r_co2.status_code == 400

        # CLEANING-DONE (need housekeeping role — but room must be reachable; cleaning-done works from any status per route)
        # Set to cleaning first via PATCH
        hotel.patch(f"{BASE_URL}/api/rooms/{rid}", json={"status": "cleaning"}, timeout=10)
        r_cl = housekeeping.post(f"{BASE_URL}/api/rooms/{rid}/cleaning-done", timeout=10)
        assert r_cl.status_code == 200, r_cl.text
        rfinal = r_cl.json()
        assert rfinal["status"] == "vacant"
        assert rfinal.get("guest_name") in (None, "")

    def test_check_in_rbac_housekeeping_denied(self, housekeeping, admin):
        room = _find_room(admin)
        if not room:
            pytest.skip("no vacant room")
        r = housekeeping.post(f"{BASE_URL}/api/rooms/{room['id']}/check-in",
                              json={"guest_name": "TEST_X"}, timeout=10)
        assert r.status_code == 403

    def test_check_in_room_not_found(self, reception):
        r = reception.post(f"{BASE_URL}/api/rooms/NONEXISTENT/check-in",
                           json={"guest_name": "X"}, timeout=10)
        assert r.status_code == 404

    def test_cleaning_done_rbac_reception_denied(self, reception, admin):
        room = _find_room(admin, statuses=("vacant",))
        if not room:
            pytest.skip("no room")
        r = reception.post(f"{BASE_URL}/api/rooms/{room['id']}/cleaning-done", timeout=10)
        assert r.status_code == 403


# ============ Tag report-damaged / missing ============
class TestTagReports:
    def test_report_damaged(self, hotel, admin):
        tags = admin.get(f"{BASE_URL}/api/tags", timeout=10).json()
        # Pick an unassigned one so we don't corrupt the demo
        tag = next((t for t in tags if t.get("status") in ("active", "inactive")), tags[0])
        r = hotel.post(f"{BASE_URL}/api/tags/{tag['id']}/report-damaged",
                       json={"reason": "TEST cracked casing"}, timeout=10)
        assert r.status_code == 200, r.text
        d = r.json()
        assert d["status"] == "faulty"
        assert "TEST cracked casing" in (d.get("notes") or "")
        # restore
        hotel.post(f"{BASE_URL}/api/tags/{tag['id']}/restock",
                   json={"tag_id": tag["tag_id"], "notes": "TEST_reset"}, timeout=10)

    def test_report_missing(self, hotel, admin):
        tags = admin.get(f"{BASE_URL}/api/tags", timeout=10).json()
        tag = tags[1]
        r = hotel.post(f"{BASE_URL}/api/tags/{tag['id']}/report-missing",
                       json={"reason": "TEST not found in room 102"}, timeout=10)
        assert r.status_code == 200, r.text
        d = r.json()
        assert d["status"] == "lost"
        # restore
        hotel.post(f"{BASE_URL}/api/tags/{tag['id']}/restock",
                   json={"tag_id": tag["tag_id"], "notes": "TEST_reset"}, timeout=10)

    def test_report_damaged_rbac_reception_denied(self, reception, admin):
        tags = admin.get(f"{BASE_URL}/api/tags", timeout=10).json()
        r = reception.post(f"{BASE_URL}/api/tags/{tags[0]['id']}/report-damaged",
                           json={"reason": "TEST"}, timeout=10)
        assert r.status_code == 403

    def test_report_damaged_not_found(self, hotel):
        r = hotel.post(f"{BASE_URL}/api/tags/DOES_NOT_EXIST/report-damaged",
                       json={"reason": "x"}, timeout=10)
        assert r.status_code == 404


# ============ Gateway diagnostics test ============
class TestGatewayDiag:
    def test_gateway_test(self, hotel, admin):
        gws = admin.get(f"{BASE_URL}/api/gateways", timeout=10).json()
        gw = gws[0]
        r = hotel.post(f"{BASE_URL}/api/gateways/{gw['id']}/test", timeout=15)
        assert r.status_code == 200, r.text
        d = r.json()
        for k in ("ok", "gateway_id", "mac_address", "rssi", "tags_detected",
                  "low_battery_tags", "tags", "firmware_version",
                  "last_online", "server_time", "config"):
            assert k in d, f"missing {k}"
        assert d["ok"] is True
        assert isinstance(d["tags"], list)

    def test_gateway_test_technician_allowed(self, technician, admin):
        gws = admin.get(f"{BASE_URL}/api/gateways", timeout=10).json()
        r = technician.post(f"{BASE_URL}/api/gateways/{gws[0]['id']}/test", timeout=15)
        assert r.status_code == 200

    def test_gateway_test_reception_denied(self, reception, admin):
        gws = admin.get(f"{BASE_URL}/api/gateways", timeout=10).json()
        r = reception.post(f"{BASE_URL}/api/gateways/{gws[0]['id']}/test", timeout=10)
        assert r.status_code == 403

    def test_gateway_test_not_found(self, hotel):
        r = hotel.post(f"{BASE_URL}/api/gateways/NONEXISTENT/test", timeout=10)
        assert r.status_code == 404


# ============ Billing note ============
class TestBillingNote:
    def test_add_note(self, admin, reception):
        # need a usage_event - get any
        events = admin.get(f"{BASE_URL}/api/billing/events", timeout=10).json()
        if not events:
            pytest.skip("no usage events available")
        eid = events[0]["id"]
        r = reception.post(f"{BASE_URL}/api/billing/{eid}/note",
                           json={"note": "TEST_note guest confirmed"}, timeout=10)
        assert r.status_code == 200, r.text
        d = r.json()
        assert "TEST_note guest confirmed" in (d.get("notes") or "")

    def test_note_required(self, reception, admin):
        events = admin.get(f"{BASE_URL}/api/billing/events", timeout=10).json()
        if not events:
            pytest.skip("no events")
        r = reception.post(f"{BASE_URL}/api/billing/{events[0]['id']}/note",
                           json={"note": ""}, timeout=10)
        assert r.status_code == 400

    def test_note_not_found(self, reception):
        r = reception.post(f"{BASE_URL}/api/billing/MISSING_ID/note",
                           json={"note": "x"}, timeout=10)
        assert r.status_code == 404

    def test_note_rbac_housekeeping_denied(self, housekeeping, admin):
        events = admin.get(f"{BASE_URL}/api/billing/events", timeout=10).json()
        if not events:
            pytest.skip("no events")
        r = housekeeping.post(f"{BASE_URL}/api/billing/{events[0]['id']}/note",
                              json={"note": "x"}, timeout=10)
        assert r.status_code == 403
