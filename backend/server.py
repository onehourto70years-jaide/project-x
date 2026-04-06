"""NutriOS — Thin FastAPI entry point.

All business logic lives in:
  config.py        → env vars, constants
  database.py      → MongoDB connection
  models.py        → Pydantic schemas
  dependencies.py  → auth helpers
  services.py      → USDA, email, push, daily-summary helpers
  routes/           → all API route modules
"""

from fastapi import FastAPI
from starlette.middleware.cors import CORSMiddleware
from apscheduler.schedulers.asyncio import AsyncIOScheduler

from config import logger
from database import client as mongo_client
from routes import create_api_router
from services import send_scheduled_notifications, send_daily_summary_notification

# ── FastAPI App ──
app = FastAPI(title="NutriOS - Personal Health Operating System")

# ── CORS ──
app.add_middleware(
    CORSMiddleware,
    allow_credentials=True,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

# ── Mount all API routes ──
app.include_router(create_api_router())

# ── APScheduler Setup ──
scheduler = AsyncIOScheduler(timezone="UTC")

# Water reminders: every 2 hours from 6am–8pm UTC
for _hour in range(6, 21, 2):
    scheduler.add_job(
        send_scheduled_notifications,
        "cron", hour=_hour, minute=0,
        args=["water", "\U0001f4a7 Stay Hydrated!", "Time to drink water. Your body needs it for optimal nutrient absorption!"],
        id=f"water_reminder_{_hour}",
        replace_existing=True,
    )

# Meal reminders: breakfast 7am, lunch 12pm, dinner 6pm UTC
_meal_reminders = [
    (7, 0, "\U0001f373 Breakfast Time", "Start your day with a nutrient-rich breakfast!"),
    (12, 0, "\U0001f957 Lunch Time", "Don't forget to log your lunch for accurate tracking!"),
    (18, 0, "\U0001f37d\ufe0f Dinner Time", "Plan a balanced dinner to hit your daily goals!"),
]
for _h, _m, _title, _body in _meal_reminders:
    scheduler.add_job(
        send_scheduled_notifications,
        "cron", hour=_h, minute=_m,
        args=["meal", _title, _body],
        id=f"meal_reminder_{_h}",
        replace_existing=True,
    )

# Routine reminders: morning 6:30am, evening 9pm UTC
_routine_reminders = [
    (6, 30, "\U0001f305 Morning Routine", "Time to start your morning routine!"),
    (21, 0, "\U0001f319 Evening Routine", "Wind down with your evening routine."),
]
for _h, _m, _title, _body in _routine_reminders:
    scheduler.add_job(
        send_scheduled_notifications,
        "cron", hour=_h, minute=_m,
        args=["routine", _title, _body],
        id=f"routine_reminder_{_h}_{_m}",
        replace_existing=True,
    )

# Daily insight notification at 8pm UTC
scheduler.add_job(
    send_daily_summary_notification,
    "cron", hour=20, minute=0,
    id="daily_summary",
    replace_existing=True,
)


# ── Lifecycle Events ──
@app.on_event("startup")
async def startup_event():
    scheduler.start()
    logger.info("NutriOS started — push notification scheduler active")


@app.on_event("shutdown")
async def shutdown_event():
    scheduler.shutdown()
    mongo_client.close()
    logger.info("NutriOS shutdown — scheduler and DB closed")
