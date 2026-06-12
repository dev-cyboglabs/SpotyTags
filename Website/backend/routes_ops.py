"""Operations workflow routes - check-in/check-out, tag reporting, gateway diagnostics, etc."""
from __future__ import annotations

from datetime import datetime, timezone
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException

import auth as auth_mod
from db import get_db
from models import utc_now, UsageEvent, new_id
from realtime import manager, push_notification, write_audit

router = APIRouter(prefix="/api", tags=["operations"])


# ============ Room workflow: check-in / check-out / cleaning-done ============
@router.post("/rooms/{room_id}/check-in")
async def check_in(room_id: str, payload: dict,
                    user: dict = Depends(auth_mod.require_roles("super_admin", "hotel_admin", "reception"))):
    db = get_db()
    guest_name = (payload.get("guest_name") or "").strip()
    if not guest_name:
        raise HTTPException(status_code=400, detail="guest_name is required")
    room = await db.rooms.find_one({"id": room_id, "property_id": user["property_id"]})
    if not room:
        raise HTTPException(status_code=404, detail="Room not found")
    if room.get("status") not in ("vacant", "cleaning"):
        raise HTTPException(status_code=400, detail=f"Cannot check in — room is {room['status']}")
    stay_id = new_id()
    updates = {
        "status": "occupied",
        "guest_name": guest_name,
        "current_stay_id": stay_id,
        "guest_check_in_at": utc_now().isoformat(),
        "last_updated": utc_now().isoformat(),
        "notes": payload.get("notes"),
    }
    await db.rooms.update_one({"id": room_id}, {"$set": updates})
    updated = await db.rooms.find_one({"id": room_id}, {"_id": 0})
    await push_notification(
        db, type_="info", title="Check-in",
        message=f"{guest_name} checked into Room {room['room_number']}",
        severity="success", property_id=user["property_id"], related_id=room_id,
    )
    await write_audit(db, actor=user, action="check_in", entity_type="room",
                      entity_id=room_id, description=f"Guest {guest_name} checked into Room {room['room_number']}")
    await manager.broadcast("room_updated", updated)
    return updated


@router.post("/rooms/{room_id}/check-out")
async def check_out(room_id: str,
                     user: dict = Depends(auth_mod.require_roles("super_admin", "hotel_admin", "reception"))):
    """Finalize folio (mark all pending bills as added_to_bill) and set room to checkout_pending."""
    db = get_db()
    room = await db.rooms.find_one({"id": room_id, "property_id": user["property_id"]})
    if not room:
        raise HTTPException(status_code=404, detail="Room not found")
    if room.get("status") != "occupied":
        raise HTTPException(status_code=400, detail=f"Cannot check out — room is {room['status']}")

    # Finalize bills
    stay_id = room.get("current_stay_id")
    active_bill_query = {
        "property_id": user["property_id"],
        "room_id": room_id,
        "status": "confirmed",
    }
    final_bill_query = {
        "property_id": user["property_id"],
        "room_id": room_id,
        "status": "added_to_bill",
    }
    if stay_id:
        active_bill_query["stay_id"] = stay_id
        final_bill_query["stay_id"] = stay_id
    else:
        active_bill_query["guest_name"] = room.get("guest_name")
        final_bill_query["guest_name"] = room.get("guest_name")

    bills_added = await db.usage_events.update_many(
        active_bill_query,
        {"$set": {"status": "added_to_bill"}},
    )
    # Compute folio total
    events = await db.usage_events.find(
        final_bill_query,
        {"_id": 0},
    ).to_list(500)
    total = sum(e.get("selling_price", 0) for e in events)
    tax = sum(e.get("selling_price", 0) * (e.get("tax_rate", 18.0) / 100.0) for e in events)

    updates = {
        "status": "checkout_pending",
        "checkout_at": utc_now().isoformat(),
        "last_updated": utc_now().isoformat(),
    }
    await db.rooms.update_one({"id": room_id}, {"$set": updates})
    updated = await db.rooms.find_one({"id": room_id}, {"_id": 0})

    await push_notification(
        db, type_="billing_confirmed", title="Check-out",
        message=f"{room.get('guest_name', 'Guest')} checked out · ₹{round(total+tax, 2)} on folio",
        severity="info", property_id=user["property_id"], related_id=room_id,
    )
    await write_audit(db, actor=user, action="check_out", entity_type="room",
                      entity_id=room_id,
                      description=f"Check-out Room {room['room_number']} · {bills_added.modified_count} items on folio · ₹{round(total+tax, 2)}",
                      metadata={"folio_total": round(total + tax, 2), "items": bills_added.modified_count})
    await manager.broadcast("room_updated", updated)
    return {
        "room": updated,
        "items": events,
        "subtotal": round(total, 2),
        "tax": round(tax, 2),
        "total": round(total + tax, 2),
    }


