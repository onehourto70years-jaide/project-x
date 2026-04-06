from fastapi import APIRouter, Request, Depends, HTTPException
from database import db
from dependencies import require_user
from models import User
from config import logger
from services import send_expo_push
from datetime import datetime, timezone

router = APIRouter(tags=["notifications"])


@router.post("/notifications/register-token")
async def register_push_token(request: Request, user: User = Depends(require_user)):
    body = await request.json()
    push_token = body.get("push_token")
    if not push_token:
        raise HTTPException(status_code=400, detail="push_token required")
    await db.push_tokens.update_one(
        {"user_id": user.user_id},
        {"$set": {"user_id": user.user_id, "push_token": push_token, "platform": body.get("platform", "unknown"), "updated_at": datetime.now(timezone.utc)}},
        upsert=True
    )
    logger.info(f"Push token registered for user {user.user_id}")
    return {"status": "registered"}


@router.delete("/notifications/unregister-token")
async def unregister_push_token(user: User = Depends(require_user)):
    await db.push_tokens.delete_many({"user_id": user.user_id})
    return {"status": "unregistered"}


@router.post("/notifications/test")
async def send_test_notification(user: User = Depends(require_user)):
    token_doc = await db.push_tokens.find_one({"user_id": user.user_id}, {"_id": 0})
    if not token_doc or not token_doc.get("push_token"):
        raise HTTPException(status_code=404, detail="No push token registered. Enable notifications on your device.")
    await send_expo_push([token_doc["push_token"]], "\U0001f9ec NutriOS Test", "Push notifications are working! You'll receive water & meal reminders.", {"type": "test"})
    return {"status": "sent", "message": "Test notification sent to your device"}


@router.get("/notifications/status")
async def get_notification_status(user: User = Depends(require_user)):
    token_doc = await db.push_tokens.find_one({"user_id": user.user_id}, {"_id": 0})
    settings = await db.user_settings.find_one({"user_id": user.user_id}, {"_id": 0}) or {}
    return {
        "push_token_registered": bool(token_doc and token_doc.get("push_token")),
        "notifications_enabled": settings.get("notifications_enabled", True),
        "water_reminder_enabled": settings.get("water_reminder_enabled", True),
        "meal_reminder_enabled": settings.get("meal_reminder_enabled", True),
        "routine_reminder_enabled": settings.get("routine_reminder_enabled", True),
    }
