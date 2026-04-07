from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from typing import Optional
from datetime import datetime, timezone, timedelta
from database import db
from dependencies import require_user
from models import User
from config import logger
import uuid

router = APIRouter(tags=["weight"])


class WeightEntry(BaseModel):
    weight_kg: float
    note: Optional[str] = None


@router.post("/weight")
async def log_weight(entry: WeightEntry, user: User = Depends(require_user)):
    """Log a new weight entry for the user."""
    if entry.weight_kg < 20 or entry.weight_kg > 400:
        raise HTTPException(status_code=400, detail="Weight must be between 20 and 400 kg")

    today_str = datetime.now(timezone.utc).strftime("%Y-%m-%d")

    # Upsert — only 1 entry per day
    existing = await db.weight_logs.find_one({"user_id": user.user_id, "date": today_str})
    if existing:
        await db.weight_logs.update_one(
            {"user_id": user.user_id, "date": today_str},
            {"$set": {"weight_kg": entry.weight_kg, "note": entry.note, "updated_at": datetime.now(timezone.utc)}}
        )
        logger.info(f"Weight updated for {user.user_id}: {entry.weight_kg}kg")
    else:
        await db.weight_logs.insert_one({
            "id": str(uuid.uuid4()),
            "user_id": user.user_id,
            "weight_kg": entry.weight_kg,
            "note": entry.note,
            "date": today_str,
            "created_at": datetime.now(timezone.utc),
        })
        logger.info(f"Weight logged for {user.user_id}: {entry.weight_kg}kg")

    # Also update the user profile
    await db.users.update_one({"user_id": user.user_id}, {"$set": {"weight_kg": entry.weight_kg}})

    return {"message": "Weight logged", "weight_kg": entry.weight_kg, "date": today_str}


@router.get("/weight/today")
async def get_today_weight(user: User = Depends(require_user)):
    """Get today's weight entry."""
    today_str = datetime.now(timezone.utc).strftime("%Y-%m-%d")
    entry = await db.weight_logs.find_one({"user_id": user.user_id, "date": today_str}, {"_id": 0})
    user_doc = await db.users.find_one({"user_id": user.user_id}, {"_id": 0, "weight_kg": 1})
    return {
        "today": entry,
        "current_weight": user_doc.get("weight_kg", 70) if user_doc else 70,
    }


@router.get("/weight/history")
async def get_weight_history(days: int = 30, user: User = Depends(require_user)):
    """Get weight history for the past N days."""
    days = min(days, 365)
    cutoff = datetime.now(timezone.utc) - timedelta(days=days)
    cutoff_str = cutoff.strftime("%Y-%m-%d")

    entries = await db.weight_logs.find(
        {"user_id": user.user_id, "date": {"$gte": cutoff_str}},
        {"_id": 0}
    ).sort("date", 1).to_list(365)

    # Compute stats
    if entries:
        weights = [e["weight_kg"] for e in entries]
        first_weight = weights[0]
        current_weight = weights[-1]
        change = current_weight - first_weight
        min_weight = min(weights)
        max_weight = max(weights)
        avg_weight = sum(weights) / len(weights)
    else:
        user_doc = await db.users.find_one({"user_id": user.user_id}, {"_id": 0, "weight_kg": 1})
        current_weight = user_doc.get("weight_kg", 70) if user_doc else 70
        first_weight = current_weight
        change = 0
        min_weight = current_weight
        max_weight = current_weight
        avg_weight = current_weight

    return {
        "entries": entries,
        "stats": {
            "current": round(current_weight, 1),
            "first": round(first_weight, 1),
            "change": round(change, 1),
            "min": round(min_weight, 1),
            "max": round(max_weight, 1),
            "avg": round(avg_weight, 1),
            "total_entries": len(entries),
        }
    }


@router.delete("/weight/{date}")
async def delete_weight_entry(date: str, user: User = Depends(require_user)):
    """Delete a specific weight entry by date."""
    result = await db.weight_logs.delete_one({"user_id": user.user_id, "date": date})
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Weight entry not found")
    return {"message": "Weight entry deleted", "date": date}
