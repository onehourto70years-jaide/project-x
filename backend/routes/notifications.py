from fastapi import APIRouter, Request, Depends, HTTPException
from database import db
from dependencies import require_user
from models import User
from config import logger
from services import send_expo_push, _get_user_lang, _log_notification
from notification_i18n import get_notif_string
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
    lang = await _get_user_lang(user.user_id)
    title = get_notif_string(lang, "test_title")
    body = get_notif_string(lang, "test_body")
    await send_expo_push([token_doc["push_token"]], title, body, {"type": "test"})
    await _log_notification(user.user_id, "test", title, body)
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


@router.get("/notifications/history")
async def get_notification_history(user: User = Depends(require_user), limit: int = 30):
    """Get the user's notification history (most recent first)."""
    notifications = await db.notification_logs.find(
        {"user_id": user.user_id},
        {"_id": 0}
    ).sort("sent_at", -1).limit(limit).to_list(limit)
    unread_count = await db.notification_logs.count_documents({"user_id": user.user_id, "read": False})
    return {"notifications": notifications, "unread_count": unread_count}


@router.post("/notifications/mark-read")
async def mark_notifications_read(user: User = Depends(require_user)):
    """Mark all notifications as read for the user."""
    result = await db.notification_logs.update_many(
        {"user_id": user.user_id, "read": False},
        {"$set": {"read": True}}
    )
    return {"marked_read": result.modified_count}


@router.get("/notifications/schedule")
async def get_notification_schedule(user: User = Depends(require_user)):
    """Return the notification schedule info for the user."""
    settings = await db.user_settings.find_one({"user_id": user.user_id}, {"_id": 0}) or {}
    return {
        "schedule": {
            "water_reminders": {
                "enabled": settings.get("water_reminder_enabled", True),
                "times": ["08:00", "10:00", "12:00", "14:00", "16:00", "18:00", "20:00"],
                "type": "smart",
                "description": "Checks your actual water intake before sending"
            },
            "meal_reminders": {
                "enabled": settings.get("meal_reminder_enabled", True),
                "times": ["07:00 (Breakfast)", "12:00 (Lunch)", "18:00 (Dinner)"],
                "type": "standard",
                "description": "Translated meal reminders at set times"
            },
            "routine_reminders": {
                "enabled": settings.get("routine_reminder_enabled", True),
                "times": ["06:30 (Morning)", "15:00 (Task check)", "21:00 (Evening)"],
                "type": "smart",
                "description": "Checks uncompleted tasks before sending"
            },
            "smart_alerts": {
                "calorie_check": "19:30 — Evening intake summary",
                "streak_risk": "20:30 — Alert if streak about to break",
                "daily_summary": "21:30 — Daily activity summary",
                "inactivity": "10:00 — Nudge after 2+ days inactive",
            }
        },
        "timezone": "UTC",
        "note": "All times are in UTC. Notifications are personalized to your language preference."
    }
