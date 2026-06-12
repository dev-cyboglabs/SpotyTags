"""JWT + RBAC auth helpers for SpotyTags."""
from __future__ import annotations

import os
from datetime import datetime, timezone, timedelta
from typing import Optional

import jwt
from fastapi import HTTPException, Request, Depends

from security import hash_password, verify_password  # re-exported for callers
from db import get_db

JWT_ALGORITHM = "HS256"
ACCESS_TTL_MIN = 60 * 12  # 12 hours - convenient for staff shifts
REFRESH_TTL_DAYS = 30


def get_jwt_secret() -> str:
    return os.environ["JWT_SECRET"]


def create_access_token(user_id: str, email: str, role: str) -> str:
    payload = {
        "sub": user_id,
        "email": email,
        "role": role,
        "exp": datetime.now(timezone.utc) + timedelta(minutes=ACCESS_TTL_MIN),
        "type": "access",
    }
    return jwt.encode(payload, get_jwt_secret(), algorithm=JWT_ALGORITHM)


def create_refresh_token(user_id: str) -> str:
    payload = {
        "sub": user_id,
        "exp": datetime.now(timezone.utc) + timedelta(days=REFRESH_TTL_DAYS),
        "type": "refresh",
    }
    return jwt.encode(payload, get_jwt_secret(), algorithm=JWT_ALGORITHM)


def decode_token(token: str) -> dict:
    return jwt.decode(token, get_jwt_secret(), algorithms=[JWT_ALGORITHM])


def set_auth_cookies(response, access_token: str, refresh_token: str) -> None:
    response.set_cookie(
        key="access_token",
        value=access_token,
        httponly=True,
        secure=True,
        samesite="none",
        max_age=ACCESS_TTL_MIN * 60,
        path="/",
    )
    response.set_cookie(
        key="refresh_token",
        value=refresh_token,
        httponly=True,
        secure=True,
        samesite="none",
        max_age=REFRESH_TTL_DAYS * 24 * 3600,
        path="/",
    )


def clear_auth_cookies(response) -> None:
    response.delete_cookie("access_token", path="/")
    response.delete_cookie("refresh_token", path="/")


def _extract_token(request: Request) -> Optional[str]:
    token = request.cookies.get("access_token")
    if not token:
        auth_header = request.headers.get("Authorization", "")
        if auth_header.startswith("Bearer "):
            token = auth_header[7:]
    return token


async def get_current_user(request: Request) -> dict:
    """Dependency: returns current user dict from MongoDB."""
    token = _extract_token(request)
    if not token:
        raise HTTPException(status_code=401, detail="Not authenticated")
    try:
        payload = decode_token(token)
        if payload.get("type") != "access":
            raise HTTPException(status_code=401, detail="Invalid token type")
        db = get_db()
        user = await db.users.find_one({"id": payload["sub"]}, {"_id": 0, "password_hash": 0})
        if not user:
            raise HTTPException(status_code=401, detail="User not found")
        if not user.get("active", True):
            raise HTTPException(status_code=403, detail="Account disabled")
        
        # Check license validity (decrypt + HMAC verify + expiry) on every request.
        from license_guard import _is_license_blocked
        from license_verifier import decrypt_license_doc
        raw_lic = await db.licenses.find_one({"property_id": user["property_id"]}, {"_id": 0})
        if raw_lic:
            try:
                lic = decrypt_license_doc(raw_lic)
            except ValueError:
                raise HTTPException(
                    status_code=403,
                    detail={
                        "code": "license_tampered",
                        "message": "License integrity check failed. Contact support.",
                        "license_status": "tampered",
                    },
                )
            blocked, reason = _is_license_blocked(lic)
            if blocked:
                raise HTTPException(
                    status_code=403,
                    detail={
                        "code": f"license_{reason}",
                        "message": f"License is {reason}. Please renew to continue.",
                        "license_status": reason,
                    },
                )
        
        return user
    except jwt.ExpiredSignatureError:
        raise HTTPException(status_code=401, detail="Token expired")
    except jwt.InvalidTokenError:
        raise HTTPException(status_code=401, detail="Invalid token")


def require_roles(*roles: str):
    """Dependency factory enforcing role-based access."""

    async def _checker(user: dict = Depends(get_current_user)) -> dict:
        if user["role"] not in roles and user["role"] != "super_admin":
            raise HTTPException(
                status_code=403,
                detail=f"Forbidden. Required role: {', '.join(roles)}",
            )
        return user

    return _checker


# ============ Gateway API-key auth ============
async def get_gateway_from_api_key(api_key: str) -> dict:
    """Validate gateway API key, return gateway document."""
    db = get_db()
    gateway = await db.gateways.find_one({"api_key": api_key}, {"_id": 0})
    if not gateway:
        raise HTTPException(status_code=401, detail="Invalid gateway API key")
    return gateway
