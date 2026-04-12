from fastapi import APIRouter, Depends
import uuid
from datetime import datetime, timezone, timedelta
from database import db
from dependencies import require_user
from models import User, MealEntryCreate, WaterLogCreate, FavoriteCreate
from services import update_daily_summary
from security import sanitize, _sanitize_value

router = APIRouter(tags=["meals"])


@router.post("/meals")
async def add_meal(meal: MealEntryCreate, user: User = Depends(require_user)):
    meal_entry = {"id": str(uuid.uuid4()), "user_id": user.user_id, **meal.dict(), "timestamp": datetime.now(timezone.utc), "date": datetime.now(timezone.utc).strftime("%Y-%m-%d")}
    await db.meals.insert_one(meal_entry)
    await update_daily_summary(user.user_id, meal_entry["date"])
    return {"message": "Meal added", "meal_id": meal_entry["id"]}


@router.get("/meals/today")
async def get_today_meals(user: User = Depends(require_user)):
    today = datetime.now(timezone.utc).strftime("%Y-%m-%d")
    meals = await db.meals.find(
        {"user_id": user.user_id, "date": today},
        {"_id": 0, "id": 1, "food_name": 1, "fdc_id": 1, "portion_grams": 1, "cooking_method": 1, "meal_type": 1, "nutrients": 1, "elements": 1, "allergens": 1, "timestamp": 1, "date": 1, "source": 1}
    ).sort("timestamp", 1).to_list(100)
    return {"meals": meals, "date": today}


@router.get("/meals/history")
async def get_meal_history(days: int = 7, user: User = Depends(require_user)):
    start_date = (datetime.now(timezone.utc) - timedelta(days=days)).strftime("%Y-%m-%d")
    meals = await db.meals.find(
        {"user_id": user.user_id, "date": {"$gte": start_date}},
        {"_id": 0, "id": 1, "food_name": 1, "fdc_id": 1, "portion_grams": 1, "cooking_method": 1, "meal_type": 1, "nutrients": 1, "elements": 1, "timestamp": 1, "date": 1}
    ).sort("timestamp", -1).to_list(200)
    return {"meals": meals}


@router.delete("/meals/{meal_id}")
async def delete_meal(meal_id: str, user: User = Depends(require_user)):
    meal = await db.meals.find_one({"id": meal_id, "user_id": user.user_id})
    if meal:
        await db.meals.delete_one({"id": meal_id})
        await update_daily_summary(user.user_id, meal["date"])
    return {"message": "Meal deleted"}


@router.put("/meals/{meal_id}")
async def update_meal(meal_id: str, user: User = Depends(require_user), request_data: dict = {}):
    """Update a logged meal — supports changing portion, meal_type, cooking_method.
    If portion_grams changes, nutrients are recalculated proportionally."""
    request_data = _sanitize_value(request_data)
    meal = await db.meals.find_one({"id": meal_id, "user_id": user.user_id})
    if not meal:
        return {"message": "Meal not found"}

    update_fields = {}
    old_portion = meal.get("portion_grams", 100)

    if "meal_type" in request_data:
        update_fields["meal_type"] = request_data["meal_type"]
    if "cooking_method" in request_data:
        update_fields["cooking_method"] = request_data["cooking_method"]
    if "portion_grams" in request_data:
        new_portion = request_data["portion_grams"]
        update_fields["portion_grams"] = new_portion
        # Recalculate nutrients proportionally
        if old_portion > 0 and new_portion != old_portion:
            ratio = new_portion / old_portion
            old_nutrients = meal.get("nutrients", {})
            new_nutrients = {k: round(v * ratio, 3) for k, v in old_nutrients.items() if isinstance(v, (int, float))}
            update_fields["nutrients"] = new_nutrients
            old_elements = meal.get("elements", {})
            if old_elements:
                new_elements = {k: round(v * ratio, 3) for k, v in old_elements.items() if isinstance(v, (int, float))}
                update_fields["elements"] = new_elements

    if update_fields:
        update_fields["updated_at"] = datetime.now(timezone.utc)
        await db.meals.update_one({"id": meal_id}, {"$set": update_fields})
        await update_daily_summary(user.user_id, meal["date"])

    updated = await db.meals.find_one({"id": meal_id}, {"_id": 0})
    return {"message": "Meal updated", "meal": updated}


# Water tracking
@router.post("/water")
async def add_water(water: WaterLogCreate, user: User = Depends(require_user)):
    log = {"id": str(uuid.uuid4()), "user_id": user.user_id, "amount_ml": water.amount_ml, "timestamp": datetime.now(timezone.utc), "date": datetime.now(timezone.utc).strftime("%Y-%m-%d")}
    await db.water_logs.insert_one(log)
    await update_daily_summary(user.user_id, log["date"])
    return {"message": "Water logged", "log_id": log["id"], "amount_ml": water.amount_ml}


