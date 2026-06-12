"""Admin routes - users, license, audit logs, settings, notifications."""
from __future__ import annotations

from datetime import datetime, timezone, timedelta
from typing import Optional, List

from fastapi import APIRouter, Depends, HTTPException

import auth as auth_mod
from db import get_db
from models import UserCreate, License, ThemeSettings, utc_now, new_id, PlanName
from realtime import manager, write_audit
from license_guard import license_validation_snapshot
from license_verifier import decrypt_license_doc, update_encrypted_license
import cloud_sync
import currencies

router = APIRouter(prefix="/api", tags=["admin"])


def _public_user(u: dict) -> dict:
    return {
        "id": u["id"], "email": u["email"], "name": u["name"], "role": u["role"],
        "property_id": u.get("property_id"), "active": u.get("active", True),
        "created_at": u.get("created_at"),
    }


# ============ Users ============
@router.get("/users")
async def list_users(user: dict = Depends(auth_mod.require_roles("super_admin", "hotel_admin"))):
    db = get_db()
    q = {} if user["role"] == "super_admin" else {"property_id": user["property_id"]}
    users = await db.users.find(q, {"_id": 0, "password_hash": 0}).sort("created_at", -1).to_list(1000)
    return users


@router.post("/users")
async def create_user(payload: UserCreate, current: dict = Depends(auth_mod.require_roles("super_admin", "hotel_admin"))):
    db = get_db()
    email = payload.email.lower()
    if await db.users.find_one({"email": email}):
        raise HTTPException(status_code=409, detail="Email already exists")
    target_property = payload.property_id or current.get("property_id")
    doc = {
        "id": new_id(),
        "email": email,
        "name": payload.name,
        "password_hash": auth_mod.hash_password(payload.password),
        "role": payload.role,
        "property_id": target_property,
        "active": True,
        "created_at": utc_now().isoformat(),
    }
    await db.users.insert_one(doc)
    doc.pop("_id", None)
    await write_audit(db, actor=current, action="create", entity_type="user", entity_id=doc["id"], description=f"Created user {email}")
    return _public_user(doc)


@router.patch("/users/{user_id}")
async def update_user(user_id: str, payload: dict, current: dict = Depends(auth_mod.require_roles("super_admin", "hotel_admin"))):
    db = get_db()
    allowed = {"name", "role", "active", "property_id"}
    updates = {k: v for k, v in payload.items() if k in allowed}
    if "password" in payload and payload["password"]:
        updates["password_hash"] = auth_mod.hash_password(payload["password"])
    if not updates:
        raise HTTPException(status_code=400, detail="No fields to update")
    res = await db.users.update_one({"id": user_id}, {"$set": updates})
    if res.matched_count == 0:
        raise HTTPException(status_code=404, detail="User not found")
    updated = await db.users.find_one({"id": user_id}, {"_id": 0, "password_hash": 0})
    await write_audit(db, actor=current, action="update", entity_type="user", entity_id=user_id, description=f"Updated user {updated['email']}")
    return updated


@router.delete("/users/{user_id}")
async def delete_user(user_id: str, current: dict = Depends(auth_mod.require_roles("super_admin", "hotel_admin"))):
    db = get_db()
    if user_id == current["id"]:
        raise HTTPException(status_code=400, detail="Cannot delete yourself")
    await db.users.delete_one({"id": user_id})
    await write_audit(db, actor=current, action="delete", entity_type="user", entity_id=user_id, description="Deleted user")
    return {"ok": True}


# ─── helpers ──────────────────────────────────────────────────────────────────

def _clean_license_response(lic: dict) -> dict:
    """Strip internal crypto fields before returning to the frontend."""
    for k in ("encrypted_data", "signature", "schema_version"):
        lic.pop(k, None)
    return lic


