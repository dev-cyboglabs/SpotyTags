"""Billing routes - pending bills, confirm/waive workflow."""
from __future__ import annotations

from datetime import datetime, timezone
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, Query

import auth as auth_mod
from db import get_db
from models import BillingAction, utc_now
from realtime import manager, push_notification, write_audit

router = APIRouter(prefix="/api/billing", tags=["billing"])


@router.get("/pending")
async def list_pending(user: dict = Depends(auth_mod.get_current_user)):
    db = get_db()
    events = await db.usage_events.find(
        {"property_id": user["property_id"], "status": "pending_review"},
        {"_id": 0},
    ).sort("detected_at", -1).to_list(500)
    return events


@router.get("/events")
async def list_events(user: dict = Depends(auth_mod.get_current_user),
                       status: Optional[str] = None,
                       room_id: Optional[str] = None):
    db = get_db()
    q = {"property_id": user["property_id"]}
    if status:
        q["status"] = status
    if room_id:
        q["room_id"] = room_id
    events = await db.usage_events.find(q, {"_id": 0}).sort("detected_at", -1).to_list(2000)
    return events


@router.get("/confirmed")
async def list_confirmed(user: dict = Depends(auth_mod.get_current_user)):
    db = get_db()
    events = await db.usage_events.find(
        {"property_id": user["property_id"], "status": {"$in": ["confirmed", "added_to_bill"]}},
        {"_id": 0},
    ).sort("detected_at", -1).to_list(500)
    return events


@router.get("/room/{room_id}")
async def list_room_bill(room_id: str, user: dict = Depends(auth_mod.get_current_user)):
    db = get_db()
    events = await db.usage_events.find({"property_id": user["property_id"], "room_id": room_id}, {"_id": 0}).sort("detected_at", -1).to_list(500)
    return events


@router.post("/{event_id}/action")
async def billing_action(event_id: str, payload: BillingAction,
                          user: dict = Depends(auth_mod.require_roles("hotel_admin", "reception"))):
    db = get_db()
    # License enforcement: expired license blocks new billing confirmations
    lic = await db.licenses.find_one({"property_id": user["property_id"]}, {"_id": 0})
    if lic and lic.get("status") in ("expired", "suspended"):
        raise HTTPException(status_code=403, detail=f"License {lic['status']}. Billing confirmations are blocked.")

    event = await db.usage_events.find_one({"id": event_id, "property_id": user["property_id"]})
    if not event:
        raise HTTPException(status_code=404, detail="Usage event not found")

    status_map = {
        "confirm": "confirmed",
        "waive": "waived",
        "dispute": "disputed",
        "complimentary": "complimentary",
        "cancel": "cancelled",
    }
    new_status = status_map.get(payload.action)
    if not new_status:
        raise HTTPException(status_code=400, detail="Invalid action")

    updates = {
        "status": new_status,
        "confirmed_at": utc_now().isoformat(),
        "confirmed_by": user["email"],
        "notes": payload.notes,
    }
    await db.usage_events.update_one({"id": event_id}, {"$set": updates})

    severity = "success" if payload.action == "confirm" else "info"
    await push_notification(
        db, type_="billing_confirmed",
        title=f"Bill {payload.action.title()}d",
        message=f"Room {event['room_number']}: {event.get('product_name', 'item')} marked {new_status.replace('_', ' ')}",
        severity=severity, property_id=user["property_id"], related_id=event_id,
    )
    await write_audit(db, actor=user, action=f"billing_{payload.action}", entity_type="usage_event",
                       entity_id=event_id, description=f"Bill {payload.action} for Room {event['room_number']}",
                       metadata={"product": event.get("product_name"), "amount": event.get("selling_price")})
    updated = await db.usage_events.find_one({"id": event_id}, {"_id": 0})
    await manager.broadcast("billing_updated", updated)
    return updated


class ManualBillItem:
    """Body shape for manual bill addition."""

    pass


@router.post("/manual")
async def add_manual_item(payload: dict,
                           user: dict = Depends(auth_mod.require_roles("hotel_admin", "reception"))):
    """Allow reception to add a manual bill item (e.g., late-night snack)."""
    db = get_db()
    required = ["room_id", "product_id"]
    for k in required:
        if k not in payload:
            raise HTTPException(status_code=400, detail=f"Missing field: {k}")
    room = await db.rooms.find_one({"id": payload["room_id"], "property_id": user["property_id"]})
    if not room:
        raise HTTPException(status_code=404, detail="Room not found")
    product = await db.products.find_one({"id": payload["product_id"], "property_id": user["property_id"]})
    if not product:
        raise HTTPException(status_code=404, detail="Product not found")

    from models import UsageEvent
    evt = UsageEvent(
        tag_id="MANUAL",
        tag_db_id="MANUAL",
        room_id=room["id"],
        room_number=room["room_number"],
        product_id=product["id"],
        product_name=product["name"],
        selling_price=payload.get("selling_price", product["selling_price"]),
        tax_rate=product.get("tax_rate", 18.0),
        status="confirmed",
        guest_name=room.get("guest_name"),
        stay_id=room.get("current_stay_id"),
        confirmed_at=utc_now(),
        confirmed_by=user["email"],
        notes=payload.get("notes", "Manual entry"),
        property_id=user["property_id"],
    )
    doc = evt.model_dump()
    doc["detected_at"] = doc["detected_at"].isoformat()
    doc["confirmed_at"] = doc["confirmed_at"].isoformat() if doc.get("confirmed_at") else None
    await db.usage_events.insert_one(doc)
    doc.pop("_id", None)
    await write_audit(db, actor=user, action="manual_bill", entity_type="usage_event",
                       entity_id=evt.id, description=f"Manual {product['name']} → Room {room['room_number']}")
    await manager.broadcast("billing_created", doc)
    return doc


@router.get("/room/{room_id}/invoice")
async def get_room_invoice(room_id: str, user: dict = Depends(auth_mod.get_current_user)):
    """Get total invoice for a room (confirmed items only)."""
    db = get_db()
    room = await db.rooms.find_one({"id": room_id, "property_id": user["property_id"]}, {"_id": 0})
    if not room:
        raise HTTPException(status_code=404, detail="Room not found")
    q = {
        "property_id": user["property_id"],
        "room_id": room_id,
        "status": {"$in": ["confirmed", "added_to_bill"]},
    }
    if room.get("current_stay_id"):
        q["stay_id"] = room["current_stay_id"]
    else:
        q["stay_id"] = {"$in": [None, ""]}

    events = await db.usage_events.find(
        q,
        {"_id": 0},
    ).sort("detected_at", -1).to_list(500)
    subtotal = sum(e.get("selling_price", 0) for e in events)
    tax = sum(e.get("selling_price", 0) * (e.get("tax_rate", 18.0) / 100.0) for e in events)
    return {
        "room": room,
        "items": events,
        "subtotal": round(subtotal, 2),
        "tax": round(tax, 2),
        "total": round(subtotal + tax, 2),
    }
