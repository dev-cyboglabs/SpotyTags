"""Pydantic models for SpotyTags."""
from __future__ import annotations

from datetime import datetime, timezone
from typing import List, Optional, Literal, Dict, Any
import uuid

from pydantic import BaseModel, Field, EmailStr, ConfigDict


def utc_now() -> datetime:
    return datetime.now(timezone.utc)


def new_id() -> str:
    return str(uuid.uuid4())


# ============ Users ============
UserRole = Literal["super_admin", "hotel_admin", "reception", "housekeeping", "technician"]


class UserPublic(BaseModel):
    model_config = ConfigDict(extra="ignore")
    id: str
    email: str
    name: str
    role: UserRole
    property_id: Optional[str] = None
    active: bool = True
    created_at: datetime


class UserCreate(BaseModel):
    email: EmailStr
    name: str
    password: str
    role: UserRole = "reception"
    property_id: Optional[str] = None


class LoginRequest(BaseModel):
    email: EmailStr
    password: str


# ============ Property / Hotel ============
class Property(BaseModel):
    id: str = Field(default_factory=new_id)
    name: str
    address: Optional[str] = None
    phone: Optional[str] = None
    timezone: str = "Asia/Kolkata"
    currency: str = "INR"
    created_at: datetime = Field(default_factory=utc_now)


# ============ Rooms ============
RoomStatus = Literal[
    "vacant", "occupied", "checkout_pending", "cleaning", "maintenance",
    "do_not_disturb",
]


class Room(BaseModel):
    id: str = Field(default_factory=new_id)
    room_number: str
    floor: str
    room_type: str = "Deluxe"
    status: RoomStatus = "vacant"
    gateway_id: Optional[str] = None
    minibar_status: str = "ok"
    guest_name: Optional[str] = None
    current_stay_id: Optional[str] = None
    notes: Optional[str] = None
    property_id: str
    last_updated: datetime = Field(default_factory=utc_now)
    created_at: datetime = Field(default_factory=utc_now)


class RoomCreate(BaseModel):
    room_number: str
    floor: str
    room_type: str = "Deluxe"
    status: RoomStatus = "vacant"
    guest_name: Optional[str] = None
    notes: Optional[str] = None


class RoomUpdate(BaseModel):
    room_number: Optional[str] = None
    floor: Optional[str] = None
    room_type: Optional[str] = None
    status: Optional[RoomStatus] = None
    guest_name: Optional[str] = None
    notes: Optional[str] = None
    gateway_id: Optional[str] = None


# ============ Tags ============
TagStatus = Literal[
    "unassigned", "assigned", "active", "tamper_triggered",
    "low_battery", "not_seen", "faulty", "lost", "retired",
]


class Tag(BaseModel):
    id: str = Field(default_factory=new_id)
    tag_id: str  # ST-000001
    qr_code: str
    ble_mac: str
    battery: int = 100
    tamper_status: bool = False  # False = sealed, True = opened
    rssi: int = 0
    firmware_version: str = "v1.0.0"
    manufacturing_batch: Optional[str] = None
    notes: Optional[str] = None
    status: TagStatus = "unassigned"
    assigned_room_id: Optional[str] = None
    assigned_product_id: Optional[str] = None
    selling_price: Optional[float] = None
    last_seen: Optional[datetime] = None
    property_id: str
    created_at: datetime = Field(default_factory=utc_now)


class TagCreate(BaseModel):
    tag_id: str
    qr_code: Optional[str] = None
    ble_mac: str
    battery: int = 100
    firmware_version: str = "v1.0.0"
    manufacturing_batch: Optional[str] = None
    notes: Optional[str] = None


class TagAssign(BaseModel):
    room_id: str
    product_id: str
    selling_price: Optional[float] = None
    sticker_replaced: bool = True


class TagRestock(BaseModel):
    tag_id: str
    notes: Optional[str] = None


# ============ Gateways ============
GatewayStatus = Literal["online", "offline", "weak_signal", "not_configured", "needs_update", "maintenance"]


class Gateway(BaseModel):
    id: str = Field(default_factory=new_id)
    gateway_id: str  # GW-101
    mac_address: str
    ip_address: Optional[str] = None
    wifi_ssid: Optional[str] = None
    firmware_version: str = "v1.0.0"
    api_key: str
    room_id: Optional[str] = None
    room_number: Optional[str] = None
    floor: Optional[str] = None
    status: GatewayStatus = "not_configured"
    last_online: Optional[datetime] = None
    rssi: int = 0
    property_id: str
    created_at: datetime = Field(default_factory=utc_now)


class GatewayCreate(BaseModel):
    gateway_id: str
    mac_address: str
    ip_address: Optional[str] = None
    wifi_ssid: Optional[str] = None
    firmware_version: str = "v1.0.0"
    floor: Optional[str] = None
    room_id: Optional[str] = None


# ============ Products ============
ProductCategory = Literal[
    "water", "soft_drink", "juice", "energy_drink", "snack", "premium_beverage", "custom",
]


class Product(BaseModel):
    id: str = Field(default_factory=new_id)
    name: str
    category: ProductCategory = "soft_drink"
    brand: Optional[str] = None
    bottle_size: str = "330ml"
    sku: Optional[str] = None
    selling_price: float
    cost_price: Optional[float] = None
    tax_rate: float = 18.0
    image_url: Optional[str] = None
    description: Optional[str] = None
    active: bool = True
    property_id: str
    created_at: datetime = Field(default_factory=utc_now)