# ============ License ============
@router.get("/license/current")
async def current_license(user: dict = Depends(auth_mod.get_current_user)):
    db = get_db()
    raw = await db.licenses.find_one({"property_id": user["property_id"]}, {"_id": 0})
    if not raw:
        raise HTTPException(status_code=404, detail="No license found for this property")
    try:
        lic = decrypt_license_doc(raw)
    except ValueError:
        raise HTTPException(status_code=403, detail={
            "code": "license_tampered",
            "message": "License integrity check failed. Contact support.",
            "license_status": "tampered",
        })

    # Dynamically resolve property name and hotel group
    branding = await db.branding.find_one({"property_id": user["property_id"]})
    if branding and branding.get("hotel_name"):
        lic["property_name"] = branding["hotel_name"]
    else:
        prop = await db.properties.find_one({"id": user["property_id"]})
        if prop and prop.get("name"):
            lic["property_name"] = prop["name"]

    if branding and branding.get("hotel_group"):
        lic["hotel_group"] = branding["hotel_group"]
    else:
        lic["hotel_group"] = f"{lic.get('property_name', 'Unknown')} Group"

    # Compute usage
    rooms = await db.rooms.count_documents({"property_id": user["property_id"]})
    tags = await db.tags.count_documents({"property_id": user["property_id"]})
    gateways = await db.gateways.count_documents({"property_id": user["property_id"]})
    users = await db.users.count_documents({"property_id": user["property_id"]})
    lic["usage"] = {"rooms": rooms, "tags": tags, "gateways": gateways, "users": users}

    # Compute days remaining
    try:
        exp_raw = lic.get("expiry_date", "")
        exp = datetime.fromisoformat(str(exp_raw).replace("Z", "+00:00"))
        days_remaining = (exp - datetime.now(timezone.utc)).days
        lic["days_remaining"] = days_remaining
        if days_remaining < 0:
            lic["status"] = "expired"
        elif days_remaining <= 7:
            lic["status"] = "expiring_soon"
    except Exception:
        lic["days_remaining"] = 0

    return _clean_license_response(lic)


@router.get("/license/plans")
async def list_plans():
    return [
        {
            "id": "trial", "name": "Trial", "price": 0, "duration_days": 14,
            "room_limit": 10, "gateway_limit": 10, "tag_limit": 100, "user_limit": 5,
            "features": ["Basic reports", "Local server only", "Email support"],
            "not_included": ["PMS integration", "Cloud sync", "Theme customization"],
        },
        {
            "id": "starter", "name": "Starter", "price": 4999,
            "room_limit": 25, "gateway_limit": 25, "tag_limit": 250, "user_limit": 10,
            "features": ["Basic reports", "Theme customization", "Cloud sync", "Email support"],
            "not_included": ["PMS integration", "Multi-property", "Custom branding"],
        },
        {
            "id": "professional", "name": "Professional", "price": 9999,
            "room_limit": 100, "gateway_limit": 100, "tag_limit": 1000, "user_limit": 30,
            "features": ["Advanced reports", "Android app", "Theme customization", "PMS integration placeholder", "Cloud sync", "Priority support"],
            "not_included": ["Multi-property", "Custom branding"],
        },
        {
            "id": "enterprise", "name": "Enterprise", "price": None,
            "room_limit": 99999, "gateway_limit": 99999, "tag_limit": 99999, "user_limit": 99999,
            "features": ["All Professional features", "Multi-property", "Custom branding", "PMS integration", "Remote support", "Dedicated account manager"],
            "not_included": [],
        },
    ]


