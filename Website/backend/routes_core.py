"""Rooms, Tags, Gateways, Products routes + Dashboard KPI."""
from __future__ import annotations

from datetime import datetime, timezone, timedelta
from typing import List, Optional

from fastapi import APIRouter, Depends, HTTPException, Query

import auth as auth_mod
from db import get_db
from models import (
    Room, RoomCreate, RoomUpdate, Tag, TagCreate, TagAssign, TagRestock,
    Gateway, GatewayCreate, Product, ProductCreate, DashboardKPI,
    new_id, utc_now,
)
from realtime import manager, push_notification, write_audit, queue_for_sync
from license_guard import ensure_license_active

router = APIRouter(prefix="/api", tags=["core"])


def _strip(doc: dict | None) -> dict | None:
    if doc is None:
        return None
    doc.pop("_id", None)
    return doc


def _now_iso() -> str:
    return utc_now().isoformat()


# ============ Rooms ============
@router.get("/rooms")
async def list_rooms(user: dict = Depends(auth_mod.get_current_user),
                     status: Optional[str] = None):
    db = get_db()
    q = {"property_id": user["property_id"]}
    if status:
        q["status"] = status
    rooms = await db.rooms.find(q, {"_id": 0}).sort("room_number", 1).to_list(1000)
    return rooms


@router.post("/rooms")
async def create_room(payload: RoomCreate,
                       user: dict = Depends(auth_mod.require_roles("hotel_admin"))):
    db = get_db()
    existing = await db.rooms.find_one({"property_id": user["property_id"], "room_number": payload.room_number})
    if existing:
        raise HTTPException(status_code=409, detail="Room already exists")
    room = Room(property_id=user["property_id"], **payload.model_dump())
    doc = room.model_dump()
    doc["created_at"] = doc["created_at"].isoformat()
    doc["last_updated"] = doc["last_updated"].isoformat()
    await db.rooms.insert_one(doc)
    doc.pop("_id", None)
    await write_audit(db, actor=user, action="create", entity_type="room", entity_id=room.id, description=f"Created room {room.room_number}")
    await manager.broadcast("room_created", doc)
    await queue_for_sync(db, event_type="room_created", payload=doc, property_id=user["property_id"])
    return doc


@router.get("/rooms/{room_id}")
async def get_room(room_id: str, user: dict = Depends(auth_mod.get_current_user)):
    db = get_db()
    room = await db.rooms.find_one({"id": room_id, "property_id": user["property_id"]}, {"_id": 0})
    if not room:
        raise HTTPException(status_code=404, detail="Room not found")
    # Attach assigned tags + products
    tags = await db.tags.find({"assigned_room_id": room_id}, {"_id": 0}).to_list(100)
    product_ids = [t["assigned_product_id"] for t in tags if t.get("assigned_product_id")]
    products = []
    if product_ids:
        products = await db.products.find({"id": {"$in": product_ids}}, {"_id": 0}).to_list(100)
    products_map = {p["id"]: p for p in products}
    for t in tags:
        if t.get("assigned_product_id") and t["assigned_product_id"] in products_map:
            t["product"] = products_map[t["assigned_product_id"]]
    room["tags"] = tags
    if room.get("gateway_id"):
        room["gateway"] = await db.gateways.find_one({"id": room["gateway_id"]}, {"_id": 0})
    return room


@router.patch("/rooms/{room_id}")
async def update_room(room_id: str, payload: RoomUpdate,
                       user: dict = Depends(auth_mod.require_roles("hotel_admin", "reception", "housekeeping"))):
    db = get_db()
    updates = {k: v for k, v in payload.model_dump().items() if v is not None}
    if not updates:
        raise HTTPException(status_code=400, detail="No fields to update")
    updates["last_updated"] = _now_iso()
    res = await db.rooms.update_one({"id": room_id, "property_id": user["property_id"]}, {"$set": updates})
    if res.matched_count == 0:
        raise HTTPException(status_code=404, detail="Room not found")
    room = await db.rooms.find_one({"id": room_id}, {"_id": 0})
    await write_audit(db, actor=user, action="update", entity_type="room", entity_id=room_id, description=f"Updated room {room['room_number']}", metadata=updates)
    await manager.broadcast("room_updated", room)
    return room


