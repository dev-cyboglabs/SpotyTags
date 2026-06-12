"""AES-256-GCM encryption and HMAC-SHA256 signing for license data.

Keys are read from environment variables:
  LICENSE_ENCRYPTION_KEY  – 32-byte AES key (base64 or raw string).
  LICENSE_HMAC_KEY        – 32-byte HMAC key (base64 or raw string).

If either variable is absent the system derives a deterministic key from
JWT_SECRET so the app always boots; set explicit env vars for production.
"""
from __future__ import annotations

import base64
import hashlib
import hmac as _hmac
import json
import os
import secrets

from cryptography.hazmat.primitives.ciphers.aead import AESGCM


# ─── Key helpers ─────────────────────────────────────────────────────────────

def _to_32_bytes(raw: str | bytes) -> bytes:
    if isinstance(raw, str):
        try:
            b = base64.b64decode(raw + "==")  # tolerate missing padding
        except Exception:
            b = raw.encode()
    else:
        b = raw
    if len(b) == 32:
        return b
    return hashlib.sha256(b).digest()


def get_enc_key() -> bytes:
    """Return the 32-byte AES-256 encryption key."""
    raw = os.environ.get("LICENSE_ENCRYPTION_KEY")
    if raw:
        return _to_32_bytes(raw)
    # Deterministic fallback derived from JWT_SECRET — not ideal for prod,
    # but prevents crashes when the env var is not yet configured.
    jwt = os.environ.get("JWT_SECRET", "spotytags-default-secret")
    return hashlib.sha256(f"{jwt}:license_enc_v2".encode()).digest()


def get_hmac_key() -> bytes:
    """Return the 32-byte HMAC key."""
    raw = os.environ.get("LICENSE_HMAC_KEY")
    if raw:
        return _to_32_bytes(raw)
    jwt = os.environ.get("JWT_SECRET", "spotytags-default-secret")
    return hashlib.sha256(f"{jwt}:license_hmac_v2".encode()).digest()


# ─── AES-256-GCM ─────────────────────────────────────────────────────────────

def aes_encrypt(payload: dict, key: bytes) -> str:
    """Encrypt *payload* with AES-256-GCM.

    Returns base64(12-byte nonce ‖ GCM-ciphertext+tag).
    The 16-byte GCM auth tag is appended by the library automatically.
    """
    nonce = secrets.token_bytes(12)
    plaintext = json.dumps(payload, sort_keys=True, default=str).encode()
    ciphertext = AESGCM(key).encrypt(nonce, plaintext, None)
    return base64.b64encode(nonce + ciphertext).decode()


def aes_decrypt(token: str, key: bytes) -> dict:
    """Decrypt the output of *aes_encrypt*.

    Raises ValueError on bad key, tampered ciphertext, or invalid JSON.
    """
    try:
        raw = base64.b64decode(token)
        nonce, ct = raw[:12], raw[12:]
        plaintext = AESGCM(key).decrypt(nonce, ct, None)
        return json.loads(plaintext)
    except Exception as exc:
        raise ValueError(f"License decryption failed: {exc}") from exc


# ─── HMAC-SHA256 ─────────────────────────────────────────────────────────────

def make_signature(property_id: str, encrypted_data: str, key: bytes) -> str:
    """Return HMAC-SHA256 hex digest binding *property_id* to *encrypted_data*."""
    msg = f"{property_id}:{encrypted_data}".encode()
    return _hmac.new(key, msg, hashlib.sha256).hexdigest()


def verify_signature(
    property_id: str,
    encrypted_data: str,
    sig: str,
    key: bytes,
) -> bool:
    """Constant-time HMAC comparison. Returns False on any mismatch."""
    try:
        expected = make_signature(property_id, encrypted_data, key)
        return _hmac.compare_digest(expected, sig)
    except Exception:
        return False
