"""Currency / locale settings for international deployments.

A single property doc carries `currency_code` (ISO 4217) and `locale`.
Frontend reads `/api/settings/currency` once and formats everything.
"""
from __future__ import annotations

from typing import Optional, List, Dict

# ISO 4217 — symbol + locale + decimals.  Curated list of the most common
# currencies for hospitality.  Frontend uses `Intl.NumberFormat`
# with `locale` so digit grouping matches local convention.
CURRENCIES: List[Dict[str, str]] = [
    {"code": "INR", "symbol": "₹",   "name": "Indian Rupee",        "locale": "en-IN", "decimals": 2},
    {"code": "USD", "symbol": "$",   "name": "US Dollar",           "locale": "en-US", "decimals": 2},
    {"code": "EUR", "symbol": "€",   "name": "Euro",                "locale": "de-DE", "decimals": 2},
    {"code": "GBP", "symbol": "£",   "name": "British Pound",       "locale": "en-GB", "decimals": 2},
    {"code": "AED", "symbol": "د.إ", "name": "UAE Dirham",          "locale": "ar-AE", "decimals": 2},
    {"code": "SAR", "symbol": "﷼",  "name": "Saudi Riyal",         "locale": "ar-SA", "decimals": 2},
    {"code": "JPY", "symbol": "¥",   "name": "Japanese Yen",        "locale": "ja-JP", "decimals": 0},
    {"code": "CNY", "symbol": "¥",   "name": "Chinese Yuan",        "locale": "zh-CN", "decimals": 2},
    {"code": "SGD", "symbol": "S$",  "name": "Singapore Dollar",    "locale": "en-SG", "decimals": 2},
    {"code": "AUD", "symbol": "A$",  "name": "Australian Dollar",   "locale": "en-AU", "decimals": 2},
    {"code": "CAD", "symbol": "C$",  "name": "Canadian Dollar",     "locale": "en-CA", "decimals": 2},
    {"code": "CHF", "symbol": "CHF", "name": "Swiss Franc",         "locale": "de-CH", "decimals": 2},
    {"code": "HKD", "symbol": "HK$", "name": "Hong Kong Dollar",    "locale": "en-HK", "decimals": 2},
    {"code": "THB", "symbol": "฿",   "name": "Thai Baht",           "locale": "th-TH", "decimals": 2},
    {"code": "IDR", "symbol": "Rp",  "name": "Indonesian Rupiah",   "locale": "id-ID", "decimals": 0},
    {"code": "MYR", "symbol": "RM",  "name": "Malaysian Ringgit",   "locale": "ms-MY", "decimals": 2},
    {"code": "ZAR", "symbol": "R",   "name": "South African Rand",  "locale": "en-ZA", "decimals": 2},
    {"code": "BRL", "symbol": "R$",  "name": "Brazilian Real",      "locale": "pt-BR", "decimals": 2},
    {"code": "MXN", "symbol": "Mex$","name": "Mexican Peso",        "locale": "es-MX", "decimals": 2},
    {"code": "TRY", "symbol": "₺",   "name": "Turkish Lira",        "locale": "tr-TR", "decimals": 2},
]


def by_code(code: str) -> Optional[Dict[str, str]]:
    code = (code or "").upper()
    for c in CURRENCIES:
        if c["code"] == code:
            return c
    return None


DEFAULT_CURRENCY = "INR"
