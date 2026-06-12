"""License document encryption/decryption, clock-rollback detection, and global
system-integrity state.

Encryption schema (v2)
───────────────────────
MongoDB stores only four plaintext fields so indexes still work:
  id, property_id, status, license_key, schema_version

All remaining fields (plan, expiry_date, *_limit, *_enabled, …) are packed
into a JSON blob, AES-256-GCM encrypted, and stored as *encrypted_data*.
An HMAC-SHA256 signature over "{property_id}:{encrypted_data}" detects any
out-of-band edits to the ciphertext.

Clock-rollback protection
──────────────────────────
On every successful startup the current UTC timestamp is AES-encrypted and
written to .last_run.  On the next startup the stored time is compared with
the system clock; if the clock appears to have moved backwards (beyond a small
tolerance) or is significantly behind NTP, the system is marked blocked and
every API request returns 403.
"""
from __future__ import annotations

import logging
import os
from datetime import datetime, timezone, timedelta
from pathlib import Path

from crypto_utils import (
    aes_decrypt,
    aes_encrypt,
    get_enc_key,
    get_hmac_key,
    make_signature,
    verify_signature,
)

logger = logging.getLogger("spotytags.license")

# Path where the encrypted last-run timestamp lives.
_LAST_RUN_PATH = Path(
    os.environ.get("LAST_RUN_DIR", str(Path(__file__).parent))
) / ".last_run"

SCHEMA_V2 = 2
CLOCK_TOLERANCE = timedelta(seconds=60)   # allow 60 s of normal drift

# Fields stored in plaintext so MongoDB queries / indexes work.
_PLAIN_FIELDS = {"id", "property_id", "status", "license_key", "schema_version"}

# ─── Global integrity state ───────────────────────────────────────────────────
# Set once during startup; read by the middleware on every request.
_system_ok: bool = True
_system_error: str | None = None


def get_system_state() -> tuple[bool, str | None]:
    return _system_ok, _system_error


def set_system_state(ok: bool, error: str | None = None) -> None:
    global _system_ok, _system_error
    _system_ok = ok
    _system_error = error


# ─── Document encryption / decryption ────────────────────────────────────────

def encrypt_license_doc(doc: dict) -> dict:
    """Encrypt the sensitive fields of a license dict and add an HMAC signature.

    Returns a new dict safe to insert/replace in MongoDB.
    """
    enc_key = get_enc_key()
    hmac_key = get_hmac_key()
    property_id = doc["property_id"]

    sensitive = {k: v for k, v in doc.items() if k not in _PLAIN_FIELDS}
    encrypted_data = aes_encrypt(sensitive, enc_key)
    sig = make_signature(property_id, encrypted_data, hmac_key)

    return {
        "id": doc.get("id"),
        "property_id": property_id,
        "status": doc.get("status", "active"),
        "license_key": doc.get("license_key"),
        "encrypted_data": encrypted_data,
        "signature": sig,
        "schema_version": SCHEMA_V2,
    }


def decrypt_license_doc(doc: dict) -> dict:
    """Decrypt and verify a MongoDB license document.

    Returns a merged dict with all fields restored (safe to pass to
    *_is_license_blocked* and friends).

    Raises:
        ValueError – HMAC mismatch (tamper) or AES decryption failure.

    If the document is schema v1 (plaintext), it is returned as-is with a
    warning.  Run migrate_licenses.py to upgrade.
    """
    if not doc:
        return doc

    if doc.get("schema_version", 1) < SCHEMA_V2:
        logger.warning(
            "License for property '%s' is stored as plaintext (schema v1). "
            "Run migrate_licenses.py to encrypt it.",
            doc.get("property_id"),
        )
        return doc

    hmac_key = get_hmac_key()
    enc_key = get_enc_key()
    pid = doc["property_id"]
    enc_data = doc.get("encrypted_data", "")
    sig = doc.get("signature", "")

    if not verify_signature(pid, enc_data, sig, hmac_key):
        msg = (
            f"License HMAC verification FAILED for property '{pid}'. "
            "The document may have been tampered with."
        )
        logger.critical(msg)
        raise ValueError(msg)

    sensitive = aes_decrypt(enc_data, enc_key)
    return {**doc, **sensitive}


# ─── License update helper ────────────────────────────────────────────────────

async def update_encrypted_license(db, property_id: str, updates: dict) -> dict:
    """Read → decrypt → apply updates → re-encrypt → replace in MongoDB.

    Returns the *decrypted* updated license dict.
    Raises ValueError if the existing doc fails HMAC verification.
    Raises LookupError if no license exists for *property_id*.
    """
    raw = await db.licenses.find_one({"property_id": property_id}, {"_id": 0})
    if not raw:
        raise LookupError(f"No license found for property '{property_id}'")
    decrypted = decrypt_license_doc(raw)
    decrypted.update(updates)
    new_doc = encrypt_license_doc(decrypted)
    await db.licenses.replace_one({"property_id": property_id}, new_doc)
    return decrypted


# ─── Clock-rollback detection ─────────────────────────────────────────────────

