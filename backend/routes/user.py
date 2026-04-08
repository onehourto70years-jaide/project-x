from fastapi import APIRouter, Request, Response, HTTPException, Depends
from typing import Dict, Any
from database import db
from dependencies import require_user
from models import User
from config import logger
from services import send_account_deletion_email
from security import limiter, _sanitize_value
import asyncio

router = APIRouter(tags=["user"])


@router.get("/user/settings")
async def get_user_settings(user: User = Depends(require_user)):
    settings = await db.user_settings.find_one({"user_id": user.user_id}, {"_id": 0})
    if not settings:
        settings = {"daily_water_goal_ml": 2500, "daily_calorie_goal": 2000, "daily_protein_goal": 50, "water_reminder_enabled": True, "meal_reminder_enabled": True, "routine_reminder_enabled": True}
    return settings


@router.put("/user/settings")
async def update_user_settings(settings: Dict[str, Any], user: User = Depends(require_user)):
    settings = _sanitize_value(settings)
    await db.user_settings.update_one({"user_id": user.user_id}, {"$set": settings}, upsert=True)
    return {"message": "Settings updated"}


@router.put("/user/profile")
async def update_user_profile(profile: Dict[str, Any], user: User = Depends(require_user)):
    profile = _sanitize_value(profile)
    allowed = ["weight_kg", "height_cm", "age", "sex", "activity_level", "weight_goal", "health_goals", "name", "language_preference"]
    update_data = {k: v for k, v in profile.items() if k in allowed}
    await db.users.update_one({"user_id": user.user_id}, {"$set": update_data})
    return {"message": "Profile updated"}


@router.delete("/user/account")
@limiter.limit("3/minute")
async def delete_user_account(request: Request, response: Response, user: User = Depends(require_user)):
    user_id = user.user_id
    user_doc = await db.users.find_one({"user_id": user_id})
    if user_doc and user_doc.get("is_premium") and not user_doc.get("cancel_at_period_end", False):
        raise HTTPException(status_code=400, detail="Please cancel your subscription before deleting your account.")
    # Capture email and name BEFORE deletion for confirmation email
    user_email = user_doc.get("email", "") if user_doc else ""
    user_name = user_doc.get("name", "") if user_doc else ""
    logger.info(f"Deleting account for user {user_id}")
    for coll in ["users", "user_settings", "user_sessions", "meals", "water_logs", "favorites", "recipes", "meal_plans", "routines", "user_badges", "ai_conversations"]:
        await db[coll].delete_many({"user_id": user_id})
    response.delete_cookie(key="session_token", path="/")
    logger.info(f"Account deleted for user {user_id}")
    # Send account deletion confirmation email (fire-and-forget)
    if user_email:
        asyncio.create_task(send_account_deletion_email(user_email, user_name))
    return {"message": "Account and all data permanently deleted"}
