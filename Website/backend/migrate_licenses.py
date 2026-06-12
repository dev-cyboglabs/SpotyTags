"""One-time migration: encrypt existing plaintext (schema v1) license documents.

Usage
─────
    cd SpotyTags/backend
    python migrate_licenses.py

The script connects to MongoDB using the same env vars as the server
(MONGO_URL, DB_NAME).  It is safe to run multiple times — encrypted docs
(schema_version == 2) are skipped.

What it does
────────────
1. Finds all license documents where schema_version != 2.
2. Decrypts each (no-op for plaintext docs).
3. Re-encrypts with the current keys.
4. Replaces the document in MongoDB.
5. Prints a summary.
"""
from __future__ import annotations

import asyncio
import os
import sys
from pathlib import Path

# Load .env so MONGO_URL / DB_NAME / LICENSE_* keys are available
from dotenv import load_dotenv
load_dotenv(Path(__file__).parent / ".env")

import motor.motor_asyncio as motor

from license_verifier import decrypt_license_doc, encrypt_license_doc, SCHEMA_V2


async def migrate() -> None:
    mongo_url = os.environ.get("MONGO_URL", "mongodb://localhost:27017")
    db_name = os.environ.get("DB_NAME", "spotytags")

    client = motor.AsyncIOMotorClient(mongo_url)
    db = client[db_name]

    total = await db.licenses.count_documents({})
    already_encrypted = await db.licenses.count_documents({"schema_version": SCHEMA_V2})
    to_migrate = total - already_encrypted

    print(f"Licenses in DB     : {total}")
    print(f"Already encrypted  : {already_encrypted}")
    print(f"Need migration     : {to_migrate}")

    if to_migrate == 0:
        print("Nothing to do.")
        client.close()
        return

    cursor = db.licenses.find({"schema_version": {"$ne": SCHEMA_V2}}, {"_id": 0})
    migrated = 0
    failed = 0

    async for raw in cursor:
        pid = raw.get("property_id", "<unknown>")
        try:
            # decrypt_license_doc is a no-op (with warning) for schema v1 docs
            plain = decrypt_license_doc(raw)
            encrypted = encrypt_license_doc(plain)
            await db.licenses.replace_one({"property_id": pid}, encrypted)
            print(f"  ✓ Migrated  property_id={pid}")
            migrated += 1
        except Exception as exc:
            print(f"  ✗ FAILED    property_id={pid}  error={exc}", file=sys.stderr)
            failed += 1

    print(f"\nDone — migrated {migrated}, failed {failed}.")
    client.close()


if __name__ == "__main__":
    asyncio.run(migrate())
