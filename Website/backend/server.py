"""SpotyTags main FastAPI server.

Hybrid local + cloud architecture for hotel minibar billing system.
Routes are organised by domain (auth, core, billing, admin, gateway).
"""
from __future__ import annotations

import asyncio
import logging
import os
from datetime import datetime, timezone, timedelta
from pathlib import Path

from dotenv import load_dotenv

ROOT_DIR = Path(__file__).parent
load_dotenv(ROOT_DIR / ".env")

from fastapi import FastAPI, WebSocket, WebSocketDisconnect
from fastapi.responses import FileResponse
from starlette.middleware.cors import CORSMiddleware

from db import init_db, ensure_indexes, seed_admin, seed_demo_users, seed_demo, seed_property, seed_license, DEMO_PROPERTY_ID
from realtime import manager
from middleware import LicenseIntegrityMiddleware
import routes_auth
import routes_core
import routes_billing
import routes_admin
import routes_gateway
import routes_ops
import routes_cloud
import routes_branding
import cloud_sync as cloud_sync_mod

logging.basicConfig(level=logging.INFO, format="%(asctime)s - %(name)s - %(levelname)s - %(message)s")
logger = logging.getLogger("spotytags")

app = FastAPI(title="SpotyTags API", version="1.0.0", description="Hotel minibar billing - local + cloud hybrid")