@router.post("/license/upgrade")
async def upgrade_plan(payload: dict, current: dict = Depends(auth_mod.require_roles("super_admin", "hotel_admin"))):
    db = get_db()
    plan: str = payload.get("plan", "")
    if plan not in {"trial", "starter", "professional", "enterprise"}:
        raise HTTPException(status_code=400, detail="Invalid plan")
    limits_map = {
        "trial": (10, 10, 100, 5, 14),
        "starter": (25, 25, 250, 10, 365),
        "professional": (100, 100, 1000, 30, 365),
        "enterprise": (99999, 99999, 99999, 99999, 365),
    }
    rl, gl, tl, ul, days = limits_map[plan]
    updates = {
        "plan": plan,
        "status": "active",
        "room_limit": rl,
        "gateway_limit": gl,
        "tag_limit": tl,
        "user_limit": ul,
        "expiry_date": (utc_now() + timedelta(days=days)).isoformat(),
        "updated_at": utc_now().isoformat(),
        "pms_enabled": plan in {"professional", "enterprise"},
        "theme_customization_enabled": plan in {"starter", "professional", "enterprise"},
    }
    try:
        await update_encrypted_license(db, current["property_id"], updates)
    except (LookupError, ValueError) as exc:
        raise HTTPException(status_code=400, detail=str(exc))
    await write_audit(db, actor=current, action="upgrade_plan", entity_type="license", description=f"Upgraded to {plan}")
    raw = await db.licenses.find_one({"property_id": current["property_id"]}, {"_id": 0})
    return _clean_license_response(decrypt_license_doc(raw))


# License extension endpoints removed for security.
# Use admin_extend_license.py script with ADMIN_API_KEY to extend licenses.


@router.get("/license/validate")
async def validate_license(user: dict = Depends(auth_mod.get_current_user)):
    """Pre-flight check: how much room is left in each quota + active warnings.
    The web/mobile UI uses this to render a banner and pre-disable add buttons."""
    db = get_db()
    return await license_validation_snapshot(db, user["property_id"])


# ============ Notifications ============
@router.delete("/notifications")
async def clear_all_notifications(user: dict = Depends(auth_mod.get_current_user)):
    db = get_db()
    await db.notifications.delete_many({"property_id": user["property_id"]})
    return {"ok": True}


@router.get("/notifications")
async def list_notifications(user: dict = Depends(auth_mod.get_current_user), limit: int = 50, unread_only: bool = False):
    db = get_db()
    q = {"property_id": user["property_id"]}
    if unread_only:
        q["read"] = False
    notifs = await db.notifications.find(q, {"_id": 0}).sort("created_at", -1).limit(limit).to_list(limit)
    return notifs


@router.post("/notifications/{notif_id}/read")
async def mark_read(notif_id: str, user: dict = Depends(auth_mod.get_current_user)):
    db = get_db()
    await db.notifications.update_one({"id": notif_id, "property_id": user["property_id"]}, {"$set": {"read": True}})
    return {"ok": True}


@router.post("/notifications/read-all")
async def mark_all_read(user: dict = Depends(auth_mod.get_current_user)):
    db = get_db()
    await db.notifications.update_many({"property_id": user["property_id"], "read": False}, {"$set": {"read": True}})
    return {"ok": True}


# ============ Audit ============
@router.get("/audit")
async def list_audit(user: dict = Depends(auth_mod.require_roles("super_admin", "hotel_admin")), limit: int = 200):
    db = get_db()
    q = {"property_id": user["property_id"]}
    logs = await db.audit_logs.find(q, {"_id": 0}).sort("created_at", -1).limit(limit).to_list(limit)
    return logs


# ============ Currency / Locale ============
@router.get("/settings/currency")
async def get_currency(user: dict = Depends(auth_mod.get_current_user)):
    """Return the property's currency config + the list of supported currencies."""
    db = get_db()
    prop = await db.properties.find_one({"id": user["property_id"]}, {"_id": 0}) or {}
    code = prop.get("currency_code") or currencies.DEFAULT_CURRENCY
    current = currencies.by_code(code) or currencies.by_code(currencies.DEFAULT_CURRENCY)
    return {
        "current": current,
        "country": prop.get("country"),
        "timezone": prop.get("timezone", "Asia/Kolkata"),
        "available": currencies.CURRENCIES,
    }


