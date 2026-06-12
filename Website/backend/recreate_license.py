#!/usr/bin/env python3
"""Recreate license for PROP-001 with proper encryption."""
import os
import sys
from datetime import datetime, timezone, timedelta
from motor.motor_asyncio import AsyncIOMotorClient
from dotenv import load_dotenv

load_dotenv()

MONGO_URL = os.environ.get("MONGO_URL", "mongodb://localhost:27017")
DB_NAME = os.environ.get("DB_NAME", "spotytags")

async def recreate_license():
    from crypto_utils import aes_encrypt, make_signature, get_enc_key, get_hmac_key
    import secrets
    
    enc_key = get_enc_key()
    hmac_key = get_hmac_key()
    
    client = AsyncIOMotorClient(MONGO_URL)
    db = client[DB_NAME]
    
    # Check if property exists
    prop = await db.properties.find_one({"id": "PROP-001"})
    if not prop:
        print("ERROR: Property PROP-001 not found")
        sys.exit(1)
    
    # Create license data
    lic_data = {
        "plan": "professional",
        "expiry_date": (datetime.now(timezone.utc) + timedelta(days=365)).isoformat(),
        "tag_limit": 99999,
        "gateway_limit": 99999,
        "user_limit": 99999,
        "room_limit": 99999,
        "status": "active",
        "pms_enabled": True,
        "android_enabled": True,
        "reports_enabled": True,
        "theme_customization_enabled": True,
        "offline_mode_enabled": True,
        "auto_billing_enabled": False,
        "cloud_sync_enabled": True,
    }
    
    # Encrypt
    encrypted_data = aes_encrypt(lic_data, enc_key)
    signature = make_signature("PROP-001", encrypted_data, hmac_key)
    
    # Build document
    doc = {
        "id": secrets.token_hex(16),
        "property_id": "PROP-001",
        "license_key": f"SPOTY-{secrets.token_hex(8).upper()}",
        "status": "active",
        "encrypted_data": encrypted_data,
        "signature": signature,
        "schema_version": 2,
        "updated_at": datetime.now(timezone.utc).isoformat(),
    }
    
    # Insert
    await db.licenses.insert_one(doc)
    
    print("✓ License recreated successfully for PROP-001")
    print(f"  Expiry: {lic_data['expiry_date']}")
    
    client.close()

if __name__ == "__main__":
    import asyncio
    asyncio.run(recreate_license())