@router.delete("/rooms/{room_id}")
async def delete_room(room_id: str, user: dict = Depends(auth_mod.require_roles("hotel_admin"))):
    db = get_db()
    res = await db.rooms.delete_one({"id": room_id, "property_id": user["property_id"]})
    if res.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Room not found")
    await write_audit(db, actor=user, action="delete", entity_type="room", entity_id=room_id, description="Deleted room")
    return {"ok": True}


# ============ Tags ============
@router.get("/tags")
async def list_tags(user: dict = Depends(auth_mod.get_current_user),
                    status: Optional[str] = None,
                    room_id: Optional[str] = None):
    db = get_db()
    q = {"property_id": user["property_id"]}
    if status:
        q["status"] = status
    if room_id:
        q["assigned_room_id"] = room_id
    tags = await db.tags.find(q, {"_id": 0}).sort("tag_id", 1).to_list(2000)
    # Enrich with product names + room numbers
    product_ids = [t["assigned_product_id"] for t in tags if t.get("assigned_product_id")]
    room_ids = [t["assigned_room_id"] for t in tags if t.get("assigned_room_id")]
    products = await db.products.find({"id": {"$in": product_ids}}, {"_id": 0}).to_list(1000) if product_ids else []
    rooms = await db.rooms.find({"id": {"$in": room_ids}}, {"_id": 0}).to_list(1000) if room_ids else []
    pmap = {p["id"]: p for p in products}
    rmap = {r["id"]: r for r in rooms}
    for t in tags:
        t["product_name"] = pmap.get(t.get("assigned_product_id"), {}).get("name")
        t["room_number"] = rmap.get(t.get("assigned_room_id"), {}).get("room_number")
    return tags


@router.post("/tags")
async def create_tag(payload: TagCreate, user: dict = Depends(auth_mod.require_roles("hotel_admin", "technician"))):
    db = get_db()
    existing = await db.tags.find_one({"property_id": user["property_id"], "tag_id": payload.tag_id})
    if existing:
        raise HTTPException(status_code=409, detail="Tag with this ID already exists")
    tag = Tag(
        property_id=user["property_id"],
        qr_code=payload.qr_code or payload.tag_id,
        **payload.model_dump(exclude={"qr_code"}),
    )
    doc = tag.model_dump()
    doc["created_at"] = doc["created_at"].isoformat()
    doc["last_seen"] = None
    await db.tags.insert_one(doc)
    doc.pop("_id", None)
    await write_audit(db, actor=user, action="create", entity_type="tag", entity_id=tag.id, description=f"Added tag {tag.tag_id}")
    await manager.broadcast("tag_created", doc)
    await queue_for_sync(db, event_type="tag_created", payload=doc, property_id=user["property_id"])
    return doc


@router.get("/tags/by-tag-id/{printed_tag_id}")
async def lookup_tag_by_printed_id(printed_tag_id: str,
                                    user: dict = Depends(auth_mod.get_current_user)):
    """Lookup by the printed tag ID (the human-readable QR/barcode value).
    Used by the mobile app's Scan screen — fast, single-shot lookup."""
    db = get_db()
    tag = await db.tags.find_one(
        {"property_id": user["property_id"],
         "$or": [{"tag_id": printed_tag_id}, {"qr_code": printed_tag_id}]},
        {"_id": 0},
    )
    if not tag:
        raise HTTPException(status_code=404, detail="Tag not found for this property")
    # Augment with assigned room number if any
    if tag.get("assigned_room_id"):
        room = await db.rooms.find_one(
            {"id": tag["assigned_room_id"]},
            {"_id": 0, "room_number": 1},
        )
        if room:
            tag["assigned_room_number"] = room["room_number"]
    return tag


