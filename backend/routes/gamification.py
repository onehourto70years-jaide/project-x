from fastapi import APIRouter, Depends
from datetime import datetime, timezone, timedelta
from database import db
from dependencies import require_user
from models import User
from config import BADGE_DEFINITIONS

router = APIRouter(tags=["gamification"])


@router.get("/badges")
async def get_badges(user: User = Depends(require_user)):
    total_meals = await db.meals.count_documents({"user_id": user.user_id})
    unique_foods = len(await db.meals.distinct("food_name", {"user_id": user.user_id}))
    total_recipes = await db.recipes.count_documents({"user_id": user.user_id})
    streak = 0
    today = datetime.now(timezone.utc).date()
    for i in range(365):
        d = (today - timedelta(days=i)).isoformat()
        summary = await db.daily_summaries.find_one({"user_id": user.user_id, "date": d})
        if summary and summary.get("total_calories", 0) > 0:
            streak += 1
        else:
            if i > 0: break
    water_goals_met = await db.daily_summaries.count_documents({"user_id": user.user_id, "water_goal_met": True})
    settings = await db.user_settings.find_one({"user_id": user.user_id}) or {}
    protein_goal = settings.get("daily_protein_goal", 50)
    protein_goals_met = await db.daily_summaries.count_documents({"user_id": user.user_id, "total_protein": {"$gte": protein_goal}})
    routines_completed_days = 0
    stats = {"meals_logged": total_meals, "streak": streak, "water_goals_met": water_goals_met, "protein_goals_met": protein_goals_met, "unique_foods": unique_foods, "recipes_created": total_recipes, "routines_completed_days": routines_completed_days}
    earned = await db.badges.find({"user_id": user.user_id}, {"_id": 0}).to_list(100)
    earned_ids = {b["badge_id"] for b in earned}
    badges = []
    newly_earned = []
    for bd in BADGE_DEFINITIONS:
        is_earned = bd["id"] in earned_ids
        if not is_earned:
            condition = bd["condition"]
            parts = condition.split(" >= ")
            if len(parts) == 2:
                stat_name = parts[0].strip()
                threshold = int(parts[1].strip())
                if stats.get(stat_name, 0) >= threshold:
                    is_earned = True
                    newly_earned.append(bd["id"])
                    await db.badges.insert_one({"user_id": user.user_id, "badge_id": bd["id"], "earned_at": datetime.now(timezone.utc).isoformat()})
        badges.append({**bd, "earned": is_earned})
    week_start = (today - timedelta(days=today.weekday())).isoformat()
    week_meals = await db.meals.count_documents({"user_id": user.user_id, "timestamp": {"$gte": week_start}})
    return {"badges": badges, "newly_earned": newly_earned, "stats": stats, "weekly_summary": {"meals_this_week": week_meals, "current_streak": streak, "total_badges_earned": len(earned_ids) + len(newly_earned), "total_badges": len(BADGE_DEFINITIONS)}}
