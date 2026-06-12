"""Realtime websocket manager + notification helpers."""
from __future__ import annotations

import asyncio
import json
from datetime import datetime, timezone
from typing import Set

from fastapi import WebSocket

from models import Notification, AuditLog, utc_now, new_id


class ConnectionManager:
    def __init__(self) -> None:
        self.active: Set[WebSocket] = set()
        self._lock = asyncio.Lock()

    async def connect(self, ws: WebSocket) -> None:
        await ws.accept()
        async with self._lock:
            self.active.add(ws)

    async def disconnect(self, ws: WebSocket) -> None:
        async with self._lock:
            self.active.discard(ws)

    async def broadcast(self, event_type: str, payload: dict) -> None:
        message = json.dumps({
            "type": event_type,
            "payload": payload,
            "ts": datetime.now(timezone.utc).isoformat(),
        }, default=str)
        async with self._lock:
            connections = list(self.active)
        dead = []
        for ws in connections:
            try:
                await ws.send_text(message)
            except Exception:
                dead.append(ws)
        if dead:
            async with self._lock:
                for ws in dead:
                    self.active.discard(ws)


manager = ConnectionManager()


async def push_notification(db, *, type_: str, title: str, message: str, severity: str = "info",
                            property_id: str = "PROP-001", related_id: str | None = None) -> None:
    notif = Notification(
        type=type_,
        title=title,
        message=message,
        severity=severity,
        property_id=property_id,
        related_id=related_id,
    )
    doc = notif.model_dump()
    doc["created_at"] = doc["created_at"].isoformat()
    await db.notifications.insert_one(doc)
    doc.pop("_id", None)
    await manager.broadcast("notification", doc)
    # Queue for cloud sync (lazy import avoids circular deps)
    try:
        from cloud_sync import queue_event
        await queue_event(db, event_type="notification", payload=doc, property_id=property_id)
    except Exception:
        pass


async def write_audit(db, *, actor: dict | None, action: str, entity_type: str,
                       entity_id: str | None = None, description: str = "",
                       metadata: dict | None = None, property_id: str | None = None) -> None:
    log = AuditLog(
        actor_id=actor.get("id") if actor else None,
        actor_email=actor.get("email") if actor else None,
        actor_role=actor.get("role") if actor else None,
        action=action,
        entity_type=entity_type,
        entity_id=entity_id,
        description=description,
        metadata=metadata or {},
        property_id=property_id or (actor.get("property_id") if actor else None),
        sync_status="pending",
    )
    doc = log.model_dump()
    doc["created_at"] = doc["created_at"].isoformat()
    await db.audit_logs.insert_one(doc)
    doc.pop("_id", None)
    await manager.broadcast("audit", {"id": doc["id"], "action": action, "description": description})
    # Queue for cloud sync
    try:
        from cloud_sync import queue_event
        await queue_event(db, event_type="audit", payload=doc, property_id=doc["property_id"] or "PROP-001")
    except Exception:
        pass


async def queue_for_sync(db, *, event_type: str, payload: dict, property_id: str) -> None:
    """Convenience wrapper used by routes that want to push a domain event
    (billing, room-state, etc.) into the cloud queue without writing an audit."""
    try:
        from cloud_sync import queue_event
        await queue_event(db, event_type=event_type, payload=payload, property_id=property_id)
    except Exception:
        pass