@router.post("/tags/{tag_id}/assign")
async def assign_tag(tag_id: str, payload: TagAssign,
                      user: dict = Depends(auth_mod.require_roles("hotel_admin", "housekeeping", "technician"))):
    db = get_db()
    tag = await db.tags.find_one({"id": tag_id, "property_id": user["property_id"]})
    if not tag:
        raise HTTPException(status_code=404, detail="Tag not found")
    room = await db.rooms.find_one({"id": payload.room_id, "property_id": user["property_id"]})
    if not room:
        raise HTTPException(status_code=404, detail="Room not found")
    product = await db.products.find_one({"id": payload.product_id, "property_id": user["property_id"]})
    if not product:
        raise HTTPException(status_code=404, detail="Product not found")
    updates = {
        "assigned_room_id": payload.room_id,
        "assigned_product_id": payload.product_id,
        "selling_price": payload.selling_price or product["selling_price"],
        "status": "active",
        "tamper_status": False,
    }
    await db.tags.update_one({"id": tag_id}, {"$set": updates})
    updated = await db.tags.find_one({"id": tag_id}, {"_id": 0})
    await push_notification(
        db, type_="product_assigned",
        title="Product Assigned",
        message=f"{product['name']} assigned to Room {room['room_number']}",
        severity="success", property_id=user["property_id"], related_id=tag_id,
    )
    await write_audit(db, actor=user, action="assign", entity_type="tag", entity_id=tag_id,
                       description=f"Assigned {product['name']} → Room {room['room_number']}",
                       metadata={"room_id": payload.room_id, "product_id": payload.product_id})
    await manager.broadcast("tag_updated", updated)
    return updated


import logging
import httpx
from pydantic import BaseModel

logger = logging.getLogger("uvicorn.error")

class PushTokenRegister(BaseModel):
    token: str

@router.post("/users/push-token")
async def register_push_token(payload: PushTokenRegister, user: dict = Depends(auth_mod.get_current_user)):
    db = get_db()
    await db.push_tokens.update_one(
        {"token": payload.token},
        {
            "$set": {
                "token": payload.token,
                "user_id": user["id"],
                "property_id": user["property_id"],
                "updated_at": utc_now().isoformat()
            }
        },
        upsert=True
    )
    return {"ok": True}

async def send_expo_push_notifications(db, property_id: str, title: str, body: str):
    try:
        tokens = await db.push_tokens.find({"property_id": property_id}).to_list(100)
        token_list = [t["token"] for t in tokens if t.get("token")]
        if not token_list:
            logger.info("No mobile push tokens registered.")
            return
        
        logger.info(f"Sending push notification to {len(token_list)} tokens: {title} - {body}")
        async with httpx.AsyncClient() as client:
            payload = []
            for token in token_list:
                if token.startswith("ExponentPushToken") or token.startswith("ExpoPushToken") or "PushToken" in token:
                    payload.append({
                        "to": token,
                        "title": title,
                        "body": body,
                        "sound": "default",
                    })
            if payload:
                resp = await client.post("https://exp.host/--/api/v2/push/send", json=payload, timeout=10.0)
                logger.info(f"Expo push API response: {resp.status_code}")
    except Exception as e:
        logger.warning(f"Failed to send push notification: {e}")

@router.post("/tags/{tag_id}/request-restock")
async def request_restock(tag_id: str,
                          user: dict = Depends(auth_mod.require_roles("hotel_admin", "reception", "housekeeping"))):
    db = get_db()
    tag = await db.tags.find_one({"id": tag_id, "property_id": user["property_id"]})
    if not tag:
        raise HTTPException(status_code=404, detail="Tag not found")
    
    # Resolve room number from tag or assigned room
    room_number = tag.get("room_number")
    if not room_number:
        assigned_room_id = tag.get("assigned_room_id") or tag.get("room_id")
        if assigned_room_id:
            room_doc = await db.rooms.find_one(
                {"id": assigned_room_id, "property_id": user["property_id"]}, {"_id": 0, "room_number": 1}
            )
            if room_doc:
                room_number = room_doc.get("room_number")
    if not room_number:
        room_number = "Unknown"

    # Resolve product name from tag or assigned product
    product_name = tag.get("product_name")
    if not product_name:
        assigned_product_id = tag.get("assigned_product_id") or tag.get("product_id")
        if assigned_product_id:
            product_doc = await db.products.find_one(
                {"id": assigned_product_id, "property_id": user["property_id"]}, {"_id": 0, "name": 1}
            )
            if product_doc:
                product_name = product_doc.get("name")
    if not product_name:
        product_name = "Item"
    
    title = f"Restock Request: Room {room_number}"
    body = f"Please restock {product_name} in Room {room_number}."
    
    await push_notification(
        db, type_="restock", title=title,
        message=body,
        severity="warning", property_id=user["property_id"], related_id=tag_id
    )
    
    await send_expo_push_notifications(db, user["property_id"], title, body)
    return {"ok": True}

