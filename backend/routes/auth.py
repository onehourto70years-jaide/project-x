from fastapi import APIRouter, Request, Response, HTTPException
import httpx
import uuid
from datetime import datetime, timezone, timedelta
from database import db
from dependencies import require_user
from models import User
from fastapi import Depends
from services import send_welcome_email

router = APIRouter(tags=["auth"])


@router.post("/auth/session")
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
    email, name, picture, session_token = user_data.get("email"), user_data.get("name"), user_data.get("picture"), user_data.get("session_token")
    existing_user = await db.users.find_one({"email": email}, {"_id": 0})
    if existing_user:
        user_id = existing_user["user_id"]
        await db.users.update_one({"user_id": user_id}, {"$set": {"name": name, "picture": picture}})
    else:
        user_id = f"user_{uuid.uuid4().hex[:12]}"
        await db.users.insert_one({"user_id": user_id, "email": email, "name": name, "picture": picture, "created_at": datetime.now(timezone.utc), "weight_kg": 70.0, "activity_level": "moderate", "health_goals": []})
        await db.user_settings.insert_one({"user_id": user_id, "daily_water_goal_ml": 2500, "daily_calorie_goal": 2000, "daily_protein_goal": 50, "wake_time": "07:00", "sleep_time": "23:00", "water_reminder_enabled": True, "meal_reminder_enabled": True, "routine_reminder_enabled": True})
        # Send welcome email to new user (fire-and-forget)
        import asyncio
        asyncio.create_task(send_welcome_email(email, name))
    expires_at = datetime.now(timezone.utc) + timedelta(days=7)
    await db.user_sessions.delete_many({"user_id": user_id})
    await db.user_sessions.insert_one({"session_token": session_token, "user_id": user_id, "expires_at": expires_at, "created_at": datetime.now(timezone.utc)})
    response.set_cookie(key="session_token", value=session_token, httponly=True, secure=True, samesite="none", path="/", max_age=7*24*60*60)
    user_doc = await db.users.find_one({"user_id": user_id}, {"_id": 0})
    user_doc["session_token"] = session_token
    return user_doc


@router.get("/auth/me")
async def get_me(user: User = Depends(require_user)):
    return {"user_id": user.user_id, "email": user.email, "name": user.name, "picture": user.picture, "weight_kg": user.weight_kg, "activity_level": user.activity_level, "health_goals": user.health_goals}


@router.post("/auth/logout")
async def logout(request: Request, response: Response):
    session_token = request.cookies.get("session_token")
    if session_token:
        await db.user_sessions.delete_many({"session_token": session_token})
    response.delete_cookie(key="session_token", path="/")
    return {"message": "Logged out"}
