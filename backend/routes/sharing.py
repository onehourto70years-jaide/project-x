from fastapi import APIRouter, Request, Depends, HTTPException
from datetime import datetime, timezone, timedelta
from database import db
from dependencies import require_user
from models import User
from config import BADGE_DEFINITIONS

router = APIRouter(tags=["sharing"])


@router.get("/share/daily-summary")
async def get_shareable_summary(user: User = Depends(require_user)):
    today = datetime.now(timezone.utc).strftime("%Y-%m-%d")
    summary = await db.daily_summaries.find_one({"user_id": user.user_id, "date": today}, {"_id": 0}) or {}
    settings = await db.user_settings.find_one({"user_id": user.user_id}, {"_id": 0}) or {}
    cal_current = summary.get("total_calories", 0)
    cal_goal = settings.get("daily_calorie_goal", 2000)
    protein_current = summary.get("total_protein", 0)
    water_current = summary.get("total_water_ml", 0)
    water_goal = settings.get("daily_water_goal_ml", 2500)
    elements = summary.get("elements", {})
    share_text = f"\U0001f9ec My NutriOS Daily Report - {today}\n\n"
    share_text += f"\U0001f525 Calories: {int(cal_current)}/{cal_goal} kcal\n"
    share_text += f"\U0001f4aa Protein: {int(protein_current)}g\n"
    share_text += f"\U0001f4a7 Water: {water_current}/{water_goal}ml\n\n"
    share_text += "\u269b\ufe0f Elemental Intake:\n"
    for el in ['C', 'H', 'O', 'N']:
        val = elements.get(el, 0)
        share_text += f"  {el}: {val:.1f}g\n"
    share_text += "\n\U0001f4ca Tracked with NutriOS - Your Nutrition Operating System"
    return {"text": share_text, "data": {"date": today, "calories": {"current": cal_current, "goal": cal_goal}, "protein": int(protein_current), "water": {"current": water_current, "goal": water_goal}, "elements": elements}}


@router.post("/share/badge")
async def share_badge(request: Request, user: User = Depends(require_user)):
    body = await request.json()
    badge_id = body.get("badge_id")
    if not badge_id:
        raise HTTPException(status_code=400, detail="badge_id required")
    badge_def = next((b for b in BADGE_DEFINITIONS if b["id"] == badge_id), None)
    if not badge_def:
        raise HTTPException(status_code=404, detail="Badge not found")
    earned = await db.badges.find_one({"user_id": user.user_id, "badge_id": badge_id}, {"_id": 0})
    user_doc = await db.users.find_one({"user_id": user.user_id}, {"_id": 0}) or {}
    name = user_doc.get("name", "Someone")
    if earned:
        share_text = f"\U0001f3c6 {name} earned the '{badge_def['name']}' badge on NutriOS!\n\n\U0001f4dd {badge_def['description']}\n\n\U0001f9ec Track your nutrition at the elemental level with NutriOS!"
    else:
        share_text = f"\U0001f3af {name} is working towards the '{badge_def['name']}' badge on NutriOS!\n\n\U0001f4dd {badge_def['description']}\n\n\U0001f9ec Join me on NutriOS - Your Nutrition Operating System!"
    return {"text": share_text, "badge": badge_def, "earned": bool(earned)}


@router.post("/share/weekly-report")
async def share_weekly_report(user: User = Depends(require_user)):
    today = datetime.now(timezone.utc)
    week_ago = today - timedelta(days=7)
    meals = await db.meals.find({"user_id": user.user_id, "created_at": {"$gte": week_ago}}, {"_id": 0}).to_list(1000)
    water_logs = await db.water_logs.find({"user_id": user.user_id, "created_at": {"$gte": week_ago}}, {"_id": 0}).to_list(1000)
    user_doc = await db.users.find_one({"user_id": user.user_id}, {"_id": 0}) or {}
    name = user_doc.get("name", "User")
    total_meals = len(meals)
    total_calories = sum(m.get("nutrients", {}).get("energy_kcal", 0) for m in meals)
    total_protein = sum(m.get("nutrients", {}).get("protein_g", 0) for m in meals)
    total_water = sum(w.get("amount_ml", 0) for w in water_logs)
    unique_foods = len(set(m.get("food_name", "") for m in meals))
    weekly_elements = {}
    for meal in meals:
        for el, val in meal.get("elements", {}).items():
            weekly_elements[el] = weekly_elements.get(el, 0) + val
    badges_earned = await db.badges.count_documents({"user_id": user.user_id})
    separator = '\u2500' * 30
    share_text = f"\U0001f4ca {name}'s NutriOS Weekly Report\n{separator}\n\n"
    share_text += f"\U0001f37d\ufe0f Meals logged: {total_meals}\n\U0001f525 Calories: {int(total_calories)} kcal\n\U0001f4aa Protein: {int(total_protein)}g\n\U0001f4a7 Water: {total_water}ml ({total_water / 1000:.1f}L)\n\U0001f9ea Unique foods: {unique_foods}\n\U0001f3c6 Badges earned: {badges_earned}\n\n"
    if weekly_elements:
        share_text += "\u269b\ufe0f Elemental Intake:\n"
        for el in ['C', 'H', 'O', 'N', 'S', 'Ca', 'Fe']:
            val = weekly_elements.get(el, 0)
            if val > 0: share_text += f"  {el}: {val:.1f}g\n"
        share_text += "\n"
    share_text += "\U0001f9ec Tracked with NutriOS - Your Nutrition Operating System"
    return {"text": share_text, "data": {"total_meals": total_meals, "total_calories": int(total_calories), "total_protein": int(total_protein), "total_water": total_water, "unique_foods": unique_foods, "badges_earned": badges_earned, "elements": weekly_elements}}
