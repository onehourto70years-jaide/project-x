"""NutriOS Security — Rate Limiting & Input Sanitization.

Provides:
  1. SlowAPI rate-limiter (keyed by client IP).
  2. `sanitize(text)` helper to strip dangerous content.
  3. `SanitizeMiddleware` that cleans all incoming JSON string fields.
"""

import re
import html
import json
from typing import Any

from slowapi import Limiter
from slowapi.util import get_remote_address
from slowapi.errors import RateLimitExceeded
from slowapi.middleware import SlowAPIMiddleware
from starlette.requests import Request
from starlette.responses import JSONResponse
from starlette.middleware.base import BaseHTTPMiddleware

from config import logger

# ────────────────────────────────────────────
#  Rate Limiter
# ────────────────────────────────────────────
limiter = Limiter(
    key_func=get_remote_address,
    default_limits=["120/minute"],          # generous global default
    storage_uri="memory://",
)


def rate_limit_exceeded_handler(_request: Request, exc: RateLimitExceeded):
    """Custom 429 JSON response."""
    return JSONResponse(
        status_code=429,
        content={
            "detail": "Too many requests. Please slow down.",
            "retry_after": str(exc.detail),
        },
    )


# ────────────────────────────────────────────
#  Input Sanitization Helpers
# ────────────────────────────────────────────
_SCRIPT_RE   = re.compile(r"<script[^>]*>.*?</script>", re.IGNORECASE | re.DOTALL)
_TAG_RE      = re.compile(r"<[^>]+>")
_EVENT_RE    = re.compile(r"\bon\w+\s*=", re.IGNORECASE)
_JS_RE       = re.compile(r"javascript\s*:", re.IGNORECASE)
_SQL_RE      = re.compile(
    r"(?:--|;|\'|\"|/\*|\*/|xp_|sp_|exec\s|union\s+select|drop\s+table|insert\s+into|delete\s+from|update\s+.+\s+set)",
    re.IGNORECASE,
)
_MONGO_RE    = re.compile(r"\$(?:gt|gte|lt|lte|ne|in|nin|and|or|not|regex|where|exists|elemMatch)", re.IGNORECASE)

# Characters that should never appear in normal user text
_CONTROL_RE  = re.compile(r"[\x00-\x08\x0b\x0c\x0e-\x1f]")

MAX_FIELD_LENGTH = 5000       # hard cap for any single string field


def sanitize(text: str) -> str:
    """Return a safe copy of *text* with XSS / injection vectors removed."""
    if not isinstance(text, str):
        return text

    # Truncate excessively long values
    text = text[:MAX_FIELD_LENGTH]

    # Strip control characters
    text = _CONTROL_RE.sub("", text)

    # Strip <script> blocks, HTML tags, JS event handlers, javascript: URIs
    text = _SCRIPT_RE.sub("", text)
    text = _TAG_RE.sub("", text)
    text = _EVENT_RE.sub("", text)
    text = _JS_RE.sub("", text)

    # Neutralize SQL-like patterns (replace with empty)
    text = _SQL_RE.sub("", text)

    # Neutralize MongoDB operators (strip leading $)
    text = _MONGO_RE.sub("", text)

    # Escape remaining HTML entities as a final safety net
    text = html.unescape(text)           # first normalise double-encoded entities
    text = text.replace("&", "&amp;").replace("<", "&lt;").replace(">", "&gt;")

    return text.strip()


def _sanitize_value(val: Any) -> Any:
    """Recursively sanitize strings inside dicts / lists / primitives."""
    if isinstance(val, str):
        return sanitize(val)
    if isinstance(val, dict):
        return {k: _sanitize_value(v) for k, v in val.items()}
    if isinstance(val, list):
        return [_sanitize_value(v) for v in val]
    return val


# ────────────────────────────────────────────
#  Sanitization Middleware
# ────────────────────────────────────────────
class SanitizeMiddleware(BaseHTTPMiddleware):
    """Intercepts POST / PUT / PATCH requests and sanitizes all string
    values in the JSON body before the route handler sees them."""

    async def dispatch(self, request: Request, call_next):
        if request.method in ("POST", "PUT", "PATCH"):
            content_type = request.headers.get("content-type", "")
            if "application/json" in content_type:
                try:
                    raw_body = await request.body()
                    if raw_body:
                        data = json.loads(raw_body)
                        clean = _sanitize_value(data)
                        # Monkey-patch the receive so downstream sees the clean body
                        clean_bytes = json.dumps(clean).encode("utf-8")

                        async def receive():
                            return {"type": "http.request", "body": clean_bytes}

                        request._receive = receive
                except (json.JSONDecodeError, UnicodeDecodeError):
                    pass  # let FastAPI handle the bad payload

        return await call_next(request)
