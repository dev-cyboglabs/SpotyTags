"""Auth routes."""
from __future__ import annotations

from datetime import datetime, timezone, timedelta
from fastapi import APIRouter, HTTPException, Response, Request, Depends

import auth as auth_mod
from db import get_db
from models import LoginRequest, UserCreate, utc_now, new_id

router = APIRouter(prefix="/api/auth", tags=["auth"])

MAX_FAILED_ATTEMPTS = 5
LOCKOUT_MINUTES = 15


def _identifier(request: Request, email: str) -> str:
    ip = request.client.host if request.client else "unknown"
    return f"{ip}:{email.lower()}"


async def _check_brute_force(db, identifier: str) -> None:
    rec = await db.login_attempts.find_one({"identifier": identifier})
    if not rec:
        return
    if rec.get("count", 0) >= MAX_FAILED_ATTEMPTS:
        locked_until = rec.get("locked_until")
        if locked_until:
            try:
                locked_dt = datetime.fromisoformat(locked_until)
                if datetime.now(timezone.utc) < locked_dt:
                    raise HTTPException(status_code=429, detail="Too many failed attempts. Try again in 15 minutes.")
            except (ValueError, TypeError):
                pass


async def _record_failure(db, identifier: str) -> None:
    rec = await db.login_attempts.find_one({"identifier": identifier})
    count = (rec.get("count", 0) if rec else 0) + 1
    update = {"identifier": identifier, "count": count}
    if count >= MAX_FAILED_ATTEMPTS:
        update["locked_until"] = (datetime.now(timezone.utc) + timedelta(minutes=LOCKOUT_MINUTES)).isoformat()
    await db.login_attempts.update_one({"identifier": identifier}, {"$set": update}, upsert=True)


async def _clear_failures(db, identifier: str) -> None:
    await db.login_attempts.delete_one({"identifier": identifier})


def _public_user(user: dict) -> dict:
    return {
        "id": user["id"],
        "email": user["email"],
        "name": user["name"],
        "role": user["role"],
        "property_id": user.get("property_id"),
        "active": user.get("active", True),
        "created_at": user.get("created_at"),
    }


@router.post("/login")
async def login(req: LoginRequest, request: Request, response: Response):
    db = get_db()
    email = req.email.lower()
    identifier = _identifier(request, email)
    await _check_brute_force(db, identifier)
    user = await db.users.find_one({"email": email})
    if not user:
        await _record_failure(db, identifier)
        raise HTTPException(status_code=401, detail="Invalid credentials")
    if not auth_mod.verify_password(req.password, user.get("password_hash", "")):
        await _record_failure(db, identifier)
        raise HTTPException(status_code=401, detail="Invalid credentials")
    if not user.get("active", True):
        raise HTTPException(status_code=403, detail="Account disabled")
    await _clear_failures(db, identifier)
    access = auth_mod.create_access_token(user["id"], user["email"], user["role"])
    refresh = auth_mod.create_refresh_token(user["id"])
    auth_mod.set_auth_cookies(response, access, refresh)
    return {"user": _public_user(user), "access_token": access, "token_type": "bearer"}


@router.post("/logout")
async def logout(response: Response, user: dict = Depends(auth_mod.get_current_user)):
    auth_mod.clear_auth_cookies(response)
    return {"ok": True}


@router.get("/me")
async def me(user: dict = Depends(auth_mod.get_current_user)):
    return _public_user(user)


@router.post("/refresh")
async def refresh(request: Request, response: Response):
    token = request.cookies.get("refresh_token")
    if not token:
        raise HTTPException(status_code=401, detail="No refresh token")
    try:
        payload = auth_mod.decode_token(token)
        if payload.get("type") != "refresh":
            raise HTTPException(status_code=401, detail="Invalid token type")
        db = get_db()
        user = await db.users.find_one({"id": payload["sub"]}, {"_id": 0, "password_hash": 0})
        if not user:
            raise HTTPException(status_code=401, detail="User not found")
        access = auth_mod.create_access_token(user["id"], user["email"], user["role"])
        new_refresh = auth_mod.create_refresh_token(user["id"])
        auth_mod.set_auth_cookies(response, access, new_refresh)
        return {"ok": True, "access_token": access}
    except Exception as e:
        raise HTTPException(status_code=401, detail=f"Invalid refresh token: {e}")


@router.post("/register")
async def register(req: UserCreate, response: Response, current: dict = Depends(auth_mod.require_roles("super_admin", "hotel_admin"))):
    db = get_db()
    email = req.email.lower()
    if await db.users.find_one({"email": email}):
        raise HTTPException(status_code=409, detail="Email already exists")
    user_doc = {
        "id": new_id(),
        "email": email,
        "name": req.name,
        "password_hash": auth_mod.hash_password(req.password),
        "role": req.role,
        "property_id": req.property_id or current.get("property_id"),
        "active": True,
        "created_at": utc_now().isoformat(),
    }
    await db.users.insert_one(user_doc)
    user_doc.pop("_id", None)
    return _public_user(user_doc)
