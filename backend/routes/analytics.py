"""NutriOS Celebration Analytics — tracks celebration events for retention optimization."""
from fastapi import APIRouter, Depends
from datetime import datetime, timezone
from database import db
from dependencies import require_user
from models import User
import logging

logger = logging.getLogger("nutrios.analytics")
router = APIRouter(tags=["analytics"])


@router.post("/analytics/celebration")
async def track_celebration(data: dict, user: User = Depends(require_user)):
    """Track a celebration event for analytics."""
    event = {
        "user_id": user.user_id,
        "badge_id": data.get("badge_id", ""),
        "badge_name": data.get("badge_name", ""),
        "action": data.get("action", "viewed"),  # viewed | continued | shared | skipped
        "celebration_duration_ms": data.get("duration_ms", 0),
        "timestamp": datetime.now(timezone.utc).isoformat(),
    }
    await db.celebration_analytics.insert_one(event)
    logger.info(f"Celebration event: {event['action']} for badge {event['badge_id']} by {user.user_id}")
    return {"status": "tracked"}


@router.get("/analytics/celebrations/summary")
async def celebration_summary(user: User = Depends(require_user)):
    """Get celebration analytics summary for a user."""
    total = await db.celebration_analytics.count_documents({"user_id": user.user_id})
    shared = await db.celebration_analytics.count_documents({"user_id": user.user_id, "action": "shared"})
    continued = await db.celebration_analytics.count_documents({"user_id": user.user_id, "action": "continued"})
    skipped = await db.celebration_analytics.count_documents({"user_id": user.user_id, "action": "skipped"})
    return {
        "total_celebrations": total,
        "share_count": shared,
        "continue_count": continued,
        "skip_count": skipped,
        "share_rate": round(shared / max(total, 1) * 100, 1),
        "continue_rate": round(continued / max(total, 1) * 100, 1),
    }