@router.post("/tags/{tag_id}/restock")
async def restock_tag(tag_id: str, payload: TagRestock,
                       user: dict = Depends(auth_mod.require_roles("hotel_admin", "housekeeping"))):
    db = get_db()
    tag = await db.tags.find_one({"id": tag_id, "property_id": user["property_id"]})
    if not tag:
        raise HTTPException(status_code=404, detail="Tag not found")
    updates = {"status": "active", "tamper_status": False}
    await db.tags.update_one({"id": tag_id}, {"$set": updates})
    updated = await db.tags.find_one({"id": tag_id}, {"_id": 0})
    await push_notification(
        db, type_="restock", title="Item Restocked",
        message=f"Tag {tag['tag_id']} restocked. Status reset to active.",
        severity="success", property_id=user["property_id"], related_id=tag_id,
    )
    await write_audit(db, actor=user, action="restock", entity_type="tag", entity_id=tag_id, description=f"Restocked tag {tag['tag_id']}", metadata={"notes": payload.notes})
    await manager.broadcast("tag_updated", updated)
    return updated


@router.patch("/tags/{tag_id}")
async def update_tag(tag_id: str, payload: dict,
                      user: dict = Depends(auth_mod.require_roles("hotel_admin", "technician"))):
    db = get_db()
    allowed = {"status", "notes", "battery", "firmware_version"}
    updates = {k: v for k, v in payload.items() if k in allowed}
    if not updates:
        raise HTTPException(status_code=400, detail="No fields to update")
    res = await db.tags.update_one({"id": tag_id, "property_id": user["property_id"]}, {"$set": updates})
    if res.matched_count == 0:
        raise HTTPException(status_code=404, detail="Tag not found")
    updated = await db.tags.find_one({"id": tag_id}, {"_id": 0})
    await write_audit(db, actor=user, action="update", entity_type="tag", entity_id=tag_id, description=f"Updated tag {updated['tag_id']}", metadata=updates)
    return updated


# ============ Gateways ============
@router.get("/gateways")
async def list_gateways(user: dict = Depends(auth_mod.get_current_user)):
    db = get_db()
    gws = await db.gateways.find({"property_id": user["property_id"]}, {"_id": 0}).sort("gateway_id", 1).to_list(500)
    # Attach tags count and update offline status
    now = datetime.now(timezone.utc)
    for gw in gws:
        last_online = gw.get("last_online")
        if last_online:
            try:
                last_dt = datetime.fromisoformat(last_online.replace("Z", "+00:00"))
                if (now - last_dt) > timedelta(minutes=10) and gw.get("status") == "online":
                    gw["status"] = "offline"
                    await db.gateways.update_one({"id": gw["id"]}, {"$set": {"status": "offline"}})
            except Exception:
                pass
        gw["assigned_tags_count"] = await db.tags.count_documents({"property_id": user["property_id"], "assigned_room_id": gw.get("room_id")}) if gw.get("room_id") else 0
    return gws


