"""MongoDB connection + indexes + demo data seeder."""
from __future__ import annotations

import os
import secrets
from datetime import datetime, timezone, timedelta
from typing import Optional

from motor.motor_asyncio import AsyncIOMotorClient, AsyncIOMotorDatabase

from security import hash_password, verify_password
from models import (
    Property, Room, Tag, Gateway, Product, License, Notification,
    AuditLog, ThemeSettings, utc_now, new_id,
)

_client: Optional[AsyncIOMotorClient] = None
_db: Optional[AsyncIOMotorDatabase] = None


def init_db() -> AsyncIOMotorDatabase:
    """Initialise the Mongo client + db handle. Idempotent."""
    global _client, _db
    if _db is None:
        _client = AsyncIOMotorClient(os.environ["MONGO_URL"])
        _db = _client[os.environ["DB_NAME"]]
    return _db


def get_db() -> AsyncIOMotorDatabase:
    """Return the cached db handle; lazily initialises on first call."""
    global _db
    if _db is None:
        return init_db()
    return _db


async def close_db() -> None:
    global _client
    if _client is not None:
        _client.close()


async def ensure_indexes(db: AsyncIOMotorDatabase) -> None:
    await db.users.create_index("email", unique=True)
    await db.users.create_index("id", unique=True)
    await db.rooms.create_index([("property_id", 1), ("room_number", 1)], unique=True)
    await db.rooms.create_index("id", unique=True)
    await db.tags.create_index([("property_id", 1), ("tag_id", 1)], unique=True)
    await db.tags.create_index("id", unique=True)
    await db.tags.create_index("ble_mac")
    await db.gateways.create_index("api_key", unique=True)
    await db.gateways.create_index([("property_id", 1), ("gateway_id", 1)], unique=True)
    await db.gateways.create_index("id", unique=True)
    await db.products.create_index("id", unique=True)
    await db.usage_events.create_index("id", unique=True)
    await db.usage_events.create_index("detected_at")
    await db.usage_events.create_index("status")
    await db.usage_events.create_index("stay_id")
    await db.licenses.create_index("property_id", unique=True)
    await db.notifications.create_index([("property_id", 1), ("created_at", -1)])
    await db.audit_logs.create_index([("property_id", 1), ("created_at", -1)])
    await db.login_attempts.create_index("identifier")
    # Cloud sync queue indexes
    await db.cloud_sync_queue.create_index("id", unique=True)
    await db.cloud_sync_queue.create_index("idempotency_key", unique=True)
    await db.cloud_sync_queue.create_index([("status", 1), ("next_retry_at", 1)])
    await db.cloud_sync_queue.create_index([("property_id", 1), ("queued_at", -1)])
    await db.cloud_ingested_events.create_index("idempotency_key", unique=True, sparse=True)
    await db.cloud_ingested_events.create_index([("property_id", 1), ("ingested_at", -1)])


# ============ Seeders ============
DEMO_PROPERTY_ID = "PROP-001"


async def seed_admin(db: AsyncIOMotorDatabase) -> None:
    admin_email = os.environ.get("ADMIN_EMAIL", "admin@spotytags.com").lower()
    admin_password = os.environ.get("ADMIN_PASSWORD", "Admin@123")
    existing = await db.users.find_one({"email": admin_email})
    if existing is None:
        await db.users.insert_one({
            "id": new_id(),
            "email": admin_email,
            "name": "Super Admin",
            "password_hash": hash_password(admin_password),
            "role": "super_admin",
            "property_id": DEMO_PROPERTY_ID,
            "active": True,
            "created_at": utc_now().isoformat(),
        })
    elif not verify_password(admin_password, existing.get("password_hash", "")):
        await db.users.update_one(
            {"email": admin_email},
            {"$set": {"password_hash": hash_password(admin_password)}},
        )


async def seed_demo_users(db: AsyncIOMotorDatabase) -> None:
    demo_users = [
        {"email": "hotel.admin@spotytags.com", "name": "Hotel Admin", "role": "hotel_admin", "password": "Hotel@123"},
        {"email": "reception@spotytags.com", "name": "Reception Staff", "role": "reception", "password": "Recep@123"},
        {"email": "housekeeping@spotytags.com", "name": "Housekeeping Staff", "role": "housekeeping", "password": "House@123"},
        {"email": "tech@spotytags.com", "name": "Technician", "role": "technician", "password": "Tech@123"},
    ]
    for u in demo_users:
        if await db.users.find_one({"email": u["email"]}) is None:
            await db.users.insert_one({
                "id": new_id(),
                "email": u["email"],
                "name": u["name"],
                "password_hash": hash_password(u["password"]),
                "role": u["role"],
                "property_id": DEMO_PROPERTY_ID,
                "active": True,
                "created_at": utc_now().isoformat(),
            })


