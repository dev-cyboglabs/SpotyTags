"""Password hashing — zero-dependency module to break the auth ↔ db cycle.

Both `auth.py` and `db.py` (which seeds users) need `hash_password`. By
locating it here we let `db.py` import this module without pulling in
the rest of `auth.py`, eliminating the cycle.
"""
from __future__ import annotations

import bcrypt


def hash_password(password: str) -> str:
    salt = bcrypt.gensalt()
    return bcrypt.hashpw(password.encode("utf-8"), salt).decode("utf-8")


def verify_password(plain: str, hashed: str) -> bool:
    try:
        return bcrypt.checkpw(plain.encode("utf-8"), hashed.encode("utf-8"))
    except Exception:
        return False
