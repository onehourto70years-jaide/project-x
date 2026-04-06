"""NutriOS Auth Dependencies."""
from fastapi import Request, HTTPException
from datetime import datetime, timezone
from typing import Optional
from database import db
from models import User


async def get_current_user(request: Request) -> Optional[User]:
    session_token = request.cookies.get("session_token")
    if not session_token:
        auth_header = request.headers.get("Authorization")
        if auth_header and auth_header.startswith("Bearer "):
            session_token = auth_header.split(" ")[1]
    if not session_token:
        return None
    session_doc = await db.user_sessions.find_one({"session_token": session_token}, {"_id": 0})
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
    return User(**user_doc)


async def require_user(request: Request) -> User:
    user = await get_current_user(request)
    if not user:
        raise HTTPException(status_code=401, detail="Not authenticated")
    return user


async def get_current_user_optional(request: Request) -> Optional[User]:
    """Optional auth — returns None if not authenticated instead of raising."""
    try:
        session_token = request.cookies.get("session_token")
        if not session_token:
            auth_header = request.headers.get("Authorization")
            if auth_header and auth_header.startswith("Bearer "):
                session_token = auth_header.split(" ")[1]
        if not session_token:
            return None
        session = await db.user_sessions.find_one({"session_token": session_token})
        if not session:
            return None
        if datetime.fromisoformat(str(session["expires_at"])).replace(tzinfo=timezone.utc) < datetime.now(timezone.utc):
            return None
        user_doc = await db.users.find_one({"user_id": session["user_id"]})
        if not user_doc:
            return None
        return User(user_id=user_doc["user_id"], email=user_doc["email"], name=user_doc.get("name", ""))
    except Exception:
        return None
