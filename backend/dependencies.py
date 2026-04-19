"""NutriOS Auth Dependencies — with hashed token lookup and PII decryption."""
from fastapi import Request, HTTPException
from datetime import datetime, timezone
from typing import Optional
from database import db
from models import User
from encryption import hash_token, decrypt_field


def _extract_token(request: Request) -> str:
    """Extract session token from cookie or Authorization header."""
    token = request.cookies.get("session_token")
    if not token:
        auth_header = request.headers.get("Authorization")
        if auth_header and auth_header.startswith("Bearer "):
            token = auth_header.split(" ")[1]
    return token or ""


async def _find_session(session_token: str) -> Optional[dict]:
    """Find session by hashed token, with fallback for pre-migration plain tokens."""
    if not session_token:
        return None
    # Try hashed lookup first (new sessions)
    token_hash = hash_token(session_token)
    session_doc = await db.user_sessions.find_one({"session_token": token_hash}, {"_id": 0})
    if session_doc:
        return session_doc
    # Fallback: plain token lookup (old sessions, pre-migration)
    session_doc = await db.user_sessions.find_one({"session_token": session_token}, {"_id": 0})
    if session_doc:
        # Migrate this session to hashed format
        await db.user_sessions.update_one(
            {"session_token": session_token},
            {"$set": {"session_token": token_hash}}
        )
        return session_doc
    return None


def _decrypt_user(user_doc: dict) -> dict:
    """Decrypt PII fields from user document."""
    if not user_doc:
        return user_doc
    doc = dict(user_doc)
    for field in ("email", "name"):
        if field in doc and doc[field]:
            doc[field] = decrypt_field(doc[field])
    return doc


async def get_current_user(request: Request) -> Optional[User]:
    session_token = _extract_token(request)
    if not session_token:
        return None
    session_doc = await _find_session(session_token)
    if not session_doc:
        return None
    expires_at = session_doc.get("expires_at")
    if isinstance(expires_at, str):
        expires_at = datetime.fromisoformat(expires_at)
    if expires_at.tzinfo is None:
        expires_at = expires_at.replace(tzinfo=timezone.utc)
    if expires_at < datetime.now(timezone.utc):
        return None
    user_doc = await db.users.find_one({"user_id": session_doc["user_id"]}, {"_id": 0})
    if not user_doc:
        return None
    # Decrypt PII before creating User model
    user_doc = _decrypt_user(user_doc)
    return User(**user_doc)


async def require_user(request: Request) -> User:
    user = await get_current_user(request)
    if not user:
        raise HTTPException(status_code=401, detail="Not authenticated")
    return user


async def get_current_user_optional(request: Request) -> Optional[User]:
    """Optional auth — returns None if not authenticated instead of raising."""
    try:
        return await get_current_user(request)
    except Exception:
        return None
