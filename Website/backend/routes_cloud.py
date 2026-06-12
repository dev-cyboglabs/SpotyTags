"""Cloud sync routes.

* `POST /api/cloud/ingest` — the mock cloud receiver. In production this lives
  on a separate server; here it lives in the same backend so the demo is
  fully self-contained. Stores incoming events in `cloud_ingested_events`.
* Management endpoints — list queue, force flush, retry dead-letter, etc.
"""
from __future__ import annotations

import os
from typing import Optional

from fastapi import APIRouter, Depends, Header, HTTPException

import auth as auth_mod
import cloud_sync
from db import get_db
from models import utc_now

router = APIRouter(prefix="/api/cloud", tags=["cloud"])


def _cloud_token() -> str:
    return os.environ.get("CLOUD_API_KEY", "demo-cloud-key")


# ============ Cloud receiver (mock) ============
@router.post("/ingest")
async def ingest(payload: dict, x_cloud_auth: Optional[str] = Header(None, alias="X-Cloud-Auth")):
    """Mock cloud receiver — accepts a batch of events and stores them."""
    if x_cloud_auth != _cloud_token():
        raise HTTPException(status_code=401, detail="Invalid cloud auth token")
    db = get_db()
    events = payload.get("events", [])
    if not isinstance(events, list):
        raise HTTPException(status_code=400, detail="`events` must be a list")
    if len(events) > 200:
        raise HTTPException(status_code=413, detail="Batch too large (max 200)")

    accepted = []
    rejected = []
    now_iso = utc_now().isoformat()
    for evt in events:
        if not evt.get("id") or not evt.get("event_type"):
            rejected.append({"id": evt.get("id"), "reason": "missing id or event_type"})
            continue
        # Idempotency: skip if already stored
        existing = await db.cloud_ingested_events.find_one(
            {"idempotency_key": evt.get("idempotency_key")}, {"_id": 0},
        )
        if existing:
            accepted.append({"id": evt["id"], "deduplicated": True})
            continue
        await db.cloud_ingested_events.insert_one({
            **{k: v for k, v in evt.items() if k != "_id"},
            "ingested_at": now_iso,
        })
        accepted.append({"id": evt["id"]})
    return {"accepted": accepted, "rejected": rejected, "ingested_at": now_iso}


@router.get("/ingested")
async def list_ingested(limit: int = 50,
                         x_cloud_auth: Optional[str] = Header(None, alias="X-Cloud-Auth")):
    """Inspect what the mock cloud has received (for demo / debugging)."""
    if x_cloud_auth != _cloud_token():
        raise HTTPException(status_code=401, detail="Invalid cloud auth token")
    db = get_db()
    docs = await db.cloud_ingested_events.find({}, {"_id": 0}).sort("ingested_at", -1).limit(limit).to_list(limit)
    return docs


# ============ Sync management (authenticated) ============
@router.get("/queue")
async def get_queue(
    user: dict = Depends(auth_mod.get_current_user),
    status: Optional[str] = None,
    limit: int = 100,
):
    db = get_db()
    return await cloud_sync.list_queue(db, user["property_id"], status=status, limit=limit)


@router.get("/status")
async def get_status(user: dict = Depends(auth_mod.get_current_user)):
    db = get_db()
    return await cloud_sync.get_queue_stats(db, user["property_id"])


@router.post("/flush")
async def flush(user: dict = Depends(auth_mod.require_roles("hotel_admin", "super_admin"))):
    """Force-flush the queue immediately."""
    db = get_db()
    result = await cloud_sync.flush_now(db, property_id=user["property_id"])
    return result


@router.post("/retry-failed")
async def retry_failed(user: dict = Depends(auth_mod.require_roles("hotel_admin", "super_admin"))):
    """Move dead-letter entries back to pending."""
    db = get_db()
    moved = await cloud_sync.retry_dead_letters(db, property_id=user["property_id"])
    if moved:
        await cloud_sync.flush_now(db, property_id=user["property_id"])
    return {"requeued": moved}


@router.delete("/cleanup")
async def cleanup(user: dict = Depends(auth_mod.require_roles("hotel_admin", "super_admin")),
                  older_than_days: int = 7):
    db = get_db()
    deleted = await cloud_sync.cleanup_synced(db, older_than_days=older_than_days)
    return {"deleted": deleted}
