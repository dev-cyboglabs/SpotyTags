#!/usr/bin/env python3
"""
Admin script to extend SpotyTags licenses.

This script directly manipulates MongoDB to extend license expiry dates.
It requires the ADMIN_API_KEY environment variable for security.

Usage:
    python admin_extend_license.py --property-id <property_id> --days <days>
    python admin_extend_license.py --property-id <property_id> --years <years>

Examples:
    python admin_extend_license.py --property-id prop_123 --days 30
    python admin_extend_license.py --property-id prop_123 --years 1
"""
import os
import sys
import argparse
import getpass
from datetime import datetime, timezone, timedelta
from motor.motor_asyncio import AsyncIOMotorClient
from dotenv import load_dotenv

# Load environment variables
load_dotenv()

# Required environment variables
MONGO_URL = os.environ.get("MONGO_URL", "mongodb://localhost:27017")
DB_NAME = os.environ.get("DB_NAME", "spotytags")
ADMIN_API_KEY = os.environ.get("ADMIN_API_KEY")

# License encryption keys
LICENSE_ENCRYPTION_KEY = os.environ.get("LICENSE_ENCRYPTION_KEY")
LICENSE_HMAC_KEY = os.environ.get("LICENSE_HMAC_KEY")


def verify_admin_key():
    """Verify ADMIN_API_KEY is set and matches expected format."""
    if not ADMIN_API_KEY:
        print("ERROR: ADMIN_API_KEY environment variable not set.")
        print("Please set it in your .env file or environment.")
        sys.exit(1)
    if ADMIN_API_KEY == "your-admin-api-key-here":
        print("ERROR: ADMIN_API_KEY is set to the default placeholder value.")
        print("Please generate a secure key using: python -c \"import secrets; print(secrets.token_urlsafe(32))\"")
        sys.exit(1)


def verify_admin_password():
    """Prompt for and verify admin password (second factor)."""
    # Check if password is set in .env (for dev convenience)
    env_password = os.environ.get("ADMIN_SCRIPT_PASSWORD")
    
    if env_password:
        if env_password == "your-admin-script-password-here":
            print("ERROR: ADMIN_SCRIPT_PASSWORD is set to the default placeholder value.")
            print("Please generate a secure password using: python -c \"import secrets; print(secrets.token_urlsafe(16))\"")
            sys.exit(1)
        # In dev mode, use the env password without prompting
        return
    
    # In production, prompt for password
    print("Admin password required for license extension.")
    password = getpass.getpass("Enter admin password: ")
    
    if not password:
        print("ERROR: Password cannot be empty.")
        sys.exit(1)
    
    # For production, you would verify this against a stored hash
    # For now, we'll use a simple check - in production, store a hash in .env
    # and compare against that
    stored_hash = os.environ.get("ADMIN_PASSWORD_HASH")
    if stored_hash:
        import hashlib
        password_hash = hashlib.sha256(password.encode()).hexdigest()
        if password_hash != stored_hash:
            print("ERROR: Invalid admin password.")
            sys.exit(1)
    else:
        # If no hash is set, warn the user
        print("WARNING: ADMIN_PASSWORD_HASH not set in .env.")
        print("For production security, set a hashed password.")
        print("Generate hash using: python -c \"import hashlib; print(hashlib.sha256(b'your_password').hexdigest())\"")
        print("Continuing without password verification (NOT SECURE for production).")


def verify_encryption_keys():
    """Verify license encryption keys are set."""
    if not LICENSE_ENCRYPTION_KEY or not LICENSE_HMAC_KEY:
        print("ERROR: License encryption keys not set.")
        print("Please set LICENSE_ENCRYPTION_KEY and LICENSE_HMAC_KEY in your .env file.")
        sys.exit(1)
    if LICENSE_ENCRYPTION_KEY == "your-32-byte-encryption-key-here":
        print("ERROR: LICENSE_ENCRYPTION_KEY is set to the default placeholder value.")
        print("Please generate a secure key using: python -c \"import secrets; print(secrets.token_hex(32))\"")
        sys.exit(1)


def decrypt_license_doc(raw_doc: dict) -> dict:
    """Decrypt and verify license document."""
    from crypto_utils import aes_decrypt, verify_signature, get_enc_key, get_hmac_key
    
    if "encrypted_data" not in raw_doc or "signature" not in raw_doc:
        # Schema v1 (plaintext) - return as-is
        return raw_doc
    
    encrypted_data = raw_doc["encrypted_data"]
    signature = raw_doc["signature"]
    property_id = raw_doc.get("property_id", "")
    
    enc_key = get_enc_key()
    hmac_key = get_hmac_key()
    
    # Verify HMAC signature
    if not verify_signature(property_id, encrypted_data, signature, hmac_key):
        raise ValueError("HMAC verification failed - license may be tampered")
    
    # Decrypt data
    decrypted = aes_decrypt(encrypted_data, enc_key)
    
    # Merge plaintext fields with decrypted fields (schema v2)
    result = {
        "id": raw_doc.get("id"),
        "property_id": property_id,
        "status": raw_doc.get("status", "active"),
        "license_key": raw_doc.get("license_key"),
        **decrypted,
    }
    return result


