"""License enforcement helpers.

Centralises plan-limit + expiry checks used across create/update endpoints.

Every MongoDB read is passed through *decrypt_license_doc* so all callers
receive a plain dict with the full set of fields regardless of schema version.
If HMAC verification fails the license is treated as tampered → blocked.
"""
from __future__ import annotations

import logging
from datetime import datetime, timezone

from fastapi import HTTPException

logger = logging.getLogger("spotytags.license")


async def _get_license(db, property_id: str) -> dict | None:
    """Fetch and decrypt the license for *property_id*. Returns None if absent."""
    from license_verifier import decrypt_license_doc
    raw = await db.licenses.find_one({"property_id": property_id}, {"_id": 0})
    if not raw:
        return None
    try:
        return decrypt_license_doc(raw)
    except ValueError as exc:
        # HMAC mismatch or decryption failure → treat as blocked
        logger.critical("License tamper detected for property '%s': %s", property_id, exc)
        raise HTTPException(
            status_code=403,
            detail={
                "code": "license_tampered",
                "message": "License integrity check failed. Contact support.",
                "license_status": "tampered",
            },
        )


def _is_license_blocked(lic: dict) -> tuple[bool, str | None]:
    """Return (blocked, reason). Blocks on expired/suspended/cancelled/tampered."""
    status = lic.get("status", "active")
    if status in ("expired", "suspended", "cancelled", "tampered"):
        return True, status
    # Recompute from expiry_date in case the background job hasn't run yet.
    try:
        exp_raw = lic.get("expiry_date", "")
        if isinstance(exp_raw, datetime):
            exp = exp_raw if exp_raw.tzinfo else exp_raw.replace(tzinfo=timezone.utc)
        else:
            exp = datetime.fromisoformat(str(exp_raw).replace("Z", "+00:00"))
        if exp < datetime.now(timezone.utc):
            return True, "expired"
    except Exception:
        pass
    return False, None


async def ensure_license_active(db, property_id: str) -> dict:
    """Raise 403 if the licence is expired/suspended/tampered. Returns the licence."""
    lic = await _get_license(db, property_id)
    if not lic:
        return {}
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
    return lic


async def license_validation_snapshot(db, property_id: str) -> dict:
    """Return a validation snapshot used by /license/validate."""
    lic = await _get_license(db, property_id)
    if not lic:
        return {
            "status": "no_license",
            "blocked": False,
            "quotas": {},
            "warnings": [],
        }
    blocked, block_reason = _is_license_blocked(lic)
    warnings = []
    if block_reason:
        warnings.append({
            "severity": "danger",
            "code": f"license_{block_reason}",
            "message": f"License is {block_reason}. Critical actions are blocked.",
        })
    try:
        exp_raw = lic.get("expiry_date", "")
        if isinstance(exp_raw, datetime):
            exp = exp_raw if exp_raw.tzinfo else exp_raw.replace(tzinfo=timezone.utc)
        else:
            exp = datetime.fromisoformat(str(exp_raw).replace("Z", "+00:00"))
        days = (exp - datetime.now(timezone.utc)).days
        if 0 <= days <= 7:
            warnings.append({
                "severity": "warning",
                "code": "license_expiring",
                "message": f"License expires in {days} day{'s' if days != 1 else ''}.",
            })
    except Exception:
        pass

    return {
        "status": lic.get("status", "active"),
        "plan": lic.get("plan"),
        "blocked": blocked,
        "block_reason": block_reason,
        "expiry_date": lic.get("expiry_date"),
        "quotas": {},
        "warnings": warnings,
    }
