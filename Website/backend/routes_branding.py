"""Branding & local-deploy admin routes.

Every hotel running its own copy of SpotyTags can customise:
  • Hotel name, tagline, contact info
  • Logo, favicon (uploaded as image files)
  • Brand colours (primary + accent)
  • Currency / locale / timezone

Files are stored on the local filesystem under `/app/backend/uploads/`
and served back via `/api/branding/files/{filename}` — no cloud
dependency, no CDN.
"""
from __future__ import annotations

import os
import shutil
import time
from pathlib import Path
from typing import Optional

from fastapi import APIRouter, Depends, File, HTTPException, UploadFile
from fastapi.responses import FileResponse, JSONResponse

import auth as auth_mod
from db import get_db
from models import utc_now
from realtime import manager, write_audit

router = APIRouter(prefix="/api/branding", tags=["branding"])

UPLOADS_DIR = Path(os.environ.get("UPLOADS_DIR", "./uploads"))
UPLOADS_DIR.mkdir(parents=True, exist_ok=True)
MAX_UPLOAD_BYTES = 5 * 1024 * 1024  # 5 MB
ALLOWED_EXTENSIONS = {".png", ".jpg", ".jpeg", ".webp", ".svg", ".ico", ".gif"}

# Default brand applied to a fresh deployment
DEFAULT_BRAND = {
    "hotel_name": "SpotyTags",
    "tagline": "Smart hotel minibar",
    "primary_color": "#1A1A1A",
    "accent_color": "#FF7E6B",
    "logo_url": None,
    "favicon_url": None,
    "contact_email": "",
    "contact_phone": "",
    "address": "",
    "gst_number": "",
    "registration_number": "",
    "website": "",
    "footer_text": "Crafted for hospitality",
}


def _public_url(filename: Optional[str]) -> Optional[str]:
    if not filename:
        return None
    if filename.startswith("http"):
        return filename
    return f"/api/branding/files/{filename}"


async def _get_brand_doc(db, property_id: str) -> dict:
    prop = await db.properties.find_one({"id": property_id}, {"_id": 0}) or {}
    brand = {**DEFAULT_BRAND}
    # Overlay any stored brand fields
    for k in DEFAULT_BRAND.keys():
        if k in prop and prop[k] is not None:
            brand[k] = prop[k]
    # Convert stored filenames to served URLs
    brand["logo_url"] = _public_url(prop.get("logo_filename") or prop.get("logo_url"))
    brand["favicon_url"] = _public_url(prop.get("favicon_filename") or prop.get("favicon_url"))
    # Currency block (already on property)
    brand["currency"] = {
        "code": prop.get("currency_code", "INR"),
        "symbol": prop.get("currency_symbol", "₹"),
        "locale": prop.get("currency_locale", "en-IN"),
        "decimals": prop.get("currency_decimals", 2),
    }
    brand["timezone"] = prop.get("timezone", "Asia/Kolkata")
    brand["country"] = prop.get("country", "")
    brand["property_id"] = property_id
    return brand


def _property_id_for_request(user_or_none: Optional[dict]) -> str:
    if user_or_none and user_or_none.get("property_id"):
        return user_or_none["property_id"]
    return "PROP-001"


# ============ Public (no auth) — used by Login page ============
@router.get("/public")
async def get_public_brand():
    """Return non-sensitive brand info — name, tagline, logo, colours.
    Login page hits this before the user is authenticated."""
    db = get_db()
    brand = await _get_brand_doc(db, "PROP-001")
    return {
        "hotel_name": brand["hotel_name"],
        "tagline": brand["tagline"],
        "primary_color": brand["primary_color"],
        "accent_color": brand["accent_color"],
        "logo_url": brand["logo_url"],
        "favicon_url": brand["favicon_url"],
        "footer_text": brand["footer_text"],
        "website": brand.get("website", ""),
    }


# ============ Authenticated read ============
@router.get("")
async def get_brand(user: dict = Depends(auth_mod.get_current_user)):
    db = get_db()
    return await _get_brand_doc(db, user["property_id"])


# ============ Super Admin only writes ============
@router.put("")
async def update_brand(payload: dict,
                       current: dict = Depends(auth_mod.require_roles("super_admin"))):
    """Merge brand fields onto the property doc. Fields not provided are kept."""
    db = get_db()
    allowed = set(DEFAULT_BRAND.keys()) | {"timezone", "country"}
    updates = {k: v for k, v in payload.items() if k in allowed and v is not None}
    if not updates:
        raise HTTPException(status_code=400, detail="No valid fields to update")
    await db.properties.update_one(
        {"id": current["property_id"]},
        {"$set": {**updates, "updated_at": utc_now().isoformat()}},
        upsert=True,
    )
    await write_audit(db, actor=current, action="update_brand", entity_type="brand",
                       description=f"Updated brand fields: {', '.join(updates.keys())}")
    await manager.broadcast("branding_updated", {})
    return await _get_brand_doc(db, current["property_id"])