@router.post("/gateways")
async def create_gateway(payload: GatewayCreate,
                          user: dict = Depends(auth_mod.require_roles("hotel_admin", "technician"))):
    db = get_db()
    import secrets
    api_key = f"gw_{secrets.token_hex(16)}"
    room_number = None
    if payload.room_id:
        room = await db.rooms.find_one({"id": payload.room_id, "property_id": user["property_id"]})
        if room:
            room_number = room["room_number"]
    gw = Gateway(
        property_id=user["property_id"],
        api_key=api_key,
        room_number=room_number,
        status="not_configured",
        **payload.model_dump(),
    )
    doc = gw.model_dump()
    doc["created_at"] = doc["created_at"].isoformat()
    doc["last_online"] = None
    await db.gateways.insert_one(doc)
    doc.pop("_id", None)
    if payload.room_id:
        await db.rooms.update_one({"id": payload.room_id}, {"$set": {"gateway_id": gw.id}})
    await write_audit(db, actor=user, action="create", entity_type="gateway", entity_id=gw.id, description=f"Added gateway {gw.gateway_id}")
    await manager.broadcast("gateway_created", doc)
    await queue_for_sync(db, event_type="gateway_created", payload=doc, property_id=user["property_id"])
    return doc


@router.get("/gateways/{gw_id}")
async def get_gateway(gw_id: str, user: dict = Depends(auth_mod.get_current_user)):
    db = get_db()
    gw = await db.gateways.find_one({"id": gw_id, "property_id": user["property_id"]}, {"_id": 0})
    if not gw:
        raise HTTPException(status_code=404, detail="Gateway not found")
    if gw.get("room_id"):
        gw["tags"] = await db.tags.find({"assigned_room_id": gw["room_id"]}, {"_id": 0}).to_list(100)
    return gw


# ============ Products ============
@router.get("/products")
async def list_products(user: dict = Depends(auth_mod.get_current_user), active: Optional[bool] = None):
    db = get_db()
    q = {"property_id": user["property_id"]}
    if active is not None:
        q["active"] = active
    products = await db.products.find(q, {"_id": 0}).sort("name", 1).to_list(1000)
    return products


@router.post("/products")
async def create_product(payload: ProductCreate, user: dict = Depends(auth_mod.require_roles("hotel_admin"))):
    db = get_db()
    prod = Product(property_id=user["property_id"], **payload.model_dump())
    doc = prod.model_dump()
    doc["created_at"] = doc["created_at"].isoformat()
    await db.products.insert_one(doc)
    doc.pop("_id", None)
    await write_audit(db, actor=user, action="create", entity_type="product", entity_id=prod.id, description=f"Added product {prod.name}")
    return doc


@router.patch("/products/{product_id}")
async def update_product(product_id: str, payload: dict, user: dict = Depends(auth_mod.require_roles("hotel_admin"))):
    db = get_db()
    allowed = {"name", "category", "brand", "bottle_size", "sku", "selling_price",
                "cost_price", "tax_rate", "image_url", "description", "active"}
    updates = {k: v for k, v in payload.items() if k in allowed}
    res = await db.products.update_one({"id": product_id, "property_id": user["property_id"]}, {"$set": updates})
    if res.matched_count == 0:
        raise HTTPException(status_code=404, detail="Product not found")
    return await db.products.find_one({"id": product_id}, {"_id": 0})


@router.delete("/products/{product_id}")
async def delete_product(product_id: str, user: dict = Depends(auth_mod.require_roles("hotel_admin"))):
    db = get_db()
    await db.products.delete_one({"id": product_id, "property_id": user["property_id"]})
    return {"ok": True}


# ============ Dashboard KPI ============
async def _kpi_counts(db, pid: str) -> dict:
    """Entity counts — rooms, tags, gateways, pending bills."""
    return {
        "total_rooms": await db.rooms.count_documents({"property_id": pid}),
        "active_tags": await db.tags.count_documents({"property_id": pid, "status": "active"}),
        "assigned_tags": await db.tags.count_documents(
            {"property_id": pid, "status": {"$in": ["active", "assigned"]}}
        ),
        "pending_bills": await db.usage_events.count_documents(
            {"property_id": pid, "status": "pending_review"}
        ),
        "confirmed_usage": await db.usage_events.count_documents(
            {"property_id": pid, "status": {"$in": ["confirmed", "added_to_bill"]}}
        ),
        "low_battery_tags": await db.tags.count_documents(
            {"property_id": pid, "battery": {"$lt": 20}}
        ),
        "offline_gateways": await db.gateways.count_documents(
            {"property_id": pid, "status": "offline"}
        ),
        "tags_not_seen": await db.tags.count_documents(
            {"property_id": pid, "status": "not_seen"}
        ),
    }