class ProductCreate(BaseModel):
    name: str
    category: ProductCategory = "soft_drink"
    brand: Optional[str] = None
    bottle_size: str = "330ml"
    sku: Optional[str] = None
    selling_price: float
    cost_price: Optional[float] = None
    tax_rate: float = 18.0
    image_url: Optional[str] = None
    description: Optional[str] = None


# ============ Billing ============
BillingStatus = Literal[
    "pending_review", "confirmed", "added_to_bill", "waived",
    "disputed", "complimentary", "cancelled",
]


class UsageEvent(BaseModel):
    id: str = Field(default_factory=new_id)
    tag_id: str
    tag_db_id: str  # tag.id
    room_id: str
    room_number: str
    product_id: Optional[str] = None
    product_name: Optional[str] = None
    selling_price: float = 0.0
    tax_rate: float = 18.0
    detected_at: datetime = Field(default_factory=utc_now)
    confirmed_at: Optional[datetime] = None
    confirmed_by: Optional[str] = None
    status: BillingStatus = "pending_review"
    guest_name: Optional[str] = None
    stay_id: Optional[str] = None
    notes: Optional[str] = None
    property_id: str


class BillingAction(BaseModel):
    action: Literal["confirm", "waive", "dispute", "complimentary", "cancel"]
    notes: Optional[str] = None


# ============ Gateway BLE Event ============
class GatewayBLEEvent(BaseModel):
    gateway_id: str
    api_key: str
    property_id: Optional[str] = None
    room_number: Optional[str] = None
    tag_id: str
    ble_mac: Optional[str] = None
    battery: int = 100
    tamper_status: bool = False
    gpio_status: int = 0
    rssi: int = 0
    timestamp: Optional[str] = None


# ============ License ============
LicenseStatus = Literal["trial", "active", "expiring_soon", "expired", "suspended", "cancelled"]
PlanName = Literal["trial", "starter", "professional", "enterprise"]


class License(BaseModel):
    id: str = Field(default_factory=new_id)
    license_key: str
    property_id: str
    hotel_group: str
    property_name: str
    plan: PlanName = "trial"
    status: LicenseStatus = "active"
    start_date: datetime = Field(default_factory=utc_now)
    expiry_date: datetime
    room_limit: int = 10
    gateway_limit: int = 10
    tag_limit: int = 100
    user_limit: int = 5
    pms_enabled: bool = False
    android_enabled: bool = True
    reports_enabled: bool = True
    theme_customization_enabled: bool = False
    offline_mode_enabled: bool = True
    auto_billing_enabled: bool = False
    cloud_sync_enabled: bool = True
    notes: Optional[str] = None
    created_at: datetime = Field(default_factory=utc_now)
    updated_at: datetime = Field(default_factory=utc_now)


# ============ Notifications ============
NotificationType = Literal[
    "tamper", "pending_bill", "low_battery", "gateway_offline",
    "tag_not_seen", "restock", "tag_assigned", "product_assigned",
    "billing_confirmed", "license_expiring", "license_expired",
    "limit_reached", "cloud_offline", "cloud_restored", "info",
]


class Notification(BaseModel):
    id: str = Field(default_factory=new_id)
    type: NotificationType
    title: str
    message: str
    severity: Literal["info", "warning", "danger", "success"] = "info"
    read: bool = False
    property_id: str
    related_id: Optional[str] = None
    created_at: datetime = Field(default_factory=utc_now)


# ============ Audit Logs ============
class AuditLog(BaseModel):
    id: str = Field(default_factory=new_id)
    actor_id: Optional[str] = None
    actor_email: Optional[str] = None
    actor_role: Optional[str] = None
    action: str
    entity_type: str
    entity_id: Optional[str] = None
    description: str
    metadata: Dict[str, Any] = Field(default_factory=dict)
    property_id: Optional[str] = None
    sync_status: Literal["synced", "pending", "failed"] = "pending"
    created_at: datetime = Field(default_factory=utc_now)


# ============ Settings ============
class ThemeSettings(BaseModel):
    theme_name: str = "luxury_gold"  # 10 built-in themes
    primary_color: str = "#FF7E6B"
    secondary_color: str = "#1F2937"
    accent_color: str = "#F59E0B"
    background_color: str = "#FAFAFA"
    card_style: str = "rounded"
    sidebar_style: str = "expanded"
    button_radius: str = "rounded-lg"
    dark_mode: bool = False
    logo_url: Optional[str] = None


class CloudSyncStatus(BaseModel):
    online: bool = True
    last_sync_at: Optional[datetime] = None
    pending_count: int = 0
    last_error: Optional[str] = None


# ============ Dashboard KPI ============
class DashboardKPI(BaseModel):
    total_rooms: int
    active_tags: int
    assigned_tags: int
    pending_bills: int
    confirmed_usage: int
    low_battery_tags: int
    offline_gateways: int
    tags_not_seen: int
    today_revenue: float
    monthly_revenue: float
    license_status: str
    license_expiry: datetime
    licensed_rooms_used: int
    licensed_rooms_total: int
    local_server_status: str = "online"
    cloud_sync_status: str
    last_sync_time: Optional[datetime] = None
