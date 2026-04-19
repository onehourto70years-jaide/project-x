from fastapi import APIRouter, Depends
from datetime import datetime, timezone, timedelta
from database import db
from dependencies import require_user
from models import User
from services import update_daily_summary

router = APIRouter(tags=["dashboard"])


@router.get("/dashboard")
async def get_dashboard(user: User = Depends(require_user)):
    today = datetime.now(timezone.utc).strftime("%Y-%m-%d")
    summary = await db.daily_summaries.find_one({"user_id": user.user_id, "date": today}, {"_id": 0})
    if not summary:
        summary = await update_daily_summary(user.user_id, today)
    settings = await db.user_settings.find_one({"user_id": user.user_id}, {"_id": 0}) or {}
    meals = await db.meals.find(
        {"user_id": user.user_id, "date": today},
        {"_id": 0, "id": 1, "food_name": 1, "portion_grams": 1, "cooking_method": 1, "nutrients": 1, "elements": 1, "allergens": 1, "meal_type": 1, "logged_at": 1, "timestamp": 1}
    ).sort("timestamp", -1).limit(5).to_list(5)
    water_logs = await db.water_logs.find(
        {"user_id": user.user_id, "date": today},
        {"_id": 0, "id": 1, "amount_ml": 1, "logged_at": 1}
    ).to_list(100)
    total_water = sum(log.get("amount_ml", 0) for log in water_logs)
    day_of_week = datetime.now(timezone.utc).strftime("%a").lower()
    routines = await db.routines.find({"user_id": user.user_id, "is_active": True, "days": day_of_week}, {"_id": 0}).to_list(20)
    completions = await db.task_completions.find({"user_id": user.user_id, "date": today}, {"_id": 0, "task_id": 1}).to_list(200)
    completed_task_ids = {c["task_id"] for c in completions}
    for routine in routines:
        for task in routine.get("tasks", []):
            task["completed"] = task.get("id", "") in completed_task_ids

    # Optimized streak calculation — single query instead of N+1
    streak = 0
    streak_summaries = await db.daily_summaries.find(
        {"user_id": user.user_id},
        {"_id": 0, "date": 1, "routines_completed": 1, "routines_total": 1}
    ).sort("date", -1).limit(365).to_list(365)
    current_date = datetime.now(timezone.utc).date()
    summary_map = {s["date"]: s for s in streak_summaries}
    for i in range(365):
        check_date = (current_date - timedelta(days=i)).strftime("%Y-%m-%d")
        s = summary_map.get(check_date)
        if s and s.get("routines_completed", 0) > 0 and s.get("routines_completed") >= s.get("routines_total", 1):
            streak += 1
        elif i > 0:
            break

    insights = await db.insights.find({"user_id": user.user_id, "date": today}, {"_id": 0}).sort("created_at", -1).limit(5).to_list(5)
    calorie_goal = settings.get("daily_calorie_goal", 2000)
    protein_goal = settings.get("daily_protein_goal", 50)
    water_goal = settings.get("daily_water_goal_ml", 2500)
    return {
        "date": today,
        "user": {"name": user.name, "weight_kg": user.weight_kg, "activity_level": user.activity_level},
        "nutrition": {"calories": {"current": summary.get("total_calories", 0), "goal": calorie_goal, "percentage": min(100, round((summary.get("total_calories", 0) / calorie_goal) * 100, 1))}, "protein": {"current": summary.get("total_protein", 0), "goal": protein_goal, "percentage": min(100, round((summary.get("total_protein", 0) / protein_goal) * 100, 1))}, "carbs": {"current": summary.get("total_carbs", 0)}, "fat": {"current": summary.get("total_fat", 0)}, "deficiencies": summary.get("deficiencies", []), "meals_count": summary.get("meals_count", 0), "nutrients": summary.get("nutrients", {})},
        "hydration": {"current_ml": total_water, "goal_ml": water_goal, "percentage": round((total_water / water_goal) * 100, 1) if water_goal > 0 else 0, "logs_count": len(water_logs)},
        "routines": {"completed": summary.get("routines_completed", 0), "total": summary.get("routines_total", 0), "percentage": round((summary.get("routines_completed", 0) / max(summary.get("routines_total", 1), 1)) * 100, 1), "streak_days": streak, "today_routines": routines},
        "elements": summary.get("elements", {}),
        "recent_meals": meals,
        "insights": insights
    }


@router.get("/")
async def root():
    return {"message": "NutriOS - Personal Health Operating System", "version": "4.0.0", "status": "healthy"}
