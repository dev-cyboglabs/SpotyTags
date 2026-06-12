"""ESP32 Gateway BLE event ingestion (API-key auth)."""
from __future__ import annotations

from datetime import datetime, timezone, timedelta
from typing import List

from fastapi import APIRouter, HTTPException, Header

import auth as auth_mod
from db import get_db
from models import GatewayBLEEvent, UsageEvent, utc_now, new_id
from realtime import manager, push_notification, write_audit, queue_for_sync
from license_guard import _is_license_blocked
from license_verifier import decrypt_license_doc

router = APIRouter(prefix="/api/gateway", tags=["gateway"])

LOW_BATTERY_THRESHOLD = 20
TAG_NOT_SEEN_MINUTES = 5


async def _check_license_expiry(db, property_id: str) -> None:
    """Check if license is expired. Raises HTTPException if so."""
    raw_lic = await db.licenses.find_one({"property_id": property_id}, {"_id": 0})
    if not raw_lic:
        return  # No license = allow (trial mode)
    try:
        lic = decrypt_license_doc(raw_lic)
    except ValueError:
        raise HTTPException(
            status_code=403,
            detail={
                "code": "license_tampered",
                "message": "License integrity check failed. Contact support.",
                "license_status": "tampered",
            },
        )
    blocked, reason = _is_license_blocked(lic)
    if blocked:
        raise HTTPException(
            status_code=403,
            detail={
                "code": f"license_{reason}",
                "message": f"License is {reason}. Renew or extend the plan to continue.",
                "license_status": reason,
            },
        )


async def _maybe_alert_low_battery(db, tag: dict, event: GatewayBLEEvent,
                                     gateway: dict, update_fields: dict) -> None:
    """Push a notification when a tag transitions into low-battery state."""
    if event.battery < LOW_BATTERY_THRESHOLD and tag.get("battery", 100) >= LOW_BATTERY_THRESHOLD:
        await push_notification(
            db, type_="low_battery",
            title="Low Battery",
            message=f"Tag {tag['tag_id']} battery at {event.battery}%",
            severity="warning", property_id=gateway["property_id"], related_id=tag["id"],
        )
        update_fields["status"] = "low_battery"


async def _emit_tamper_bill(db, tag: dict, gateway: dict) -> dict | None:
    """When a tag transitions from untampered → tampered, generate a single
    pending bill (idempotent: returns None if one already exists)."""
    if not (tag.get("assigned_room_id") and tag.get("assigned_product_id")):
        return None
    existing = await db.usage_events.find_one(
        {"tag_db_id": tag["id"], "status": "pending_review"}
    )
    if existing:
        return None
    room = await db.rooms.find_one({"id": tag["assigned_room_id"]}, {"_id": 0})
    product = await db.products.find_one({"id": tag["assigned_product_id"]}, {"_id": 0})
    if not room or not product:
        return None
    evt = UsageEvent(
        tag_id=tag["tag_id"], tag_db_id=tag["id"],
        room_id=room["id"], room_number=room["room_number"],
        product_id=product["id"], product_name=product["name"],
        selling_price=product["selling_price"],
        tax_rate=product.get("tax_rate", 18.0),
        status="pending_review",
        guest_name=room.get("guest_name"),
        stay_id=room.get("current_stay_id"),
        property_id=gateway["property_id"],
    )
    doc = evt.model_dump()
    doc["detected_at"] = doc["detected_at"].isoformat()
    doc["confirmed_at"] = None
    await db.usage_events.insert_one(doc)
    doc.pop("_id", None)
    await push_notification(
        db, type_="tamper",
        title="Tamper Detected",
        message=f"{product['name']} opened in Room {room['room_number']}",
        severity="danger", property_id=gateway["property_id"], related_id=tag["id"],
    )
    await write_audit(
        db, actor=None, action="tamper_detected", entity_type="tag",
        entity_id=tag["id"],
        description=f"BLE tamper on {product['name']} (Room {room['room_number']})",
        property_id=gateway["property_id"],
    )
    await manager.broadcast("tamper", {
        "tag_id": tag["id"], "room_number": room["room_number"],
        "product_name": product["name"],
    })
    await queue_for_sync(
        db, event_type="usage_event_created",
        payload=doc, property_id=gateway["property_id"],
    )
    return doc


