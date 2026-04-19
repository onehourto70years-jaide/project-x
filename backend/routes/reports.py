"""NutriOS Weekly Report & Data Export."""
from fastapi import APIRouter, Depends
from fastapi.responses import Response
from datetime import datetime, timezone, timedelta
from database import db
from dependencies import require_user
from models import User
from config import logger
import csv
import io
import json

router = APIRouter(tags=["reports"])


def _week_bounds(offset: int = 0):
    """Return (start_date, end_date) for the ISO week shifted by *offset* weeks.
    offset=0 → current week, offset=-1 → last week."""
    now = datetime.now(timezone.utc)
    monday = now - timedelta(days=now.weekday()) + timedelta(weeks=offset)
    monday = monday.replace(hour=0, minute=0, second=0, microsecond=0)
    sunday = monday + timedelta(days=6, hours=23, minutes=59, seconds=59)
    return monday.strftime("%Y-%m-%d"), sunday.strftime("%Y-%m-%d")


async def _aggregate_week(user_id: str, start: str, end: str):
    """Compute nutrition, water, routines and weight averages for a date range."""

    # --- Nutrition (from daily_summaries) ---
    summaries = await db.daily_summaries.find(
        {"user_id": user_id, "date": {"$gte": start, "$lte": end}},
        {"_id": 0}
    ).to_list(7)

    cal_vals = [s.get("total_calories", 0) for s in summaries]
    pro_vals = [s.get("total_protein", 0) for s in summaries]
    carb_vals = [s.get("total_carbs", 0) for s in summaries]
    fat_vals = [s.get("total_fat", 0) for s in summaries]
    days_tracked = len(summaries) or 1

    nutrition = {
        "avg_calories": round(sum(cal_vals) / days_tracked, 1),
        "avg_protein": round(sum(pro_vals) / days_tracked, 1),
        "avg_carbs": round(sum(carb_vals) / days_tracked, 1),
        "avg_fat": round(sum(fat_vals) / days_tracked, 1),
        "total_calories": round(sum(cal_vals), 1),
        "days_tracked": len(summaries),
    }

    # --- Water ---
    water_pipeline = [
        {"$match": {"user_id": user_id, "date": {"$gte": start, "$lte": end}}},
        {"$group": {"_id": "$date", "total_ml": {"$sum": "$amount_ml"}}},
    ]
    water_days = await db.water_logs.aggregate(water_pipeline).to_list(7)
    water_totals = [d["total_ml"] for d in water_days]
    water_days_count = len(water_totals) or 1

    water = {
        "avg_ml": round(sum(water_totals) / water_days_count),
        "total_ml": sum(water_totals),
        "days_tracked": len(water_totals),
    }

    # --- Routines ---
    rtn_completed = sum(s.get("routines_completed", 0) for s in summaries)
    rtn_total = sum(s.get("routines_total", 0) for s in summaries)

    routines = {
        "completed": rtn_completed,
        "total": rtn_total,
        "rate": round((rtn_completed / rtn_total) * 100, 1) if rtn_total > 0 else 0,
    }

    # --- Weight ---
    weight_entries = await db.weight_logs.find(
        {"user_id": user_id, "date": {"$gte": start, "$lte": end}},
        {"_id": 0}
    ).sort("date", 1).to_list(7)
    weights = [e["weight_kg"] for e in weight_entries]

    weight = {
        "avg": round(sum(weights) / len(weights), 1) if weights else None,
        "start": weights[0] if weights else None,
        "end": weights[-1] if weights else None,
        "entries": len(weights),
    }

    # --- Meals count ---
    meals_count = await db.meals.count_documents(
        {"user_id": user_id, "date": {"$gte": start, "$lte": end}}
    )

    return {
        "start": start,
        "end": end,
        "nutrition": nutrition,
        "water": water,
        "routines": routines,
        "weight": weight,
        "meals_count": meals_count,
    }


@router.get("/reports/weekly-comparison")
async def weekly_comparison(user: User = Depends(require_user)):
    """Compare this week's metrics against last week."""
    this_start, this_end = _week_bounds(0)
    last_start, last_end = _week_bounds(-1)

    this_week = await _aggregate_week(user.user_id, this_start, this_end)
    last_week = await _aggregate_week(user.user_id, last_start, last_end)

    def pct_change(current, previous):
        if previous == 0 or previous is None:
            return None
        return round(((current - previous) / abs(previous)) * 100, 1)

    comparisons = {
        "calories": pct_change(this_week["nutrition"]["avg_calories"], last_week["nutrition"]["avg_calories"]),
        "protein": pct_change(this_week["nutrition"]["avg_protein"], last_week["nutrition"]["avg_protein"]),
        "carbs": pct_change(this_week["nutrition"]["avg_carbs"], last_week["nutrition"]["avg_carbs"]),
        "fat": pct_change(this_week["nutrition"]["avg_fat"], last_week["nutrition"]["avg_fat"]),
        "water": pct_change(this_week["water"]["avg_ml"], last_week["water"]["avg_ml"]),
        "routines": pct_change(this_week["routines"]["rate"], last_week["routines"]["rate"]),
    }

    return {
        "this_week": this_week,
        "last_week": last_week,
        "comparisons": comparisons,
    }


@router.get("/reports/export-data")
async def export_data(user: User = Depends(require_user)):
    """Export ALL user data as structured JSON with complete nutrient profiles (GDPR compliant)."""
    now = datetime.now(timezone.utc)
    cutoff = (now - timedelta(days=365)).strftime("%Y-%m-%d")

    meals = await db.meals.find(
        {"user_id": user.user_id, "date": {"$gte": cutoff}},
        {"_id": 0, "user_id": 0}
    ).sort("date", 1).to_list(5000)

    water_pipeline = [
        {"$match": {"user_id": user.user_id, "date": {"$gte": cutoff}}},
        {"$group": {"_id": "$date", "total_ml": {"$sum": "$amount_ml"}, "entries": {"$sum": 1}}},
        {"$sort": {"_id": 1}},
    ]
    water = await db.water_logs.aggregate(water_pipeline).to_list(365)

    weight = await db.weight_logs.find(
        {"user_id": user.user_id, "date": {"$gte": cutoff}},
        {"_id": 0, "user_id": 0}
    ).sort("date", 1).to_list(365)

    summaries = await db.daily_summaries.find(
        {"user_id": user.user_id, "date": {"$gte": cutoff}},
        {"_id": 0, "user_id": 0}
    ).sort("date", 1).to_list(365)

    # Serialise datetimes
    def serialise(obj):
        if isinstance(obj, datetime):
            return obj.isoformat()
        return obj

    for m in meals:
        for k, v in list(m.items()):
            m[k] = serialise(v)
    for w in weight:
        for k, v in list(w.items()):
            w[k] = serialise(v)

    # Build complete nutrient columns list for CSV header
    all_nutrient_keys = set()
    for m in meals:
        if m.get("nutrients"):
            all_nutrient_keys.update(m["nutrients"].keys())
    for s in summaries:
        if s.get("nutrients"):
            all_nutrient_keys.update(s["nutrients"].keys())

    return {
        "meals": meals,
        "water": [{"date": w["_id"], "total_ml": w["total_ml"], "entries": w["entries"]} for w in water],
        "weight": weight,
        "daily_summaries": summaries,
        "nutrient_columns": sorted(list(all_nutrient_keys)),
        "exported_at": now.isoformat(),
        "user_email": user.email,
        "data_period": {"from": cutoff, "to": now.strftime("%Y-%m-%d")},
        "gdpr_notice": "This export contains all personal health data stored by NutriOS. You may request deletion at any time."
    }