async def seed_property(db: AsyncIOMotorDatabase) -> None:
    if await db.properties.find_one({"id": DEMO_PROPERTY_ID}) is None:
        prop = Property(
            id=DEMO_PROPERTY_ID,
            name="Spoty Grand Hotel",
            address="MG Road, Bangalore, India",
            phone="+91 80 1234 5678",
            timezone="Asia/Kolkata",
            currency="INR",
        )
        doc = prop.model_dump()
        doc["created_at"] = doc["created_at"].isoformat()
        # International defaults — set on initial seed only
        doc["currency_code"] = "INR"
        doc["currency_symbol"] = "₹"
        doc["currency_locale"] = "en-IN"
        doc["currency_decimals"] = 2
        doc["country"] = "India"
        doc["city"] = "Bangalore"
        doc["status"] = "active"
        await db.properties.insert_one(doc)


async def get_hotel_name(db: AsyncIOMotorDatabase) -> str:
    """Fetch hotel name from branding or property collection, with fallback."""
    # Try to get from branding first
    branding = await db.branding.find_one({"property_id": DEMO_PROPERTY_ID})
    if branding and branding.get("hotel_name"):
        return branding["hotel_name"]
    # Fallback to property collection
    prop = await db.properties.find_one({"id": DEMO_PROPERTY_ID})
    if prop and prop.get("name"):
        return prop["name"]
    # Ultimate fallback
    return "Spoty Grand Hotel"


async def seed_license(db: AsyncIOMotorDatabase) -> None:
    if await db.licenses.find_one({"property_id": DEMO_PROPERTY_ID}) is None:
        hotel_name = await get_hotel_name(db)
        # Fetch hotel group from branding if available
        branding = await db.branding.find_one({"property_id": DEMO_PROPERTY_ID})
        hotel_group = branding.get("hotel_group") if branding else "Spoty Hospitality Group"
        lic = License(
            license_key=f"SPOTY-{secrets.token_hex(8).upper()}",
            property_id=DEMO_PROPERTY_ID,
            hotel_group=hotel_group,
            property_name=hotel_name,
            plan="professional",
            status="active",
            start_date=utc_now(),
            expiry_date=utc_now() + timedelta(days=365),
            room_limit=99999,
            gateway_limit=99999,
            tag_limit=99999,
            user_limit=99999,
            pms_enabled=True,
            android_enabled=True,
            reports_enabled=True,
            theme_customization_enabled=True,
            offline_mode_enabled=True,
            auto_billing_enabled=False,
            cloud_sync_enabled=True,
        )
        doc = lic.model_dump()
        doc["start_date"] = doc["start_date"].isoformat()
        doc["expiry_date"] = doc["expiry_date"].isoformat()
        doc["created_at"] = doc["created_at"].isoformat()
        doc["updated_at"] = doc["updated_at"].isoformat()
        # Encrypt sensitive fields before storing
        from license_verifier import encrypt_license_doc
        doc = encrypt_license_doc(doc)
        await db.licenses.insert_one(doc)


async def seed_products(db: AsyncIOMotorDatabase) -> list:
    products = [
        {"name": "Mineral Water", "category": "water", "brand": "Bisleri", "bottle_size": "500ml", "selling_price": 80.0, "image_url": "https://images.unsplash.com/photo-1560847468-5eef72e62b8f?w=400"},
        {"name": "Coca-Cola", "category": "soft_drink", "brand": "Coca-Cola", "bottle_size": "330ml", "selling_price": 150.0, "image_url": "https://images.unsplash.com/photo-1554866585-cd94860890b7?w=400"},
        {"name": "Sprite", "category": "soft_drink", "brand": "Sprite", "bottle_size": "330ml", "selling_price": 150.0, "image_url": "https://images.unsplash.com/photo-1625772299848-391b6a87d7b3?w=400"},
        {"name": "Orange Juice", "category": "juice", "brand": "Tropicana", "bottle_size": "250ml", "selling_price": 180.0, "image_url": "https://images.unsplash.com/photo-1613478223719-2ab802602423?w=400"},
        {"name": "Red Bull Energy", "category": "energy_drink", "brand": "Red Bull", "bottle_size": "250ml", "selling_price": 250.0, "image_url": "https://images.unsplash.com/photo-1622543925917-763c34d1a86e?w=400"},
    ]
    created = []
    for p in products:
        existing = await db.products.find_one({"name": p["name"], "property_id": DEMO_PROPERTY_ID})
        if existing is None:
            prod = Product(property_id=DEMO_PROPERTY_ID, **p)
            doc = prod.model_dump()
            doc["created_at"] = doc["created_at"].isoformat()
            await db.products.insert_one(doc)
            created.append(doc)
        else:
            created.append(existing)
    return created