async def _process_ble_event(db, event: GatewayBLEEvent) -> dict:
    """Core ingestion logic — shared by single + batch endpoints.

    Always writes to the local DB first (local-first), then queues for cloud
    sync. ESP32 can buffer events locally and replay them on reconnect via
    the batch endpoint.
    """
    gateway = await auth_mod.get_gateway_from_api_key(event.api_key)
    if gateway["gateway_id"] != event.gateway_id:
        raise HTTPException(status_code=403, detail="Gateway ID mismatch with API key")

    # Check license expiry
    await _check_license_expiry(db, gateway["property_id"])

    now = utc_now()

    # Update gateway last_online + status
    await db.gateways.update_one(
        {"id": gateway["id"]},
        {"$set": {"last_online": now.isoformat(), "status": "online", "rssi": event.rssi}},
    )

    # Lookup tag in same property
    tag = await db.tags.find_one({
        "property_id": gateway["property_id"],
        "$or": [{"tag_id": event.tag_id}, {"ble_mac": event.ble_mac}],
    })
    if not tag:
        return {"ok": True, "note": "Unknown tag, ignored", "tag_id": event.tag_id}

    update_fields = {
        "last_seen": now.isoformat(),
        "battery": event.battery,
        "rssi": event.rssi,
    }
    prev_tamper = tag.get("tamper_status", False)
    new_tamper = bool(event.tamper_status or event.gpio_status > 0)

    await _maybe_alert_low_battery(db, tag, event, gateway, update_fields)
    await db.tags.update_one({"id": tag["id"]}, {"$set": update_fields})

    bill_created = None
    if (not prev_tamper) and new_tamper:
        await db.tags.update_one(
            {"id": tag["id"]},
            {"$set": {"tamper_status": True, "status": "tamper_triggered"}},
        )
        bill_created = await _emit_tamper_bill(db, tag, gateway)

    # Always queue the raw BLE event for cloud sync (telemetry log)
    await queue_for_sync(
        db, event_type="ble_event",
        payload={
            "tag_id": tag["tag_id"], "tag_db_id": tag["id"],
            "gateway_id": gateway["gateway_id"],
            "battery": event.battery, "rssi": event.rssi,
            "tamper_status": new_tamper, "timestamp": event.timestamp or now.isoformat(),
        },
        property_id=gateway["property_id"],
    )

    return {"ok": True, "tag_id": tag["tag_id"], "tag_db_id": tag["id"],
            "bill_created": bool(bill_created)}


@router.post("/ble-event")
async def ble_event(event: GatewayBLEEvent):
    """Ingest a single BLE advertisement event from ESP32 gateway."""
    db = get_db()
    return await _process_ble_event(db, event)


async def _validate_batch_header(raw: list) -> tuple[str, str]:
    """Inspect the first event to enforce per-batch gateway uniformity.
    Returns (api_key, gateway_id). Raises HTTPException for bad inputs."""
    if not isinstance(raw, list):
        raise HTTPException(status_code=400, detail="`events` must be a list")
    if len(raw) > 500:
        raise HTTPException(status_code=413, detail="Batch too large (max 500)")
    if not raw:
        return "", ""
    first = raw[0]
    api_key = first.get("api_key")
    gw_id = first.get("gateway_id")
    if not api_key or not gw_id:
        raise HTTPException(status_code=400, detail="Each event needs api_key + gateway_id")
    gateway = await auth_mod.get_gateway_from_api_key(api_key)
    if gateway["gateway_id"] != gw_id:
        raise HTTPException(status_code=403, detail="Gateway ID mismatch with API key")
    return api_key, gw_id