@router.put("/settings/currency")
async def update_currency(payload: dict,
                          current: dict = Depends(auth_mod.require_roles("hotel_admin", "super_admin"))):
    db = get_db()
    code = (payload.get("currency_code") or "").upper()
    cur = currencies.by_code(code)
    if not cur:
        raise HTTPException(status_code=400, detail={
            "code": "invalid_currency",
            "message": f"Unsupported currency code: {code}",
            "supported": [c["code"] for c in currencies.CURRENCIES],
        })
    updates = {
        "currency_code": cur["code"],
        "currency_symbol": cur["symbol"],
        "currency_locale": cur["locale"],
        "currency_decimals": cur["decimals"],
    }
    if payload.get("country"):
        updates["country"] = payload["country"]
    if payload.get("timezone"):
        updates["timezone"] = payload["timezone"]
    await db.properties.update_one(
        {"id": current["property_id"]},
        {"$set": updates},
        upsert=True,
    )
    await write_audit(
        db, actor=current, action="update_currency", entity_type="settings",
        description=f"Currency set to {cur['code']} ({cur['name']})",
        metadata=updates,
    )
    await manager.broadcast("currency_updated", updates)
    return {"current": cur, **updates}


# ============ Settings (Theme + Local server + Cloud sync) ============
@router.get("/settings/theme")
async def get_theme(user: dict = Depends(auth_mod.get_current_user)):
    db = get_db()
    settings = await db.theme_settings.find_one({"property_id": user["property_id"]}, {"_id": 0})
    if not settings:
        return ThemeSettings().model_dump()
    return settings


@router.put("/settings/theme")
async def update_theme(payload: ThemeSettings, current: dict = Depends(auth_mod.require_roles("hotel_admin", "super_admin"))):
    db = get_db()
    lic = await db.licenses.find_one({"property_id": current["property_id"]}, {"_id": 0})
    if lic and not lic.get("theme_customization_enabled", False):
        raise HTTPException(status_code=403, detail="Theme customization not enabled for current plan")
    doc = payload.model_dump()
    doc["property_id"] = current["property_id"]
    await db.theme_settings.update_one({"property_id": current["property_id"]}, {"$set": doc}, upsert=True)
    await write_audit(db, actor=current, action="update_theme", entity_type="settings", description=f"Updated theme to {payload.theme_name}")
    return doc


@router.get("/settings/cloud-sync")
async def cloud_sync_status(user: dict = Depends(auth_mod.get_current_user)):
    db = get_db()
    return await cloud_sync.get_queue_stats(db, user["property_id"])


@router.post("/settings/cloud-sync/trigger")
async def trigger_cloud_sync(current: dict = Depends(auth_mod.require_roles("hotel_admin", "super_admin"))):
    """Force-flush the queue immediately. Returns sync summary."""
    db = get_db()
    result = await cloud_sync.flush_now(db, property_id=current["property_id"])
    await write_audit(db, actor=current, action="cloud_sync", entity_type="settings",
                       description=f"Manual cloud sync · {result['synced']} synced / {result['failed']} failed")
    stats = await cloud_sync.get_queue_stats(db, current["property_id"])
    return {**result, **stats}


# ============ Reports ============
@router.get("/reports/revenue")
async def revenue_report(user: dict = Depends(auth_mod.get_current_user), days: int = 7):
    db = get_db()
    # We query events that were confirmed since 'days' ago, falling back to detected since 'days' ago
    start = (utc_now() - timedelta(days=days)).isoformat()
    confirmed = {"$in": ["confirmed", "added_to_bill"]}
    events = await db.usage_events.find(
        {
            "property_id": user["property_id"],
            "status": confirmed,
            "$or": [
                {"detected_at": {"$gte": start}},
                {"confirmed_at": {"$gte": start}},
            ]
        },
        {"_id": 0, "selling_price": 1, "detected_at": 1, "confirmed_at": 1},
    ).to_list(5000)

    # Group by day based on the actual realization date (confirmed_at, fallback to detected_at)
    from collections import defaultdict
    by_day = defaultdict(float)
    for e in events:
        ts_str = e.get("confirmed_at") or e.get("detected_at")
        if not ts_str:
            continue
        day = ts_str[:10]
        # Only include if the realization date is within our report range
        if day >= start[:10]:
            by_day[day] += e.get("selling_price", 0)

    series = sorted([{"date": d, "amount": round(v, 2)} for d, v in by_day.items()], key=lambda x: x["date"])
    return {"series": series, "total": round(sum(by_day.values()), 2)}