def encrypt_license_doc(plain_doc: dict) -> dict:
    """Encrypt license document with HMAC signature."""
    from crypto_utils import aes_encrypt, make_signature, get_enc_key, get_hmac_key
    import json
    
    enc_key = get_enc_key()
    hmac_key = get_hmac_key()
    
    # Fields to encrypt
    sensitive_fields = {
        "plan": plain_doc.get("plan"),
        "expiry_date": plain_doc.get("expiry_date"),
        "tag_limit": plain_doc.get("tag_limit"),
        "gateway_limit": plain_doc.get("gateway_limit"),
        "user_limit": plain_doc.get("user_limit"),
        "room_limit": plain_doc.get("room_limit"),
        "status": plain_doc.get("status"),
    }
    
    # Encrypt sensitive data
    encrypted_data = aes_encrypt(sensitive_fields, enc_key)
    property_id = plain_doc.get("property_id", "")
    signature = make_signature(property_id, encrypted_data, hmac_key)
    
    # Build encrypted document (schema v2)
    return {
        "property_id": plain_doc.get("property_id"),
        "license_key": plain_doc.get("license_key"),
        "status": plain_doc.get("status"),
        "encrypted_data": encrypted_data,
        "signature": signature,
        "schema_version": 2,
        "updated_at": datetime.now(timezone.utc).isoformat(),
    }


async def extend_license(property_id: str, days: int = None, years: int = None):
    """Extend license for a property."""
    verify_admin_key()
    verify_admin_password()
    verify_encryption_keys()
    
    # Calculate extension
    if years:
        extension_days = years * 365
    elif days:
        extension_days = days
    else:
        print("ERROR: Must specify either --days or --years")
        sys.exit(1)
    
    print(f"Connecting to MongoDB at {MONGO_URL}...")
    client = AsyncIOMotorClient(MONGO_URL)
    db = client[DB_NAME]
    
    print(f"Fetching license for property: {property_id}")
    raw_lic = await db.licenses.find_one({"property_id": property_id}, {"_id": 0})
    
    if not raw_lic:
        print(f"ERROR: License not found for property_id: {property_id}")
        sys.exit(1)
    
    print("Decrypting license...")
    try:
        lic = decrypt_license_doc(raw_lic)
    except ValueError as e:
        print(f"ERROR: Failed to decrypt license: {e}")
        print("The license may be tampered or encryption keys are incorrect.")
        sys.exit(1)
    
    # Calculate new expiry
    try:
        cur_exp = datetime.fromisoformat(str(lic.get("expiry_date", "")).replace("Z", "+00:00"))
    except Exception:
        cur_exp = datetime.now(timezone.utc)
    
    new_exp = max(cur_exp, datetime.now(timezone.utc)) + timedelta(days=extension_days)
    
    print(f"Current expiry: {cur_exp.isoformat()}")
    print(f"New expiry: {new_exp.isoformat()}")
    print(f"Extension: {extension_days} days")
    
    # Update license
    lic["expiry_date"] = new_exp.isoformat()
    lic["status"] = "active"
    lic["updated_at"] = datetime.now(timezone.utc).isoformat()
    
    print("Encrypting license...")
    encrypted_lic = encrypt_license_doc(lic)
    
    print("Updating MongoDB...")
    await db.licenses.replace_one(
        {"property_id": property_id},
        encrypted_lic
    )
    
    print("✓ License extended successfully!")
    print(f"  Property ID: {property_id}")
    print(f"  New expiry: {new_exp.isoformat()}")
    
    client.close()


def main():
    parser = argparse.ArgumentParser(description="Extend SpotyTags license")
    parser.add_argument("--property-id", required=True, help="Property ID to extend license for")
    parser.add_argument("--days", type=int, help="Number of days to extend")
    parser.add_argument("--years", type=int, help="Number of years to extend")
    
    args = parser.parse_args()
    
    if not args.days and not args.years:
        print("ERROR: Must specify either --days or --years")
        sys.exit(1)
    
    import asyncio
    asyncio.run(extend_license(args.property_id, args.days, args.years))


if __name__ == "__main__":
    main()
