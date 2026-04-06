from fastapi import APIRouter, Depends
from datetime import datetime, timezone, timedelta
from database import db
from dependencies import require_user
from models import User

router = APIRouter(tags=["progress"])


@router.get("/progress/nutrition")
async def get_nutrition_progress(days: int = 7, user: User = Depends(require_user)):
    start_date = (datetime.now(timezone.utc) - timedelta(days=days)).strftime("%Y-%m-%d")
    summaries = await db.daily_summaries.find({"user_id": user.user_id, "date": {"$gte": start_date}}, {"_id": 0}).sort("date", 1).to_list(days)
    chart_data = [{"date": s["date"], "calories": s.get("total_calories", 0), "protein": s.get("total_protein", 0), "carbs": s.get("total_carbs", 0), "fat": s.get("total_fat", 0)} for s in summaries]
    all_dates = [(datetime.now(timezone.utc) - timedelta(days=days-1-i)).strftime("%Y-%m-%d") for i in range(days)]
    existing_dates = {d["date"] for d in chart_data}
    for date in all_dates:
        if date not in existing_dates:
            chart_data.append({"date": date, "calories": 0, "protein": 0, "carbs": 0, "fat": 0})
    chart_data.sort(key=lambda x: x["date"])
    return {"chart_data": chart_data, "days": days}


@router.get("/progress/water")
async def get_water_progress(days: int = 7, user: User = Depends(require_user)):
    start_date = (datetime.now(timezone.utc) - timedelta(days=days)).strftime("%Y-%m-%d")
    pipeline = [{"$match": {"user_id": user.user_id, "date": {"$gte": start_date}}}, {"$group": {"_id": "$date", "total_ml": {"$sum": "$amount_ml"}}}, {"$sort": {"_id": 1}}]
    data = await db.water_logs.aggregate(pipeline).to_list(days)
    settings = await db.user_settings.find_one({"user_id": user.user_id}, {"_id": 0}) or {}
    goal = settings.get("daily_water_goal_ml", 2500)
    chart_data = [{"date": d["_id"], "amount_ml": d["total_ml"], "goal_ml": goal, "percentage": round((d["total_ml"] / goal) * 100, 1)} for d in data]
    return {"chart_data": chart_data, "goal_ml": goal, "days": days}


@router.get("/progress/routines")
async def get_routines_progress(days: int = 7, user: User = Depends(require_user)):
    start_date = (datetime.now(timezone.utc) - timedelta(days=days)).strftime("%Y-%m-%d")
    summaries = await db.daily_summaries.find({"user_id": user.user_id, "date": {"$gte": start_date}}, {"_id": 0}).sort("date", 1).to_list(days)
    chart_data = []
    for s in summaries:
        completed = s.get("routines_completed", 0)
        total = s.get("routines_total", 0)
        chart_data.append({"date": s["date"], "completed": completed, "total": total, "percentage": round((completed / total) * 100, 1) if total > 0 else 0})
    return {"chart_data": chart_data, "days": days}


@router.get("/progress/elements")
async def get_elements_progress(days: int = 7, user: User = Depends(require_user)):
    start_date = (datetime.now(timezone.utc) - timedelta(days=days)).strftime("%Y-%m-%d")
    summaries = await db.daily_summaries.find({"user_id": user.user_id, "date": {"$gte": start_date}}, {"_id": 0}).sort("date", 1).to_list(days)
    chart_data = []
    for s in summaries:
        elements = s.get("elements", {})
        chart_data.append({"date": s["date"], "C": elements.get("C", 0), "H": elements.get("H", 0), "O": elements.get("O", 0), "N": elements.get("N", 0), "Fe": elements.get("Fe", 0), "Ca": elements.get("Ca", 0), "Mg": elements.get("Mg", 0)})
    return {"chart_data": chart_data, "days": days}
