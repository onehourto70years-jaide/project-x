from fastapi import APIRouter, Depends
from typing import Dict, Any
import uuid
from datetime import datetime, timezone, timedelta
from database import db
from dependencies import require_user
from models import User, RoutineCreate
from services import update_daily_summary

router = APIRouter(tags=["routines"])


@router.post("/routines")
async def create_routine(routine: RoutineCreate, user: User = Depends(require_user)):
    routine_doc = {"id": str(uuid.uuid4()), "user_id": user.user_id, **routine.dict(), "is_active": True, "created_at": datetime.now(timezone.utc)}
    await db.routines.insert_one(routine_doc)
    return {"message": "Routine created", "routine_id": routine_doc["id"]}


@router.get("/routines")
async def get_routines(user: User = Depends(require_user)):
    routines = await db.routines.find({"user_id": user.user_id, "is_active": True}, {"_id": 0}).to_list(50)
    return {"routines": routines}


@router.put("/routines/{routine_id}")
async def update_routine(routine_id: str, update_data: Dict[str, Any], user: User = Depends(require_user)):
    await db.routines.update_one({"id": routine_id, "user_id": user.user_id}, {"$set": update_data})
    return {"message": "Routine updated"}


@router.delete("/routines/{routine_id}")
async def delete_routine(routine_id: str, user: User = Depends(require_user)):
    await db.routines.update_one({"id": routine_id, "user_id": user.user_id}, {"$set": {"is_active": False}})
    return {"message": "Routine deleted"}


@router.post("/routines/{routine_id}/tasks/{task_id}/complete")
async def complete_task(routine_id: str, task_id: str, user: User = Depends(require_user)):
    today = datetime.now(timezone.utc).strftime("%Y-%m-%d")
    await db.task_completions.insert_one({"id": str(uuid.uuid4()), "user_id": user.user_id, "routine_id": routine_id, "task_id": task_id, "date": today, "timestamp": datetime.now(timezone.utc)})
    await update_daily_summary(user.user_id, today)
    return {"message": "Task completed"}


@router.get("/routines/today")
async def get_today_routines(user: User = Depends(require_user)):
    today = datetime.now(timezone.utc).strftime("%Y-%m-%d")
    day_of_week = datetime.now(timezone.utc).strftime("%a").lower()
    routines = await db.routines.find({"user_id": user.user_id, "is_active": True, "days": day_of_week}, {"_id": 0}).to_list(20)
    completions = await db.task_completions.find({"user_id": user.user_id, "date": today}, {"_id": 0}).to_list(200)
    completed_task_ids = {c["task_id"] for c in completions}
    for routine in routines:
        for task in routine.get("tasks", []):
            task["completed"] = task.get("id", "") in completed_task_ids
    return {"routines": routines, "date": today}


@router.get("/routines/streak")
async def get_routine_streak(user: User = Depends(require_user)):
    streak = 0
    current_date = datetime.now(timezone.utc).date()
    for i in range(365):
        check_date = (current_date - timedelta(days=i)).strftime("%Y-%m-%d")
        summary = await db.daily_summaries.find_one({"user_id": user.user_id, "date": check_date}, {"_id": 0})
        if summary and summary.get("routines_completed", 0) > 0 and summary.get("routines_completed") >= summary.get("routines_total", 1):
            streak += 1
        elif i > 0:
            break
    return {"streak_days": streak}
