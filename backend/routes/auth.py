from fastapi import APIRouter, Request, Response, HTTPException
import httpx
import uuid
from datetime import datetime, timezone, timedelta
from database import db
from dependencies import require_user
from models import User
from fastapi import Depends
from services import send_welcome_email
from security import limiter
from encryption import encrypt_field, decrypt_field, hash_token, is_encrypted
import hashlib

router = APIRouter(tags=["auth"])


@router.post("/auth/session")
@limiter.limit("10/minute")
async def create_session(request: Request, response: Response):
    body = await request.json()
    session_id = body.get("session_id")
    if not session_id:
        raise HTTPException(status_code=400, detail="session_id required")
    async with httpx.AsyncClient() as client_http:
        auth_response = await client_http.get("https://demobackend.emergentagent.com/auth/v1/env/oauth/session-data", headers={"X-Session-ID": session_id})
        if auth_response.status_code != 200:
            raise HTTPException(status_code=401, detail="Invalid session")
        user_data = auth_response.json()

    email = user_data.get("email", "")
    name = user_data.get("name", "")
    picture = user_data.get("picture", "")
    session_token = user_data.get("session_token", "")

    # Deterministic hash for email lookup (searchable even when encrypted)
    email_hash = hashlib.sha256(email.lower().strip().encode()).hexdigest()

    # Look up user by email_hash first, fallback to plaintext email (migration)
    existing_user = await db.users.find_one({"email_hash": email_hash}, {"_id": 0})
    if not existing_user:
        # Fallback: find by plaintext email (pre-encryption users)
        existing_user = await db.users.find_one({"email": email}, {"_id": 0})

    if existing_user:
        user_id = existing_user["user_id"]
        # Update with encrypted fields + email_hash
        await db.users.update_one({"user_id": user_id}, {"$set": {
            "name": encrypt_field(name),
            "picture": picture,
            "email": encrypt_field(email),
            "email_hash": email_hash,
        }})
    else:
        user_id = f"user_{uuid.uuid4().hex[:12]}"
        await db.users.insert_one({
            "user_id": user_id,
            "email": encrypt_field(email),
            "email_hash": email_hash,
            "name": encrypt_field(name),
            "picture": picture,
            "created_at": datetime.now(timezone.utc),
            "weight_kg": 70.0,
            "activity_level": "moderate",
            "health_goals": [],
        })
        await db.user_settings.insert_one({
            "user_id": user_id,
            "daily_water_goal_ml": 2500, "daily_calorie_goal": 2000, "daily_protein_goal": 50,
            "wake_time": "07:00", "sleep_time": "23:00",
            "water_reminder_enabled": True, "meal_reminder_enabled": True,
            "routine_reminder_enabled": True,
        })
        # Welcome email (fire-and-forget, uses plaintext email)
        import asyncio
        asyncio.create_task(send_welcome_email(email, name))

    # ── Session token: store HASHED in DB, send raw to client ──
    expires_at = datetime.now(timezone.utc) + timedelta(days=7)
    token_hash = hash_token(session_token)
    await db.user_sessions.delete_many({"user_id": user_id})
    await db.user_sessions.insert_one({
        "session_token": token_hash,
        "user_id": user_id,
        "expires_at": expires_at,
        "created_at": datetime.now(timezone.utc),
    })
    response.set_cookie(key="session_token", value=session_token, httponly=True, secure=True, samesite="none", path="/", max_age=7*24*60*60)

    # Return decrypted user data to client
    user_doc = await db.users.find_one({"user_id": user_id}, {"_id": 0})
    safe_doc = _decrypt_user_doc(user_doc)
    safe_doc["session_token"] = session_token  # raw token for client
    return safe_doc


@router.get("/auth/me")
async def get_me(user: User = Depends(require_user)):
    return {
        "user_id": user.user_id,
        "email": user.email,
        "name": user.name,
        "picture": user.picture,
        "weight_kg": user.weight_kg,
        "activity_level": user.activity_level,
        "health_goals": user.health_goals,
    }


@router.post("/auth/logout")
async def logout(request: Request, response: Response):
    session_token = _extract_token(request)
    if session_token:
        token_hash = hash_token(session_token)
        # Try hashed first, then raw (migration)
        result = await db.user_sessions.delete_many({"session_token": token_hash})
        if result.deleted_count == 0:
            await db.user_sessions.delete_many({"session_token": session_token})
    response.delete_cookie(key="session_token", path="/")
    return {"message": "Logged out"}


# ── Helpers ──
def _extract_token(request: Request) -> str:
    token = request.cookies.get("session_token")
    if not token:
        auth_header = request.headers.get("Authorization")
        if auth_header and auth_header.startswith("Bearer "):
            token = auth_header.split(" ")[1]
    return token or ""


def _decrypt_user_doc(doc: dict) -> dict:
    """Decrypt PII fields for client response."""
    if not doc:
        return doc
    out = dict(doc)
    for field in ("email", "name"):
        if field in out and out[field]:
            out[field] = decrypt_field(out[field])
    return out