async def _process_one_batch_entry(db, e: dict, api_key: str, gw_id: str) -> dict:
    """Process a single entry inside a batch; never raises (returns error info)."""
    try:
        event = GatewayBLEEvent(**e)
    except Exception as ex:
        return {"tag_id": e.get("tag_id"), "ok": False, "error": f"validation: {ex}"}
    if event.api_key != api_key or event.gateway_id != gw_id:
        return {"tag_id": event.tag_id, "ok": False, "error": "mixed gateway in batch"}
    try:
        res = await _process_ble_event(db, event)
        return {"tag_id": event.tag_id, "ok": True,
                **{k: v for k, v in res.items() if k != "tag_id"}}
    except HTTPException as he:
        return {"tag_id": event.tag_id, "ok": False,
                "error": str(he.detail), "status": he.status_code}
    except Exception as ex:
        return {"tag_id": event.tag_id, "ok": False, "error": str(ex)}


@router.post("/ble-events/batch")
async def ble_events_batch(payload: dict):
    """Batch upload — used by ESP32 to flush its local offline buffer.

    Body shape:
      { "events": [<GatewayBLEEvent>, ...] }     (max 500 / request)

    All events MUST share the same api_key + gateway_id (one batch per gateway).
    Returns per-event status so the ESP32 can retry only the failed ones.
    """
    db = get_db()
    raw = payload.get("events", [])
    api_key, gw_id = await _validate_batch_header(raw)
    if not raw:
        return {"accepted": 0, "results": []}

    results = []
    accepted = 0
    for e in raw:
        res = await _process_one_batch_entry(db, e, api_key, gw_id)
        results.append(res)
        if res.get("ok"):
            accepted += 1

    return {
        "accepted": accepted,
        "rejected": len(raw) - accepted,
        "gateway_id": gw_id,
        "results": results,
    }


@router.get("/{gateway_id}/health")
async def gateway_health(gateway_id: str, api_key: str = Header(..., alias="X-API-Key")):
    """ESP32 polls this endpoint to confirm cloud reach and get config."""
    db = get_db()
    gw = await auth_mod.get_gateway_from_api_key(api_key)
    if gw["gateway_id"] != gateway_id:
        raise HTTPException(status_code=403, detail="API key/gateway mismatch")
    await db.gateways.update_one(
        {"id": gw["id"]},
        {"$set": {"last_online": utc_now().isoformat(), "status": "online"}},
    )
    return {"ok": True, "server_time": utc_now().isoformat(), "config": {"scan_interval_sec": 15, "low_battery_threshold": LOW_BATTERY_THRESHOLD}}


@router.get("/{gateway_id}/config")
async def gateway_config(gateway_id: str, api_key: str = Header(..., alias="X-API-Key")):
    """ESP32 fetches its runtime config (scan interval, low-battery threshold,
    batch size, server time). The device should call this on boot and every
    ~10 minutes thereafter.
    """
    db = get_db()
    gw = await auth_mod.get_gateway_from_api_key(api_key)
    if gw["gateway_id"] != gateway_id:
        raise HTTPException(status_code=403, detail="API key/gateway mismatch")
    now = utc_now()
    await db.gateways.update_one(
        {"id": gw["id"]},
        {"$set": {"last_online": now.isoformat(), "status": "online"}},
    )
    # Pull property config (so multi-tenant settings can override defaults)
    prop = await db.properties.find_one({"id": gw["property_id"]}, {"_id": 0}) or {}
    return {
        "ok": True,
        "gateway_id": gw["gateway_id"],
        "property_id": gw["property_id"],
        "server_time": now.isoformat(),
        "config": {
            "scan_interval_sec": prop.get("ble_scan_interval_sec", 15),
            "low_battery_threshold": prop.get("low_battery_threshold", LOW_BATTERY_THRESHOLD),
            "batch_max_size": 500,
            "heartbeat_interval_sec": 60,
            "config_refresh_interval_sec": 600,
        },
        "endpoints": {
            "single": "/api/gateway/ble-event",
            "batch": "/api/gateway/ble-events/batch",
            "health": f"/api/gateway/{gw['gateway_id']}/health",
            "config": f"/api/gateway/{gw['gateway_id']}/config",
        },
    }