async def seed_rooms(db: AsyncIOMotorDatabase) -> list:
    rooms_data = [
        {"room_number": "101", "floor": "1", "room_type": "Deluxe", "status": "occupied", "guest_name": "Mr. Sharma"},
        {"room_number": "102", "floor": "1", "room_type": "Deluxe", "status": "vacant"},
        {"room_number": "103", "floor": "1", "room_type": "Suite", "status": "cleaning"},
        {"room_number": "201", "floor": "2", "room_type": "Deluxe", "status": "occupied", "guest_name": "Ms. Patel"},
        {"room_number": "202", "floor": "2", "room_type": "Premium Suite", "status": "occupied", "guest_name": "Mr. Khan"},
        {"room_number": "203", "floor": "2", "room_type": "Suite", "status": "checkout_pending", "guest_name": "Mr. Joshi"},
    ]
    created = []
    for r in rooms_data:
        existing = await db.rooms.find_one({"room_number": r["room_number"], "property_id": DEMO_PROPERTY_ID})
        if existing is None:
            room = Room(property_id=DEMO_PROPERTY_ID, **r)
            doc = room.model_dump()
            doc["created_at"] = doc["created_at"].isoformat()
            doc["last_updated"] = doc["last_updated"].isoformat()
            await db.rooms.insert_one(doc)
            created.append(doc)
        else:
            created.append(existing)
    return created


async def seed_gateways(db: AsyncIOMotorDatabase, rooms: list) -> list:
    gw_data = [
        {"gateway_id": "GW-101", "mac": "AA:BB:CC:01:01:01", "ip": "192.168.1.101", "room_number": "101"},
        {"gateway_id": "GW-102", "mac": "AA:BB:CC:01:02:01", "ip": "192.168.1.102", "room_number": "102"},
        {"gateway_id": "GW-201", "mac": "AA:BB:CC:02:01:01", "ip": "192.168.1.201", "room_number": "201"},
        {"gateway_id": "GW-202", "mac": "AA:BB:CC:02:02:01", "ip": "192.168.1.202", "room_number": "202"},
    ]
    created = []
    rooms_by_number = {r["room_number"]: r for r in rooms}
    for g in gw_data:
        existing = await db.gateways.find_one({"gateway_id": g["gateway_id"], "property_id": DEMO_PROPERTY_ID})
        if existing is None:
            room = rooms_by_number.get(g["room_number"])
            gw = Gateway(
                gateway_id=g["gateway_id"],
                mac_address=g["mac"],
                ip_address=g["ip"],
                wifi_ssid="SpotyHotel-IoT",
                firmware_version="v1.2.3",
                api_key=f"gw_{secrets.token_hex(16)}",
                room_id=room["id"] if room else None,
                room_number=g["room_number"],
                floor=g["room_number"][0],
                status="online",
                last_online=utc_now(),
                rssi=-55,
                property_id=DEMO_PROPERTY_ID,
            )
            doc = gw.model_dump()
            doc["created_at"] = doc["created_at"].isoformat()
            doc["last_online"] = doc["last_online"].isoformat() if doc.get("last_online") else None
            await db.gateways.insert_one(doc)
            # link room
            if room:
                await db.rooms.update_one({"id": room["id"]}, {"$set": {"gateway_id": gw.id}})
            created.append(doc)
        else:
            created.append(existing)
    return created