@router.post("/rooms/{room_id}/cleaning-done")
async def cleaning_done(room_id: str,
                          user: dict = Depends(auth_mod.require_roles("super_admin", "hotel_admin", "housekeeping"))):
    db = get_db()
    room = await db.rooms.find_one({"id": room_id, "property_id": user["property_id"]})
    if not room:
        raise HTTPException(status_code=404, detail="Room not found")
    if room.get("status") not in ("cleaning", "checkout_pending"):
        raise HTTPException(status_code=400, detail=f"Room is {room['status']} — only cleaning/checkout_pending rooms can be marked ready")
    updates = {
        "status": "vacant",
        "guest_name": None,
        "current_stay_id": None,
        "last_updated": utc_now().isoformat(),
    }
    await db.rooms.update_one({"id": room_id}, {"$set": updates})
    updated = await db.rooms.find_one({"id": room_id}, {"_id": 0})
    await write_audit(db, actor=user, action="cleaning_done", entity_type="room",
                       entity_id=room_id, description=f"Room {room['room_number']} cleaned · ready for guest")
    await manager.broadcast("room_updated", updated)
    return updated


# ============ Tag workflow: report damaged / missing ============
@router.post("/tags/{tag_id}/report-damaged")
async def report_damaged(tag_id: str, payload: dict,
                          user: dict = Depends(auth_mod.require_roles("hotel_admin", "housekeeping", "technician"))):
    db = get_db()
    tag = await db.tags.find_one({"id": tag_id, "property_id": user["property_id"]})
    if not tag:
        raise HTTPException(status_code=404, detail="Tag not found")
    reason = payload.get("reason", "Damaged")
    existing_notes = (tag.get("notes") or "").strip()
    new_notes = f"{existing_notes}\n[{utc_now().isoformat()}] Reported damaged: {reason}".strip()
    await db.tags.update_one({"id": tag_id}, {"$set": {"status": "faulty", "notes": new_notes}})
    await push_notification(
        db, type_="info", title="Tag reported damaged",
        message=f"Tag {tag['tag_id']} flagged faulty — {reason}",
        severity="warning", property_id=user["property_id"], related_id=tag_id,
    )
    await write_audit(db, actor=user, action="report_damaged", entity_type="tag",
                       entity_id=tag_id, description=f"Tag {tag['tag_id']} reported damaged: {reason}",
                       metadata={"reason": reason})
    return await db.tags.find_one({"id": tag_id}, {"_id": 0})


@router.post("/tags/{tag_id}/report-missing")
async def report_missing(tag_id: str, payload: dict,
                          user: dict = Depends(auth_mod.require_roles("hotel_admin", "housekeeping", "technician"))):
    db = get_db()
    tag = await db.tags.find_one({"id": tag_id, "property_id": user["property_id"]})
    if not tag:
        raise HTTPException(status_code=404, detail="Tag not found")
    reason = payload.get("reason", "Not found in room")
    existing_notes = (tag.get("notes") or "").strip()
    new_notes = f"{existing_notes}\n[{utc_now().isoformat()}] Reported missing: {reason}".strip()
    await db.tags.update_one({"id": tag_id}, {"$set": {"status": "lost", "notes": new_notes}})
    await push_notification(
        db, type_="info", title="Tag reported missing",
        message=f"Tag {tag['tag_id']} marked lost",
        severity="warning", property_id=user["property_id"], related_id=tag_id,
    )
    await write_audit(db, actor=user, action="report_missing", entity_type="tag",
                       entity_id=tag_id, description=f"Tag {tag['tag_id']} reported missing: {reason}",
                       metadata={"reason": reason})
    return await db.tags.find_one({"id": tag_id}, {"_id": 0})


# ============ Gateway workflow: diagnostics ============
@router.post("/gateways/{gw_id}/test")
async def gateway_test(gw_id: str,
                        user: dict = Depends(auth_mod.require_roles("hotel_admin", "technician"))):
    """Simulate a diagnostics ping. Updates last_online and returns health snapshot."""
    db = get_db()
    gw = await db.gateways.find_one({"id": gw_id, "property_id": user["property_id"]})
    if not gw:
        raise HTTPException(status_code=404, detail="Gateway not found")
    now = utc_now()
    await db.gateways.update_one({"id": gw_id}, {"$set": {"last_online": now.isoformat(), "status": "online"}})
    tags = await db.tags.find({"property_id": user["property_id"], "assigned_room_id": gw.get("room_id")},
                                {"_id": 0}).to_list(100) if gw.get("room_id") else []
    await write_audit(db, actor=user, action="gateway_test", entity_type="gateway",
                       entity_id=gw_id, description=f"Diagnostics test on {gw['gateway_id']} · OK")
    return {
        "ok": True,
        "gateway_id": gw["gateway_id"],
        "ip_address": gw.get("ip_address"),
        "mac_address": gw["mac_address"],
        "firmware_version": gw["firmware_version"],
        "rssi": gw.get("rssi"),
        "tags_detected": len(tags),
        "low_battery_tags": sum(1 for t in tags if t.get("battery", 100) < 20),
        "tags": [{"tag_id": t["tag_id"], "battery": t["battery"], "rssi": t["rssi"], "status": t["status"]} for t in tags],
        "last_online": now.isoformat(),
        "server_time": now.isoformat(),
        "config": {"scan_interval_sec": 15, "low_battery_threshold": 20},
    }