@router.get("/reports/item-consumption")
async def item_consumption(user: dict = Depends(auth_mod.get_current_user)):
    db = get_db()
    events = await db.usage_events.find(
        {"property_id": user["property_id"], "status": {"$in": ["confirmed", "added_to_bill"]}},
        {"_id": 0},
    ).to_list(5000)
    from collections import defaultdict
    by_item = defaultdict(lambda: {"count": 0, "revenue": 0.0})
    for e in events:
        name = e.get("product_name", "Unknown")
        by_item[name]["count"] += 1
        by_item[name]["revenue"] += e.get("selling_price", 0)
    items = [{"name": k, "count": v["count"], "revenue": round(v["revenue"], 2)} for k, v in by_item.items()]
    items.sort(key=lambda x: x["revenue"], reverse=True)
    return items


@router.get("/reports/room-consumption")
async def room_consumption(user: dict = Depends(auth_mod.get_current_user)):
    db = get_db()
    events = await db.usage_events.find(
        {"property_id": user["property_id"], "status": {"$in": ["confirmed", "added_to_bill"]}},
        {"_id": 0},
    ).to_list(5000)
    from collections import defaultdict
    by_room = defaultdict(lambda: {"count": 0, "revenue": 0.0})
    for e in events:
        room = e.get("room_number", "?")
        by_room[room]["count"] += 1
        by_room[room]["revenue"] += e.get("selling_price", 0)
    rooms = [{"room": k, "count": v["count"], "revenue": round(v["revenue"], 2)} for k, v in by_room.items()]
    rooms.sort(key=lambda x: x["revenue"], reverse=True)
    return rooms


# ============ Demo simulation: trigger fake tamper event ============
@router.post("/demo/simulate-tamper")
async def simulate_tamper(payload: dict, user: dict = Depends(auth_mod.require_roles("hotel_admin", "super_admin"))):
    """Demo helper: trigger a tamper event on an assigned tag. Useful for testing."""
    db = get_db()
    tag_id = payload.get("tag_id")
    if not tag_id:
        raise HTTPException(status_code=400, detail="tag_id required")
    tag = await db.tags.find_one({"id": tag_id, "property_id": user["property_id"]})
    if not tag:
        raise HTTPException(status_code=404, detail="Tag not found")
    if not tag.get("assigned_room_id") or not tag.get("assigned_product_id"):
        raise HTTPException(status_code=400, detail="Tag must be assigned to a room and product first")

    # Update tag tamper status
    await db.tags.update_one({"id": tag_id}, {"$set": {"tamper_status": True, "status": "tamper_triggered"}})

    # Create one usage event
    room = await db.rooms.find_one({"id": tag["assigned_room_id"]}, {"_id": 0})
    product = await db.products.find_one({"id": tag["assigned_product_id"]}, {"_id": 0})
    from models import UsageEvent
    evt = UsageEvent(
        tag_id=tag["tag_id"], tag_db_id=tag["id"],
        room_id=room["id"], room_number=room["room_number"],
        product_id=product["id"], product_name=product["name"],
        selling_price=product["selling_price"],
        tax_rate=product.get("tax_rate", 18.0),
        status="pending_review",
        guest_name=room.get("guest_name"),
        stay_id=room.get("current_stay_id"),
        property_id=user["property_id"],
    )
    doc = evt.model_dump()
    doc["detected_at"] = doc["detected_at"].isoformat()
    doc["confirmed_at"] = None
    await db.usage_events.insert_one(doc)
    doc.pop("_id", None)
    from realtime import push_notification
    await push_notification(
        db, type_="tamper",
        title="Tamper Detected",
        message=f"{product['name']} opened in Room {room['room_number']}",
        severity="danger", property_id=user["property_id"], related_id=tag_id,
    )
    await write_audit(db, actor=user, action="tamper_detected", entity_type="tag",
                       entity_id=tag_id, description=f"Tamper on {product['name']} (Room {room['room_number']})")
    await manager.broadcast("tamper", {"tag_id": tag_id, "room_number": room["room_number"], "product_name": product["name"]})
    return doc
