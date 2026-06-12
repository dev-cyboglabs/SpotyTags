"""Cloud sync — local-first event queue + background flusher.

Architecture:
* Every mutation that should reach the cloud is `queue_event`d into a
  `cloud_sync_queue` collection with status `pending`.
* A background task picks up batches every CLOUD_SYNC_INTERVAL seconds and
  POSTs them to CLOUD_INGEST_URL (default = our own /api/cloud/ingest — a
  mock cloud receiver that lives in the same backend for demo).
* On success → status `synced`. On failure → `failed` with exponential
  retry up to MAX_ATTEMPTS, then `dead_letter`.
* A single `cloud_sync_status` doc per property tracks last sync time +
  online/offline flag + last error.

This implements true "local-first": local DB is always the source of
truth, the cloud is eventually consistent.
"""
from __future__ import annotations

import asyncio
import json
import logging
import os
from datetime import datetime, timezone, timedelta
from typing import Any

import httpx

from models import utc_now, new_id

logger = logging.getLogger("spotytags.sync")

# Tunables
CLOUD_SYNC_INTERVAL = int(os.environ.get("CLOUD_SYNC_INTERVAL", "30"))
CLOUD_BATCH_SIZE = int(os.environ.get("CLOUD_BATCH_SIZE", "50"))
MAX_ATTEMPTS = int(os.environ.get("CLOUD_MAX_ATTEMPTS", "5"))
CLOUD_REQUEST_TIMEOUT = float(os.environ.get("CLOUD_REQUEST_TIMEOUT", "10"))


def _default_cloud_url() -> str:
    """Use our own mock cloud receiver by default."""
    port = os.environ.get("PORT", "8001")
    return os.environ.get("CLOUD_INGEST_URL", f"http://127.0.0.1:{port}/api/cloud/ingest")


def _cloud_token() -> str:
    return os.environ.get("CLOUD_API_KEY", "demo-cloud-key")


# ============ Public API ============
async def queue_event(db, *, event_type: str, payload: dict, property_id: str,
                      idempotency_key: str | None = None) -> str:
    """Enqueue a single event for cloud sync. Returns queue entry id."""
    entry = {
        "id": new_id(),
        "event_type": event_type,
        "payload": _sanitize(payload),
        "property_id": property_id,
        "idempotency_key": idempotency_key or new_id(),
        "status": "pending",  # pending → in_flight → synced/failed/dead_letter
        "attempts": 0,
        "last_error": None,
        "queued_at": utc_now().isoformat(),
        "next_retry_at": utc_now().isoformat(),
        "synced_at": None,
    }
    await db.cloud_sync_queue.insert_one(entry)
    entry.pop("_id", None)
    return entry["id"]


def _sanitize(doc: Any) -> Any:
    """Strip Mongo `_id` from any payload going to the cloud + ensure JSON-safe."""
    if isinstance(doc, dict):
        out = {}
        for k, v in doc.items():
            if k == "_id":
                continue
            out[k] = _sanitize(v)
        return out
    if isinstance(doc, list):
        return [_sanitize(x) for x in doc]
    if isinstance(doc, datetime):
        return doc.isoformat()
    return doc


async def get_queue_stats(db, property_id: str) -> dict:
    pending = await db.cloud_sync_queue.count_documents({"property_id": property_id, "status": "pending"})
    failed = await db.cloud_sync_queue.count_documents({"property_id": property_id, "status": "failed"})
    dead = await db.cloud_sync_queue.count_documents({"property_id": property_id, "status": "dead_letter"})
    synced = await db.cloud_sync_queue.count_documents({"property_id": property_id, "status": "synced"})
    last_sync = await db.cloud_sync_status.find_one({"property_id": property_id}, {"_id": 0})
    last_failed = await db.cloud_sync_queue.find_one(
        {"property_id": property_id, "status": {"$in": ["failed", "dead_letter"]}},
        {"_id": 0}, sort=[("queued_at", -1)],
    )
    return {
        "online": (last_sync or {}).get("online", True),
        "last_sync_at": (last_sync or {}).get("last_sync_at"),
        "pending_count": pending,
        "failed_count": failed,
        "dead_letter_count": dead,
        "synced_count": synced,
        "last_error": (last_sync or {}).get("last_error") or (last_failed or {}).get("last_error"),
        "cloud_url": _default_cloud_url(),
        "interval_sec": CLOUD_SYNC_INTERVAL,
        "batch_size": CLOUD_BATCH_SIZE,
        "max_attempts": MAX_ATTEMPTS,
    }


async def list_queue(db, property_id: str, status: str | None = None, limit: int = 100) -> list:
    q: dict = {"property_id": property_id}
    if status:
        q["status"] = status
    cursor = db.cloud_sync_queue.find(q, {"_id": 0}).sort("queued_at", -1).limit(limit)
    return await cursor.to_list(limit)


# ============ Worker ============
def _build_batch_payload(batch: list) -> dict:
    return {
        "events": [{
            "id": e["id"],
            "event_type": e["event_type"],
            "payload": e["payload"],
            "property_id": e["property_id"],
            "idempotency_key": e["idempotency_key"],
            "queued_at": e["queued_at"],
        } for e in batch],
    }