# ============ Operations dashboard — reception focused ============
@router.get("/operations/front-desk")
async def front_desk(user: dict = Depends(auth_mod.require_roles("hotel_admin", "reception", "super_admin"))):
    db = get_db()
    pid = user["property_id"]
    now = datetime.now(timezone.utc)
    today_start = datetime(now.year, now.month, now.day, tzinfo=timezone.utc).isoformat()
    rooms = await db.rooms.find({"property_id": pid}, {"_id": 0}).sort("room_number", 1).to_list(500)
    pending_bills = await db.usage_events.count_documents({"property_id": pid, "status": "pending_review"})
    
    # Query confirmed/billed events matching today_start boundary for either confirmation or detection
    confirmed = {"$in": ["confirmed", "added_to_bill"]}
    today_events = await db.usage_events.find(
        {
            "property_id": pid,
            "status": confirmed,
            "$or": [
                {"detected_at": {"$gte": today_start}},
                {"confirmed_at": {"$gte": today_start}},
            ]
        },
        {"_id": 0, "selling_price": 1, "detected_at": 1, "confirmed_at": 1},
    ).to_list(5000)

    today_str = now.strftime("%Y-%m-%d")
    today_revenue = 0.0
    for e in today_events:
        ts_str = e.get("confirmed_at") or e.get("detected_at")
        if ts_str and ts_str[:10] == today_str:
            today_revenue += e.get("selling_price", 0)

    # Group rooms by status
    by_status = {}
    for r in rooms:
        by_status.setdefault(r["status"], []).append(r)

    folio_counts = {}
    active_folio_rooms = [
        r for r in rooms
        if r.get("status") in ("occupied", "checkout_pending", "cleaning")
    ]
    active_stay_ids = [r.get("current_stay_id") for r in active_folio_rooms if r.get("current_stay_id")]
    legacy_room_ids = [
        r["id"] for r in active_folio_rooms
        if not r.get("current_stay_id")
    ]
    match_filters = []
    if active_stay_ids:
        match_filters.append({"stay_id": {"$in": active_stay_ids}})
    if legacy_room_ids:
        match_filters.append({
            "room_id": {"$in": legacy_room_ids},
            "stay_id": {"$in": [None, ""]},
        })
    if match_filters:
        pipeline = [
            {"$match": {
                "property_id": pid,
                "status": {"$in": ["pending_review", "confirmed", "added_to_bill"]},
                "$or": match_filters,
            }},
            {"$group": {"_id": "$room_id", "count": {"$sum": 1}, "total": {"$sum": "$selling_price"}}},
        ]
        async for doc in db.usage_events.aggregate(pipeline):
            folio_counts[doc["_id"]] = {"count": doc["count"], "total": doc["total"]}

    return {
        "rooms": rooms,
        "rooms_by_status": {k: len(v) for k, v in by_status.items()},
        "occupied_count": len(by_status.get("occupied", [])),
        "checkout_pending_count": len(by_status.get("checkout_pending", [])),
        "vacant_count": len(by_status.get("vacant", [])),
        "cleaning_count": len(by_status.get("cleaning", [])),
        "pending_bills": pending_bills,
        "today_revenue": round(today_revenue, 2),
        "folio_by_room": folio_counts,
    }


# ============ Billing workflow: add note ============
@router.post("/billing/{event_id}/note")
async def add_billing_note(event_id: str, payload: dict,
                            user: dict = Depends(auth_mod.require_roles("hotel_admin", "reception"))):
    db = get_db()
    note = (payload.get("note") or "").strip()
    if not note:
        raise HTTPException(status_code=400, detail="note required")
    event = await db.usage_events.find_one({"id": event_id, "property_id": user["property_id"]})
    if not event:
        raise HTTPException(status_code=404, detail="Bill not found")
    existing = event.get("notes") or ""
    new_notes = f"{existing}\n[{utc_now().isoformat()}] {user['email']}: {note}".strip()
    await db.usage_events.update_one({"id": event_id}, {"$set": {"notes": new_notes}})
    await write_audit(db, actor=user, action="bill_note", entity_type="usage_event",
                       entity_id=event_id, description="Note added to bill", metadata={"note": note})
    return await db.usage_events.find_one({"id": event_id}, {"_id": 0})