async def _kpi_revenue(db, pid: str, now: datetime) -> dict:
    """Today + month confirmed-bill revenue."""
    month_start = datetime(now.year, now.month, 1, tzinfo=timezone.utc).isoformat()
    confirmed = {"$in": ["confirmed", "added_to_bill"]}
    
    # Query all events confirmed or detected since start of current month
    events = await db.usage_events.find(
        {
            "property_id": pid,
            "status": confirmed,
            "$or": [
                {"detected_at": {"$gte": month_start}},
                {"confirmed_at": {"$gte": month_start}},
            ]
        },
        {"_id": 0, "selling_price": 1, "detected_at": 1, "confirmed_at": 1},
    ).to_list(10000)

    today_str = now.strftime("%Y-%m-%d")
    month_prefix = now.strftime("%Y-%m")

    today_rev = 0.0
    month_rev = 0.0

    for e in events:
        ts_str = e.get("confirmed_at") or e.get("detected_at")
        if not ts_str:
            continue
        date_part = ts_str[:10]
        if date_part.startswith(month_prefix):
            month_rev += e.get("selling_price", 0)
            if date_part == today_str:
                today_rev += e.get("selling_price", 0)

    return {
        "today_revenue": round(today_rev, 2),
        "monthly_revenue": round(month_rev, 2),
    }


async def _kpi_license_and_sync(db, pid: str, now: datetime, total_rooms: int) -> dict:
    """License + cloud-sync facts for the dashboard."""
    raw_lic = await db.licenses.find_one({"property_id": pid}, {"_id": 0}) or {}
    # Decrypt license if it's encrypted (schema v2)
    try:
        from license_verifier import decrypt_license_doc
        lic = decrypt_license_doc(raw_lic) if raw_lic else {}
    except Exception:
        # If decryption fails, use raw data (fallback for v1 or error cases)
        lic = raw_lic
    cloud_doc = await db.cloud_sync_status.find_one({"property_id": pid}, {"_id": 0}) or {}
    pending_sync = await db.cloud_sync_queue.count_documents(
        {"property_id": pid, "status": "pending"}
    )
    return {
        "license_status": lic.get("status", "trial"),
        "license_expiry": lic.get("expiry_date", now.isoformat()),
        "licensed_rooms_used": total_rooms,
        "licensed_rooms_total": lic.get("room_limit", 10),
        "local_server_status": "online",
        "cloud_sync_status": "online" if cloud_doc.get("online", True) else "offline",
        "last_sync_time": cloud_doc.get("last_sync_at"),
        "pending_sync_count": pending_sync,
    }


@router.get("/dashboard/kpi")
async def dashboard_kpi(user: dict = Depends(auth_mod.get_current_user)) -> dict:
    db = get_db()
    pid = user["property_id"]
    now = datetime.now(timezone.utc)
    counts = await _kpi_counts(db, pid)
    revenue = await _kpi_revenue(db, pid, now)
    lic_sync = await _kpi_license_and_sync(db, pid, now, counts["total_rooms"])
    return {**counts, **revenue, **lic_sync}


@router.get("/dashboard/recent")
async def dashboard_recent(user: dict = Depends(auth_mod.get_current_user)):
    """Recent activity for dashboard timeline."""
    db = get_db()
    pid = user["property_id"]
    recent_audits = await db.audit_logs.find({"property_id": pid}, {"_id": 0}).sort("created_at", -1).limit(10).to_list(10)
    recent_events = await db.usage_events.find({"property_id": pid}, {"_id": 0}).sort("detected_at", -1).limit(10).to_list(10)
    return {"audits": recent_audits, "events": recent_events}