@router.get("/water/today")
async def get_today_water(user: User = Depends(require_user)):
    today = datetime.now(timezone.utc).strftime("%Y-%m-%d")
    logs = await db.water_logs.find(
        {"user_id": user.user_id, "date": today},
        {"_id": 0, "id": 1, "amount_ml": 1, "logged_at": 1, "timestamp": 1}
    ).to_list(100)
    total = sum(log.get("amount_ml", 0) for log in logs)
    settings = await db.user_settings.find_one({"user_id": user.user_id}, {"_id": 0}) or {}
    goal = settings.get("daily_water_goal_ml", 2500)
    return {"logs": logs, "total_ml": total, "goal_ml": goal, "percentage": round((total / goal) * 100, 1) if goal > 0 else 0}


@router.get("/water/history")
async def get_water_history(days: int = 7, user: User = Depends(require_user)):
    start_date = (datetime.now(timezone.utc) - timedelta(days=days)).strftime("%Y-%m-%d")
    pipeline = [{"$match": {"user_id": user.user_id, "date": {"$gte": start_date}}}, {"$group": {"_id": "$date", "total_ml": {"$sum": "$amount_ml"}}}, {"$sort": {"_id": -1}}]
    history = await db.water_logs.aggregate(pipeline).to_list(30)
    return {"history": [{"date": h["_id"], "total_ml": h["total_ml"]} for h in history]}


@router.get("/water/smart-goal")
async def get_smart_water_goal(user: User = Depends(require_user)):
    base_ml = user.weight_kg * 33
    activity_mult = {"sedentary": 0.9, "light": 1.0, "moderate": 1.1, "active": 1.2, "very_active": 1.3}.get(user.activity_level, 1.0)
    return {"recommended_ml": int(base_ml * activity_mult), "weight_kg": user.weight_kg, "activity_level": user.activity_level}


@router.delete("/water/{log_id}")
async def delete_water_log(log_id: str, user: User = Depends(require_user)):
    """Delete a water log entry. Returns the deleted log for potential undo."""
    log = await db.water_logs.find_one({"id": log_id, "user_id": user.user_id}, {"_id": 0})
    if not log:
        from fastapi import HTTPException
        raise HTTPException(status_code=404, detail="Water log not found")
    await db.water_logs.delete_one({"id": log_id, "user_id": user.user_id})
    # Update daily summary for that date
    log_date = log.get("date", datetime.now(timezone.utc).strftime("%Y-%m-%d"))
    await update_daily_summary(user.user_id, log_date)
    return {"message": "Water log deleted", "deleted_log": {"id": log.get("id"), "amount_ml": log.get("amount_ml"), "timestamp": str(log.get("timestamp", "")), "date": log_date}}


# Favorites
@router.post("/favorites")
async def add_favorite(fav: FavoriteCreate, user: User = Depends(require_user)):
    existing = await db.favorites.find_one({"user_id": user.user_id, "fdc_id": fav.fdc_id})
    if existing:
        return {"message": "Already in favorites", "favorite_id": existing.get("id")}
    favorite = {"id": str(uuid.uuid4()), "user_id": user.user_id, **fav.dict(), "created_at": datetime.now(timezone.utc)}
    await db.favorites.insert_one(favorite)
    return {"message": "Added to favorites", "favorite_id": favorite["id"]}


@router.get("/favorites")
async def get_favorites(user: User = Depends(require_user)):
    favorites = await db.favorites.find(
        {"user_id": user.user_id},
        {"_id": 0, "id": 1, "fdc_id": 1, "food_name": 1, "default_portion_grams": 1, "created_at": 1}
    ).sort("created_at", -1).to_list(100)
    return {"favorites": favorites}


@router.delete("/favorites/{fdc_id}")
async def remove_favorite(fdc_id: int, user: User = Depends(require_user)):
    await db.favorites.delete_one({"user_id": user.user_id, "fdc_id": fdc_id})
    return {"message": "Removed from favorites"}


@router.get("/foods/recent")
async def get_recent_foods(limit: int = 20, user: User = Depends(require_user)):
    meals = await db.meals.find({"user_id": user.user_id}, {"_id": 0, "food_name": 1, "fdc_id": 1, "portion_grams": 1, "cooking_method": 1, "timestamp": 1}).sort("timestamp", -1).limit(limit * 3).to_list(limit * 3)
    seen = set()
    unique = []
    for m in meals:
        key = m.get("fdc_id") or m.get("food_name")
        if key not in seen:
            seen.add(key)
            unique.append(m)
        if len(unique) >= limit:
            break
    return {"recent_foods": unique}