# ============ CORS ============
cors_origins = os.environ.get("CORS_ORIGINS", "*")
allowed = cors_origins.split(",") if cors_origins != "*" else ["*"]
app.add_middleware(
    CORSMiddleware,
    allow_origins=allowed,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# ============ License integrity middleware ============
# Must be added AFTER CORSMiddleware so CORS headers are still set on 403 responses.
app.add_middleware(LicenseIntegrityMiddleware)

# ============ Routes ============
app.include_router(routes_auth.router)
app.include_router(routes_core.router)
app.include_router(routes_billing.router)
app.include_router(routes_admin.router)
app.include_router(routes_gateway.router)
app.include_router(routes_ops.router)
app.include_router(routes_cloud.router)
app.include_router(routes_branding.router)


@app.get("/api/health")
async def health():
    return {"status": "ok", "ts": datetime.now(timezone.utc).isoformat()}


# ============ APK Download ============
APK_PATH = ROOT_DIR / "downloads" / "app-release.apk"

@app.get("/download/apk")
async def download_apk():
    if not APK_PATH.exists():
        from fastapi import HTTPException
        raise HTTPException(status_code=404, detail="APK not found")
    return FileResponse(
        path=str(APK_PATH),
        media_type="application/vnd.android.package-archive",
        filename="SpotyTags.apk",
    )


@app.get("/api/")
async def root():
    return {"name": "SpotyTags API", "version": "1.0.0", "status": "online"}


# ============ Websocket ============
@app.websocket("/api/ws")
async def websocket_endpoint(websocket: WebSocket):
    await manager.connect(websocket)
    try:
        while True:
            data = await websocket.receive_text()
            # Echo for keepalive
            if data == "ping":
                await websocket.send_text("pong")
    except WebSocketDisconnect:
        await manager.disconnect(websocket)
    except Exception as e:
        logger.warning(f"WS error: {e}")
        await manager.disconnect(websocket)


# ============ Background tasks ============
async def stale_tag_checker():
    """Periodically mark tags not seen for >5 min as 'not_seen' and gateways offline.
    Also simulates BLE heartbeats for demo so assigned tags stay 'active'.
    """
    from db import get_db, DEMO_PROPERTY_ID
    while True:
        try:
            await asyncio.sleep(60)
            db = get_db()
            now = datetime.now(timezone.utc)

            # Demo-mode heartbeat: refresh last_seen on assigned demo tags every minute
            # (without this they'd get marked 'not_seen' after 5 min when no real ESP32 events come in)
            if os.environ.get("SEED_DEMO_DATA", "true").lower() == "true":
                await db.tags.update_many(
                    {"property_id": DEMO_PROPERTY_ID, "assigned_room_id": {"$ne": None}, "status": {"$in": ["active", "not_seen"]}, "tamper_status": {"$ne": True}},
                    {"$set": {"last_seen": now.isoformat(), "status": "active"}},
                )
                await db.gateways.update_many(
                    {"property_id": DEMO_PROPERTY_ID},
                    {"$set": {"last_online": now.isoformat(), "status": "online"}},
                )

            stale_cut = (now - timedelta(minutes=5)).isoformat()
            gw_cut = (now - timedelta(minutes=10)).isoformat()
            # Mark stale tags
            tags = await db.tags.find({"last_seen": {"$lt": stale_cut, "$ne": None}, "status": "active"}, {"_id": 0}).to_list(500)
            for tag in tags:
                await db.tags.update_one({"id": tag["id"]}, {"$set": {"status": "not_seen"}})
            # Mark offline gateways
            await db.gateways.update_many(
                {"last_online": {"$lt": gw_cut, "$ne": None}, "status": "online"},
                {"$set": {"status": "offline"}},
            )
        except Exception as e:
            logger.warning(f"stale checker error: {e}")


async def license_expiry_checker():
    """Check license expiry hourly and post notifications."""
    from db import get_db
    from realtime import push_notification
    from license_verifier import decrypt_license_doc
    while True:
        try:
            await asyncio.sleep(3600)
            db = get_db()
            raw_docs = await db.licenses.find({}, {"_id": 0}).to_list(100)
            for raw in raw_docs:
                try:
                    lic = decrypt_license_doc(raw)
                    exp = datetime.fromisoformat(str(lic.get("expiry_date", "")).replace("Z", "+00:00"))
                    days = (exp - datetime.now(timezone.utc)).days
                    if days < 0 and lic.get("status") != "expired":
                        # Only status is stored in plaintext — safe to $set directly
                        await db.licenses.update_one(
                            {"property_id": lic["property_id"]},
                            {"$set": {"status": "expired"}},
                        )
                        await push_notification(
                            db, type_="license_expired", title="License Expired",
                            message=f"License for {lic.get('property_name', lic['property_id'])} has expired",
                            severity="danger", property_id=lic["property_id"],
                        )
                    elif 0 <= days <= 7 and lic.get("status") not in ("expiring_soon", "expired"):
                        await db.licenses.update_one(
                            {"property_id": lic["property_id"]},
                            {"$set": {"status": "expiring_soon"}},
                        )
                except Exception as exc:
                    logger.warning("license expiry checker: skipping doc — %s", exc)
        except Exception as e:
            logger.warning("license checker error: %s", e)


_bg_tasks: list = []


@app.on_event("startup")
async def on_startup():
    # ── 1. License integrity checks (clock rollback, key availability) ──────
    from license_verifier import run_startup_checks
    ok, msg = run_startup_checks()
    if not ok:
        # Server starts but all non-exempt endpoints will return 403.
        logger.critical("STARTUP INTEGRITY FAILURE: %s", msg)
    else:
        logger.info("License integrity checks passed ✓")

    # ── 2. Database init + seeding ──────────────────────────────────────────
    db = init_db()
    await ensure_indexes(db)
    await seed_admin(db)
    if os.environ.get("SEED_DEMO_DATA", "false").lower() == "true":
        await seed_demo_users(db)
        await seed_demo(db)
    else:
        await seed_property(db)
        await seed_license(db)
        logger.info("System initialized with essential property and license context ✓")

    # ── 3. Background tasks ─────────────────────────────────────────────────
    _bg_tasks.append(asyncio.create_task(stale_tag_checker()))
    _bg_tasks.append(asyncio.create_task(license_expiry_checker()))
    from db import get_db
    _bg_tasks.append(asyncio.create_task(cloud_sync_mod.sync_loop(get_db)))
    logger.info("SpotyTags API ready ✓")


@app.on_event("shutdown")
async def on_shutdown():
    for t in _bg_tasks:
        t.cancel()
    from db import close_db
    await close_db()


if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8001)
