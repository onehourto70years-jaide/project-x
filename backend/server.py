"""NutriOS — Thin FastAPI entry point.

All business logic lives in:
  config.py        → env vars, constants
  database.py      → MongoDB connection
  models.py        → Pydantic schemas
  dependencies.py  → auth helpers
  security.py      → rate limiting & input sanitization
  services.py      → USDA, email, push, daily-summary helpers
  routes/           → all API route modules
"""

import os
from fastapi import FastAPI
from starlette.middleware.cors import CORSMiddleware
from slowapi.middleware import SlowAPIMiddleware
from apscheduler.schedulers.asyncio import AsyncIOScheduler

from config import logger
from database import client as mongo_client
from routes import create_api_router
from security import limiter, rate_limit_exceeded_handler, SanitizeMiddleware
from slowapi.errors import RateLimitExceeded
from services import (
    send_scheduled_notifications,
    send_daily_summary_notification,
    send_smart_water_reminders,
    send_smart_meal_reminder,
    send_smart_calorie_check,
    send_smart_routine_reminder,
    send_streak_risk_alerts,
    send_inactivity_reminders,
    send_weekly_summary_emails,
    check_streak_milestones,
)

# ── FastAPI App ──
app = FastAPI(title="NutriOS - Personal Health Operating System")

# ── Bind rate limiter to app state ──
app.state.limiter = limiter
app.add_exception_handler(RateLimitExceeded, rate_limit_exceeded_handler)

# ── Middleware stack (order matters: bottom added first, top executed first) ──
# 1. Sanitize all incoming JSON strings
app.add_middleware(SanitizeMiddleware)
# 2. SlowAPI rate limiting
app.add_middleware(SlowAPIMiddleware)
# 3. CORS — restrict to known origins
ALLOWED_ORIGINS = [
    os.getenv("CORS_ORIGIN", "https://meal-sync-test.preview.emergentagent.com"),
    "http://localhost:3000",
    "http://localhost:8081",
]
app.add_middleware(
    CORSMiddleware,
    allow_credentials=True,
    allow_origins=ALLOWED_ORIGINS,
    allow_methods=["GET", "POST", "PUT", "DELETE", "OPTIONS"],
    allow_headers=["Authorization", "Content-Type"],
)

# ── Mount all API routes ──
app.include_router(create_api_router())

# ── APScheduler Setup ──
scheduler = AsyncIOScheduler(timezone="UTC")

# ── SMART Water Reminders ── (every 2 hours from 8am-8pm UTC — checks actual intake)
for _hour in range(8, 21, 2):
    scheduler.add_job(
        send_smart_water_reminders,
        "cron", hour=_hour, minute=0,
        id=f"smart_water_{_hour}",
        replace_existing=True,
    )

# ── Meal Reminders ── (translated, breakfast/lunch/dinner)
_meal_schedule = [
    (7, 0, "breakfast"),
    (12, 0, "lunch"),
    (18, 0, "dinner"),
]
for _h, _m, _meal_key in _meal_schedule:
    scheduler.add_job(
        send_smart_meal_reminder,
        "cron", hour=_h, minute=_m,
        args=[_meal_key],
        id=f"meal_{_meal_key}",
        replace_existing=True,
    )

# ── Routine Reminders ── (translated)
_routine_schedule = [
    (6, 30, "routine_morning_title", "routine_morning_body"),
    (21, 0, "routine_evening_title", "routine_evening_body"),
]
for _h, _m, _title_key, _body_key in _routine_schedule:
    scheduler.add_job(
        send_scheduled_notifications,
        "cron", hour=_h, minute=_m,
        args=["routine", _title_key, _body_key],
        id=f"routine_{_h}_{_m}",
        replace_existing=True,
    )

# ── Smart Routine Check ── (afternoon check for uncompleted tasks)
scheduler.add_job(
    send_smart_routine_reminder,
    "cron", hour=15, minute=0,
    id="smart_routine_check",
    replace_existing=True,
)

# ── Smart Calorie Check ── (evening intake summary)
scheduler.add_job(
    send_smart_calorie_check,
    "cron", hour=19, minute=30,
    id="smart_calorie_check",
    replace_existing=True,
)

# ── Streak Risk Alerts ── (evening — alert users at risk of breaking their streak)
scheduler.add_job(
    send_streak_risk_alerts,
    "cron", hour=20, minute=30,
    id="streak_risk_alert",
    replace_existing=True,
)

# ── Daily Summary ── (end of day)
scheduler.add_job(
    send_daily_summary_notification,
    "cron", hour=21, minute=30,
    id="daily_summary",
    replace_existing=True,
)

# ── Inactivity Reminders ── (once a day at 10am — nudge inactive users)
scheduler.add_job(
    send_inactivity_reminders,
    "cron", hour=10, minute=0,
    id="inactivity_reminder",
    replace_existing=True,
)

# ── Weekly Summary Email ── (every Sunday at 7pm UTC)
scheduler.add_job(
    send_weekly_summary_emails,
    "cron", day_of_week="sun", hour=19, minute=0,
    id="weekly_summary_email",
    replace_existing=True,
)

# ── Streak Milestone Email Checker ── (daily at 9pm UTC)
scheduler.add_job(
    check_streak_milestones,
    "cron", hour=21, minute=0,
    id="streak_milestone_check",
    replace_existing=True,
)


# ── Lifecycle Events ──
@app.on_event("startup")
async def startup_event():
    scheduler.start()
    logger.info("NutriOS started — smart push notification scheduler active with %d jobs", len(scheduler.get_jobs()))


@app.on_event("shutdown")
async def shutdown_event():
    scheduler.shutdown()
    mongo_client.close()
    logger.info("NutriOS shutdown — scheduler and DB closed")