@router.post("/upload")
async def upload_brand_image(
    kind: str,
    file: UploadFile = File(...),
    current: dict = Depends(auth_mod.require_roles("super_admin")),
):
    """Upload logo / favicon. `kind` ∈ {logo, favicon}."""
    if kind not in {"logo", "favicon"}:
        raise HTTPException(status_code=400, detail="`kind` must be logo or favicon")
    ext = Path(file.filename or "").suffix.lower()
    if ext not in ALLOWED_EXTENSIONS:
        raise HTTPException(status_code=400, detail=f"Unsupported file type: {ext}")

    # Read + size-check
    contents = await file.read()
    if len(contents) > MAX_UPLOAD_BYTES:
        raise HTTPException(status_code=413, detail="File too large (max 5MB)")

    # Persist with timestamped filename to bust caches
    safe_name = f"{current['property_id']}-{kind}-{int(time.time())}{ext}"
    dest = UPLOADS_DIR / safe_name
    dest.write_bytes(contents)

    # Save reference on the property doc
    db = get_db()
    await db.properties.update_one(
        {"id": current["property_id"]},
        {"$set": {f"{kind}_filename": safe_name, "updated_at": utc_now().isoformat()}},
        upsert=True,
    )
    await write_audit(db, actor=current, action="upload_brand_image", entity_type="brand",
                       description=f"Uploaded {kind} ({len(contents)/1024:.1f} KB)")
    await manager.broadcast("branding_updated", {})

    return {"ok": True, "kind": kind, "filename": safe_name, "url": _public_url(safe_name),
            "size_bytes": len(contents)}


@router.delete("/{kind}")
async def remove_brand_image(kind: str,
                             current: dict = Depends(auth_mod.require_roles("super_admin"))):
    if kind not in {"logo", "favicon"}:
        raise HTTPException(status_code=400, detail="`kind` must be logo or favicon")
    db = get_db()
    prop = await db.properties.find_one({"id": current["property_id"]}, {"_id": 0}) or {}
    filename = prop.get(f"{kind}_filename")
    if filename:
        try:
            (UPLOADS_DIR / filename).unlink(missing_ok=True)
        except Exception:
            pass
    await db.properties.update_one(
        {"id": current["property_id"]},
        {"$unset": {f"{kind}_filename": ""}, "$set": {"updated_at": utc_now().isoformat()}},
    )
    await write_audit(db, actor=current, action="remove_brand_image", entity_type="brand",
                       description=f"Removed {kind}")
    await manager.broadcast("branding_updated", {})
    return {"ok": True, "removed": kind}


# ============ Reset to defaults ============
@router.post("/reset")
async def reset_brand(current: dict = Depends(auth_mod.require_roles("super_admin"))):
    db = get_db()
    # Remove any uploaded image files
    prop = await db.properties.find_one({"id": current["property_id"]}, {"_id": 0}) or {}
    for kind in ("logo", "favicon"):
        fn = prop.get(f"{kind}_filename")
        if fn:
            try:
                (UPLOADS_DIR / fn).unlink(missing_ok=True)
            except Exception:
                pass
    unset = {f"{k}_filename": "" for k in ("logo", "favicon")}
    await db.properties.update_one(
        {"id": current["property_id"]},
        {"$set": {**DEFAULT_BRAND, "updated_at": utc_now().isoformat()},
         "$unset": unset},
    )
    await write_audit(db, actor=current, action="reset_brand", entity_type="brand",
                       description="Reset branding to defaults")
    await manager.broadcast("branding_updated", {})
    return await _get_brand_doc(db, current["property_id"])


# ============ Serve uploaded files (public — image URLs travel everywhere) ============
@router.get("/files/{filename}")
async def serve_brand_file(filename: str):
    # Path traversal guard
    safe = Path(filename).name
    fp = UPLOADS_DIR / safe
    if not fp.exists() or not fp.is_file():
        raise HTTPException(status_code=404, detail="Not found")
    # Long max-age but include filename hash for cache busting
    return FileResponse(
        str(fp),
        headers={"Cache-Control": "public, max-age=86400"},
    )


# ============ Local deployment info ============
@router.get("/deployment-info")
async def deployment_info(user: dict = Depends(auth_mod.require_roles("super_admin"))):
    """Surface the info a local-deploy admin needs at a glance:
    server URL, MongoDB target, cloud-sync state, upload dir size, etc.
    """
    db = get_db()
    # Compute uploads dir size
    total_bytes = 0
    file_count = 0
    if UPLOADS_DIR.exists():
        for f in UPLOADS_DIR.iterdir():
            if f.is_file():
                total_bytes += f.stat().st_size
                file_count += 1
    cloud_url = os.environ.get("CLOUD_INGEST_URL", "")
    return {
        "property_id": user["property_id"],
        "server_time": utc_now().isoformat(),
        "deployment_mode": "local",
        "mongo_db": os.environ.get("DB_NAME", "unknown"),
        "uploads": {
            "dir": str(UPLOADS_DIR),
            "files": file_count,
            "total_bytes": total_bytes,
            "max_file_bytes": MAX_UPLOAD_BYTES,
        },
        "cloud_sync": {
            "configured_url": cloud_url or None,
            "default_uses_localhost_mock": cloud_url == "" or "127.0.0.1" in cloud_url or "localhost" in cloud_url,
        },
        "users_count": await db.users.count_documents({}),
        "rooms_count": await db.rooms.count_documents({}),
        "tags_count": await db.tags.count_documents({}),
        "gateways_count": await db.gateways.count_documents({}),
    }