async def _mark_batch_offline(db, batch: list, err: str) -> int:
    """Mark every entry as failed + flip property-level sync_status to offline.
    Returns count failed."""
    failed = 0
    for entry in batch:
        await _mark_failed(db, entry, err)
        failed += 1
    seen_props = {e["property_id"] for e in batch}
    for pid in seen_props:
        await db.cloud_sync_status.update_one(
            {"property_id": pid},
            {"$set": {"online": False, "last_error": err}},
            upsert=True,
        )
    return failed


async def _apply_cloud_response(db, batch: list, resp_json: dict) -> tuple[int, int]:
    """Mark accepted entries as synced, rejected entries for retry.
    Returns (synced_count, failed_count)."""
    accepted_ids = {e["id"] for e in resp_json.get("accepted", [])}
    now_iso = utc_now().isoformat()
    if accepted_ids:
        await db.cloud_sync_queue.update_many(
            {"id": {"$in": list(accepted_ids)}},
            {"$set": {"status": "synced", "synced_at": now_iso, "last_error": None}},
        )
    synced = len(accepted_ids)
    failed = 0
    for e in batch:
        if e["id"] not in accepted_ids:
            await _mark_failed(db, e, "rejected by cloud")
            failed += 1
    # Mark property as online (we did reach the cloud successfully)
    seen_props = {e["property_id"] for e in batch}
    for pid in seen_props:
        await db.cloud_sync_status.update_one(
            {"property_id": pid},
            {"$set": {"online": True, "last_sync_at": now_iso, "last_error": None}},
            upsert=True,
        )
    return synced, failed


async def flush_now(db, property_id: str | None = None) -> dict:
    """Process all pending events immediately. Returns summary stats.

    If `property_id` is given, only that property's events are flushed.
    """
    q: dict = {"status": "pending", "next_retry_at": {"$lte": utc_now().isoformat()}}
    if property_id:
        q["property_id"] = property_id
    batch = await db.cloud_sync_queue.find(q, {"_id": 0}).limit(CLOUD_BATCH_SIZE).to_list(CLOUD_BATCH_SIZE)
    if not batch:
        return {"processed": 0, "synced": 0, "failed": 0}

    synced = 0
    failed = 0
    try:
        async with httpx.AsyncClient(timeout=CLOUD_REQUEST_TIMEOUT) as client:
            resp = await client.post(
                _default_cloud_url(),
                json=_build_batch_payload(batch),
                headers={"X-Cloud-Auth": _cloud_token()},
            )
        if 200 <= resp.status_code < 300:
            synced, failed = await _apply_cloud_response(db, batch, resp.json())
        else:
            err = f"HTTP {resp.status_code}: {resp.text[:200]}"
            failed = await _mark_batch_offline(db, batch, err)
    except (httpx.RequestError, httpx.TimeoutException) as e:
        err = f"network: {type(e).__name__}: {str(e)[:200]}"
        failed = await _mark_batch_offline(db, batch, err)
    return {"processed": len(batch), "synced": synced, "failed": failed}


async def _mark_failed(db, entry: dict, err: str) -> None:
    """Increment attempts + schedule next retry via exponential backoff."""
    attempts = entry.get("attempts", 0) + 1
    if attempts >= MAX_ATTEMPTS:
        status = "dead_letter"
        next_retry = utc_now().isoformat()
    else:
        status = "pending"
        # 30s, 1m, 2m, 4m, 8m
        delay_sec = 30 * (2 ** (attempts - 1))
        next_retry = (utc_now() + timedelta(seconds=delay_sec)).isoformat()
    await db.cloud_sync_queue.update_one(
        {"id": entry["id"]},
        {"$set": {
            "status": status, "attempts": attempts,
            "last_error": err, "next_retry_at": next_retry,
        }},
    )


async def retry_dead_letters(db, property_id: str | None = None) -> int:
    """Reset dead_letter entries back to pending for one more attempt."""
    q: dict = {"status": "dead_letter"}
    if property_id:
        q["property_id"] = property_id
    res = await db.cloud_sync_queue.update_many(
        q, {"$set": {"status": "pending", "attempts": 0, "next_retry_at": utc_now().isoformat()}},
    )
    return res.modified_count


async def cleanup_synced(db, older_than_days: int = 7) -> int:
    """Drop synced entries older than N days to keep collection small."""
    cutoff = (utc_now() - timedelta(days=older_than_days)).isoformat()
    res = await db.cloud_sync_queue.delete_many({"status": "synced", "synced_at": {"$lt": cutoff}})
    return res.deleted_count


# ============ Background loop ============
async def sync_loop(get_db_fn):
    """Forever-running task started by FastAPI on_startup."""
    # Small initial delay so the server is fully up
    await asyncio.sleep(5)
    while True:
        try:
            db = get_db_fn()
            await flush_now(db)
        except asyncio.CancelledError:
            raise
        except Exception as e:
            logger.warning(f"sync_loop iteration error: {e}")
        await asyncio.sleep(CLOUD_SYNC_INTERVAL)