async def seed_tags(db: AsyncIOMotorDatabase, rooms: list, products: list) -> None:
    # Create 20 tags; first 12 assigned to rooms (2 per room × 6 rooms), rest unassigned
    existing_count = await db.tags.count_documents({"property_id": DEMO_PROPERTY_ID})
    if existing_count >= 20:
        return
    products_cycle = products[:4]  # 4 different products for variety
    tags_per_room = 2
    for i in range(1, 21):
        tag_id = f"ST-{i:06d}"
        if await db.tags.find_one({"tag_id": tag_id, "property_id": DEMO_PROPERTY_ID}):
            continue
        assigned_room = None
        assigned_product = None
        status = "unassigned"
        last_seen = None
        battery = 100
        if i <= len(rooms) * tags_per_room:
            room_idx = (i - 1) // tags_per_room
            prod_idx = (i - 1) % len(products_cycle)
            assigned_room = rooms[room_idx]
            assigned_product = products_cycle[prod_idx]
            status = "active"
            last_seen = utc_now()
            battery = 100 - (i * 3) % 60
        tag = Tag(
            tag_id=tag_id,
            qr_code=tag_id,
            ble_mac=f"AA:BB:CC:DD:{(i // 256):02X}:{(i % 256):02X}",
            battery=battery,
            tamper_status=False,
            rssi=-50 - (i % 30),
            firmware_version="v2.1.0",
            manufacturing_batch="BATCH-2026-01",
            status=status,
            assigned_room_id=assigned_room["id"] if assigned_room else None,
            assigned_product_id=assigned_product["id"] if assigned_product else None,
            selling_price=assigned_product["selling_price"] if assigned_product else None,
            last_seen=last_seen,
            property_id=DEMO_PROPERTY_ID,
        )
        doc = tag.model_dump()
        doc["created_at"] = doc["created_at"].isoformat()
        doc["last_seen"] = doc["last_seen"].isoformat() if doc.get("last_seen") else None
        await db.tags.insert_one(doc)


async def seed_demo(db: AsyncIOMotorDatabase) -> None:
    await seed_property(db)
    await seed_license(db)
    products = await seed_products(db)
    rooms = await seed_rooms(db)
    await seed_gateways(db, rooms)
    await seed_tags(db, rooms, products)
    # Clean up any chain demo properties left over from a previous build
    await _remove_orphan_chain_properties(db)
    # Refresh "live" state so demo always looks alive after restarts
    now_iso = utc_now().isoformat()
    await db.tags.update_many(
        {"property_id": DEMO_PROPERTY_ID, "assigned_room_id": {"$ne": None}, "status": {"$in": ["active", "not_seen"]}},
        {"$set": {"last_seen": now_iso, "status": "active", "tamper_status": False}},
    )
    await db.gateways.update_many(
        {"property_id": DEMO_PROPERTY_ID},
        {"$set": {"last_online": now_iso, "status": "online"}},
    )


async def _remove_orphan_chain_properties(db: AsyncIOMotorDatabase) -> None:
    """Clean up multi-property seed data from older versions (single-tenant only now)."""
    orphan_ids = ["PROP-002", "PROP-003", "PROP-004", "PROP-TEST", "PROP-UITEST"]
    for pid in orphan_ids:
        if await db.properties.find_one({"id": pid}) is not None:
            for col in ("rooms", "tags", "gateways", "products", "usage_events",
                         "licenses", "audit_logs", "notifications", "cloud_sync_queue",
                         "cloud_sync_status"):
                await db[col].delete_many({"property_id": pid})
            await db.properties.delete_one({"id": pid})



async def write_test_credentials() -> None:
    """Write demo accounts to /app/memory/test_credentials.md for testing agent."""
    content = """# SpotyTags Test Credentials

## Web Dashboard (https://staff-app-preview.preview.emergentagent.com)

| Role | Email | Password |
| --- | --- | --- |
| Super Admin | admin@spotytags.com | Admin@123 |
| Hotel Admin | hotel.admin@spotytags.com | Hotel@123 |
| Reception | reception@spotytags.com | Recep@123 |
| Housekeeping | housekeeping@spotytags.com | House@123 |
| Technician | tech@spotytags.com | Tech@123 |

## API Endpoints

- POST /api/auth/login        — login (sets httpOnly cookies)
- POST /api/auth/logout       — logout
- GET  /api/auth/me           — current user
- POST /api/auth/refresh      — refresh access token
- GET  /api/dashboard/kpi     — dashboard KPIs
- GET  /api/rooms             — list rooms
- GET  /api/tags              — list tags
- GET  /api/gateways          — list gateways
- GET  /api/products          — product catalog
- GET  /api/billing/pending   — pending usage events
- POST /api/billing/{id}/action — confirm/waive/dispute
- GET  /api/license/current   — license details
- GET  /api/notifications     — notifications
- GET  /api/audit             — audit logs
- POST /api/gateway/ble-event — ESP32 BLE event ingestion (api_key auth)

## Test Gateway API Key
Look up via: `db.gateways.findOne({gateway_id: 'GW-101'}, {api_key: 1})`

## Default Property
- Property ID: PROP-001
- Property Name: Spoty Grand Hotel
"""
    from pathlib import Path
    p = Path("/app/memory")
    p.mkdir(parents=True, exist_ok=True)
    (p / "test_credentials.md").write_text(content)