def _load_last_run() -> datetime | None:
    if not _LAST_RUN_PATH.exists():
        return None
    try:
        enc_key = get_enc_key()
        data = aes_decrypt(_LAST_RUN_PATH.read_text().strip(), enc_key)
        ts = data.get("ts")
        return datetime.fromisoformat(ts) if ts else None
    except Exception as exc:
        logger.warning("Could not read .last_run (%s) — skipping rollback check.", exc)
        return None


def _save_last_run(now: datetime) -> None:
    try:
        enc_key = get_enc_key()
        _LAST_RUN_PATH.write_text(aes_encrypt({"ts": now.isoformat()}, enc_key))
    except Exception as exc:
        logger.warning("Could not write .last_run (%s) — clock-rollback protection degraded.", exc)


def _get_ntp_time() -> datetime | None:
    """Try pool.ntp.org; return None if offline or ntplib not installed."""
    try:
        import ntplib  # optional dependency
        resp = ntplib.NTPClient().request("pool.ntp.org", version=3, timeout=3)
        return datetime.fromtimestamp(resp.tx_time, tz=timezone.utc)
    except Exception:
        return None


def run_startup_checks() -> tuple[bool, str]:
    """Perform all startup integrity checks.

    1. Verify encryption keys are accessible.
    2. Compare current clock with last-run timestamp (rollback detection).
    3. Optionally cross-check with NTP (requires network; skipped if offline).

    Returns (ok, message).  Updates .last_run on success.
    Sets global system state so the middleware can block requests when needed.
    """
    now = datetime.now(timezone.utc)

    # 1 — key availability
    try:
        get_enc_key()
        get_hmac_key()
    except RuntimeError as exc:
        msg = f"License key configuration error: {exc}"
        logger.critical(msg)
        set_system_state(False, msg)
        return False, msg

    # 2 — local clock-rollback check
    last = _load_last_run()
    if last is not None:
        if now < (last - CLOCK_TOLERANCE):
            msg = (
                f"Clock rollback detected — last run {last.isoformat()}, "
                f"current {now.isoformat()}. "
                "System is blocked. Restore the correct system time to continue."
            )
            logger.critical(msg)
            _log_security_violation("clock_rollback", msg)
            set_system_state(False, msg)
            return False, msg

    # 3 — NTP cross-check (best-effort; skipped when offline)
    ntp_now = _get_ntp_time()
    if ntp_now is not None:
        drift = (ntp_now - now).total_seconds()
        if drift > 300:
            msg = (
                f"System clock is {drift:.0f}s behind NTP — possible rollback. "
                f"System: {now.isoformat()}, NTP: {ntp_now.isoformat()}. "
                "System is blocked."
            )
            logger.critical(msg)
            _log_security_violation("ntp_drift", msg)
            set_system_state(False, msg)
            return False, msg
        logger.info("NTP verified — clock drift %.1f s", drift)
    else:
        logger.info("NTP unavailable — offline mode, network time check skipped.")

    _save_last_run(now)
    set_system_state(True)
    logger.info("License integrity startup checks passed ✓")
    return True, "ok"


def _log_security_violation(event_type: str, detail: str) -> None:
    """Write a structured line to the security log for audit purposes."""
    logger.critical(
        "[SECURITY] event=%s ts=%s detail=%s",
        event_type,
        datetime.now(timezone.utc).isoformat(),
        detail,
    )


def check_clock_rollback() -> tuple[bool, str | None]:
    """Runtime clock rollback check - call this periodically to detect time changes.
    
    Returns (ok, error) where ok=True if clock is valid, False if rollback detected.
    """
    from crypto_utils import aes_decrypt, aes_encrypt, get_enc_key
    
    now = datetime.now(timezone.utc)
    
    # Load last run timestamp
    try:
        with open(_LAST_RUN_PATH, "rb") as f:
            encrypted = f.read()
        decrypted = aes_decrypt(encrypted, get_enc_key())
        # _save_last_run stores a dict: {"ts": "iso_timestamp"}
        if isinstance(decrypted, dict):
            last = datetime.fromisoformat(decrypted["ts"])
        else:
            # Fallback for string format
            last = datetime.fromisoformat(decrypted.decode())
        logger.info(f"Clock check: last={last.isoformat()}, now={now.isoformat()}")
    except Exception as e:
        # If file doesn't exist or can't be read, save current time and allow
        logger.warning(f"Cannot read .last_run: {e}, creating new one")
        _save_last_run(now)
        return True, None
    
    # Check for rollback
    if now < (last - CLOCK_TOLERANCE):
        msg = (
            f"Runtime clock rollback detected — last run {last.isoformat()}, "
            f"current {now.isoformat()}. "
            "System is blocked. Restore the correct system time to continue."
        )
        logger.critical(msg)
        _log_security_violation("runtime_clock_rollback", msg)
        set_system_state(False, msg)
        return False, msg
    
    # Update last run timestamp periodically (every request is fine, it's fast)
    _save_last_run(now)
    return True, None
