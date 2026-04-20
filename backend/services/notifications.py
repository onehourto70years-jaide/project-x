"""NutriOS — Push notifications, smart reminders, daily summary."""
import asyncio
import random
import httpx
from datetime import datetime, timezone, timedelta
from config import logger, DAILY_RECOMMENDED
from database import db
from notification_i18n import get_notif_string
from nutrition_tips import NUTRITION_TIPS

EXPO_PUSH_URL = "https://exp.host/--/api/v2/push/send"


async def send_expo_push(tokens: list, title: str, body: str, data: dict = None):
    messages = []
    for token in tokens:
        if not token or not token.startswith("ExponentPushToken"):
            continue
        msg = {"to": token, "sound": "default", "title": title, "body": body}
        if data:
            msg["data"] = data
        messages.append(msg)
    if not messages:
        return
    try:
        async with httpx.AsyncClient(timeout=15) as client_http:
            resp = await client_http.post(EXPO_PUSH_URL, json=messages)
            if resp.status_code == 200:
                logger.info(f"Push notifications sent to {len(messages)} device(s)")
            else:
                logger.error(f"Expo push error: {resp.status_code} - {resp.text}")
    except Exception as e:
        logger.error(f"Push notification error: {e}")


async def _get_user_lang(user_id: str) -> str:
    """Get user's preferred language, defaults to 'en'."""
    user_doc = await db.users.find_one({"user_id": user_id}, {"language_preference": 1})
    return (user_doc or {}).get("language_preference", "en")


async def _log_notification(user_id: str, notif_type: str, title: str, body: str):
    """Store notification in history for the user."""
    await db.notification_logs.insert_one({
        "user_id": user_id,
        "type": notif_type,
        "title": title,
        "body": body,
        "sent_at": datetime.now(timezone.utc),
        "read": False,
    })


async def notify_badge_earned(user_id: str, badge_name: str):
    token_doc = await db.push_tokens.find_one({"user_id": user_id}, {"_id": 0})
    if not token_doc or not token_doc.get("push_token"):
        return
    settings = await db.user_settings.find_one({"user_id": user_id}, {"_id": 0}) or {}
    if not settings.get("notifications_enabled", True):
        return
    lang = await _get_user_lang(user_id)
    title = get_notif_string(lang, "badge_title")
    body = get_notif_string(lang, "badge_body", name=badge_name)
    await send_expo_push([token_doc["push_token"]], title, body, {"type": "badge", "screen": "badges"})
    await _log_notification(user_id, "badge", title, body)


async def send_scheduled_notifications(notification_type: str, title_key: str, body_key: str):
    """Send translated push notifications to all users who have the given type enabled."""
    try:
        all_tokens = await db.push_tokens.find({}, {"_id": 0}).to_list(10000)
        if not all_tokens:
            return
        for token_doc in all_tokens:
            user_id = token_doc.get("user_id")
            push_token = token_doc.get("push_token")
            if not push_token:
                continue
            settings = await db.user_settings.find_one({"user_id": user_id}, {"_id": 0}) or {}
            if not settings.get("notifications_enabled", True):
                continue
            if notification_type == "water" and not settings.get("water_reminder_enabled", True):
                continue
            elif notification_type == "meal" and not settings.get("meal_reminder_enabled", True):
                continue
            elif notification_type == "routine" and not settings.get("routine_reminder_enabled", True):
                continue
            lang = await _get_user_lang(user_id)
            title = get_notif_string(lang, title_key)
            body = get_notif_string(lang, body_key)
            await send_expo_push([push_token], title, body, {"type": notification_type})
            await _log_notification(user_id, notification_type, title, body)
    except Exception as e:
        logger.error(f"Scheduled notification error ({notification_type}): {e}")


async def send_ai_coach_reminders():
    """Check and send AI Coach scheduled reminders that are due."""
    try:
        now = datetime.now(timezone.utc)
        due_reminders = await db.scheduled_notifications.find({
            "sent": False,
            "scheduled_at": {"$lte": now}
        }).to_list(100)
        if not due_reminders:
            return
        for reminder in due_reminders:
            user_id = reminder.get("user_id")
            title = reminder.get("title", "\u23f0 Reminder")
            body = reminder.get("body", "Your AI coach reminder")
            token_doc = await db.push_tokens.find_one({"user_id": user_id})
            if token_doc and token_doc.get("push_token"):
                push_token = token_doc["push_token"]
                settings = await db.user_settings.find_one({"user_id": user_id}) or {}
                if settings.get("notifications_enabled", True):
                    await send_expo_push([push_token], title, body, {"type": "ai_reminder", "source": "ai_coach"})
                    await _log_notification(user_id, "ai_reminder", title, body)
            await db.scheduled_notifications.update_one(
                {"_id": reminder["_id"]},
                {"$set": {"sent": True, "sent_at": now}}
            )
            logger.info(f"AI reminder sent to {user_id}: {title}")
    except Exception as e:
        logger.error(f"AI Coach reminder error: {e}")


async def send_smart_water_reminders():
    """Smart water reminder \u2014 checks actual intake before sending."""
    try:
        all_tokens = await db.push_tokens.find({}, {"_id": 0}).to_list(10000)
        today = datetime.now(timezone.utc).strftime("%Y-%m-%d")
        if not all_tokens:
            return
        for token_doc in all_tokens:
            user_id = token_doc.get("user_id")
            push_token = token_doc.get("push_token")
            if not push_token:
                continue
            settings = await db.user_settings.find_one({"user_id": user_id}, {"_id": 0}) or {}
            if not settings.get("notifications_enabled", True) or not settings.get("water_reminder_enabled", True):
                continue
            lang = await _get_user_lang(user_id)
            water_goal = settings.get("daily_water_goal_ml", 2500)
            water_logs = await db.water_logs.find({"user_id": user_id, "date": today}, {"_id": 0}).to_list(100)
            total_water = sum(log.get("amount_ml", 0) for log in water_logs)
            if total_water >= water_goal:
                already_congratulated = await db.notification_logs.find_one({
                    "user_id": user_id, "type": "water_goal_hit",
                    "sent_at": {"$gte": datetime.strptime(today, "%Y-%m-%d").replace(tzinfo=timezone.utc)}
                })
                if not already_congratulated:
                    title = get_notif_string(lang, "water_goal_hit_title")
                    body = get_notif_string(lang, "water_goal_hit_body", goal=water_goal)
                    await send_expo_push([push_token], title, body, {"type": "water", "screen": "(tabs)/water"})
                    await _log_notification(user_id, "water_goal_hit", title, body)
                continue
            pct = round((total_water / water_goal) * 100)
            remaining = water_goal - total_water
            if total_water == 0:
                title = get_notif_string(lang, "water_smart_title")
                body = get_notif_string(lang, "water_smart_body_none")
            elif pct >= 75:
                title = get_notif_string(lang, "water_smart_title")
                body = get_notif_string(lang, "water_smart_body_almost", remaining=remaining)
            else:
                title = get_notif_string(lang, "water_smart_title")
                body = get_notif_string(lang, "water_smart_body_low", amount=total_water, pct=pct)
            await send_expo_push([push_token], title, body, {"type": "water", "screen": "(tabs)/water"})
            await _log_notification(user_id, "water", title, body)
    except Exception as e:
        logger.error(f"Smart water reminder error: {e}")


async def send_smart_meal_reminder(meal_key: str):
    """Send translated meal reminders (breakfast/lunch/dinner)."""
    try:
        all_tokens = await db.push_tokens.find({}, {"_id": 0}).to_list(10000)
        if not all_tokens:
            return
        for token_doc in all_tokens:
            user_id = token_doc.get("user_id")
            push_token = token_doc.get("push_token")
            if not push_token:
                continue
            settings = await db.user_settings.find_one({"user_id": user_id}, {"_id": 0}) or {}
            if not settings.get("notifications_enabled", True) or not settings.get("meal_reminder_enabled", True):
                continue
            lang = await _get_user_lang(user_id)
            title = get_notif_string(lang, f"meal_{meal_key}_title")
            body = get_notif_string(lang, f"meal_{meal_key}_body")
            await send_expo_push([push_token], title, body, {"type": "meal", "screen": "(tabs)/nutrition"})
            await _log_notification(user_id, "meal", title, body)
    except Exception as e:
        logger.error(f"Meal reminder error ({meal_key}): {e}")


async def send_smart_calorie_check():
    """Evening check \u2014 tell users how they're doing on calories for the day."""
    try:
        all_tokens = await db.push_tokens.find({}, {"_id": 0}).to_list(10000)
        today = datetime.now(timezone.utc).strftime("%Y-%m-%d")
        if not all_tokens:
            return
        for token_doc in all_tokens:
            user_id = token_doc.get("user_id")
            push_token = token_doc.get("push_token")
            if not push_token:
                continue
            settings = await db.user_settings.find_one({"user_id": user_id}, {"_id": 0}) or {}
            if not settings.get("notifications_enabled", True) or not settings.get("meal_reminder_enabled", True):
                continue
            lang = await _get_user_lang(user_id)
            calorie_goal = settings.get("daily_calorie_goal", 2000)
            meals = await db.meals.find({"user_id": user_id, "date": today}, {"_id": 0}).to_list(100)
            total_cals = sum(m.get("nutrients", {}).get("energy_kcal", 0) for m in meals)
            if not meals:
                continue
            pct = round((total_cals / calorie_goal) * 100) if calorie_goal > 0 else 0
            if pct < 70:
                msg = get_notif_string(lang, "meal_smart_low")
            elif pct <= 110:
                msg = get_notif_string(lang, "meal_smart_good")
            else:
                msg = get_notif_string(lang, "meal_smart_over")
            title = get_notif_string(lang, "meal_smart_title")
            body = get_notif_string(lang, "meal_smart_body", calories=round(total_cals), pct=pct, msg=msg)
            await send_expo_push([push_token], title, body, {"type": "calorie_check", "screen": "progress"})
            await _log_notification(user_id, "calorie_check", title, body)
    except Exception as e:
        logger.error(f"Smart calorie check error: {e}")


async def send_smart_routine_reminder():
    """Check for uncompleted routine tasks and nudge the user."""
    try:
        all_tokens = await db.push_tokens.find({}, {"_id": 0}).to_list(10000)
        today = datetime.now(timezone.utc).strftime("%Y-%m-%d")
        day_of_week = datetime.now(timezone.utc).strftime("%a").lower()
        if not all_tokens:
            return
        for token_doc in all_tokens:
            user_id = token_doc.get("user_id")
            push_token = token_doc.get("push_token")
            if not push_token:
                continue
            settings = await db.user_settings.find_one({"user_id": user_id}, {"_id": 0}) or {}
            if not settings.get("notifications_enabled", True) or not settings.get("routine_reminder_enabled", True):
                continue
            lang = await _get_user_lang(user_id)
            routines = await db.routines.find({"user_id": user_id, "is_active": True, "days": day_of_week}, {"_id": 0}).to_list(20)
            total_tasks = sum(len(r.get("tasks", [])) for r in routines)
            if total_tasks == 0:
                continue
            completions = await db.task_completions.count_documents({"user_id": user_id, "date": today})
            pending = total_tasks - completions
            if pending <= 0:
                continue
            title = get_notif_string(lang, "routine_smart_title")
            body = get_notif_string(lang, "routine_smart_body", pending=pending)
            await send_expo_push([push_token], title, body, {"type": "routine", "screen": "(tabs)/routines"})
            await _log_notification(user_id, "routine", title, body)
    except Exception as e:
        logger.error(f"Smart routine reminder error: {e}")


async def send_streak_risk_alerts():
    """Alert users whose logging streak is about to break."""
    try:
        all_tokens = await db.push_tokens.find({}, {"_id": 0}).to_list(10000)
        today = datetime.now(timezone.utc).strftime("%Y-%m-%d")
        yesterday = (datetime.now(timezone.utc) - timedelta(days=1)).strftime("%Y-%m-%d")
        if not all_tokens:
            return
        for token_doc in all_tokens:
            user_id = token_doc.get("user_id")
            push_token = token_doc.get("push_token")
            if not push_token:
                continue
            settings = await db.user_settings.find_one({"user_id": user_id}, {"_id": 0}) or {}
            if not settings.get("notifications_enabled", True):
                continue
            yesterday_meals = await db.meals.count_documents({"user_id": user_id, "date": yesterday})
            today_meals = await db.meals.count_documents({"user_id": user_id, "date": today})
            if yesterday_meals > 0 and today_meals == 0:
                streak_days = 0
                check_date = datetime.now(timezone.utc) - timedelta(days=1)
                for _ in range(365):
                    d = check_date.strftime("%Y-%m-%d")
                    c = await db.meals.count_documents({"user_id": user_id, "date": d})
                    if c == 0:
                        break
                    streak_days += 1
                    check_date -= timedelta(days=1)
                if streak_days >= 2:
                    lang = await _get_user_lang(user_id)
                    title = get_notif_string(lang, "streak_risk_title")
                    body = get_notif_string(lang, "streak_risk_body", days=streak_days)
                    await send_expo_push([push_token], title, body, {"type": "streak", "screen": "(tabs)/nutrition"})
                    await _log_notification(user_id, "streak_risk", title, body)
    except Exception as e:
        logger.error(f"Streak risk alert error: {e}")


async def send_inactivity_reminders():
    """Send a nudge to users who haven't been active for 2+ days."""
    try:
        all_tokens = await db.push_tokens.find({}, {"_id": 0}).to_list(10000)
        cutoff = datetime.now(timezone.utc) - timedelta(days=2)
        if not all_tokens:
            return
        for token_doc in all_tokens:
            user_id = token_doc.get("user_id")
            push_token = token_doc.get("push_token")
            if not push_token:
                continue
            settings = await db.user_settings.find_one({"user_id": user_id}, {"_id": 0}) or {}
            if not settings.get("notifications_enabled", True):
                continue
            last_meal = await db.meals.find_one({"user_id": user_id}, sort=[("created_at", -1)])
            last_water = await db.water_logs.find_one({"user_id": user_id}, sort=[("created_at", -1)])
            last_activity = None
            for doc in [last_meal, last_water]:
                if doc and doc.get("created_at"):
                    ts = doc["created_at"] if isinstance(doc["created_at"], datetime) else datetime.fromisoformat(str(doc["created_at"]))
                    if last_activity is None or ts > last_activity:
                        last_activity = ts
            if last_activity and last_activity < cutoff:
                days_inactive = (datetime.now(timezone.utc) - last_activity).days
                recent_inactivity = await db.notification_logs.find_one({
                    "user_id": user_id, "type": "inactivity",
                    "sent_at": {"$gte": cutoff}
                })
                if recent_inactivity:
                    continue
                lang = await _get_user_lang(user_id)
                title = get_notif_string(lang, "inactivity_title")
                body = get_notif_string(lang, "inactivity_body", days=days_inactive)
                await send_expo_push([push_token], title, body, {"type": "inactivity", "screen": "(tabs)"})
                await _log_notification(user_id, "inactivity", title, body)
    except Exception as e:
        logger.error(f"Inactivity reminder error: {e}")


async def send_daily_summary_notification():
    """Send a personalized daily summary push to all users."""
    try:
        all_tokens = await db.push_tokens.find({}, {"_id": 0}).to_list(10000)
        today = datetime.now(timezone.utc).strftime("%Y-%m-%d")
        for token_doc in all_tokens:
            user_id = token_doc.get("user_id")
            push_token = token_doc.get("push_token")
            if not push_token:
                continue
            settings = await db.user_settings.find_one({"user_id": user_id}, {"_id": 0}) or {}
            if not settings.get("notifications_enabled", True):
                continue
            meals_count = await db.meals.count_documents({"user_id": user_id, "date": today})
            if meals_count > 0:
                lang = await _get_user_lang(user_id)
                title = get_notif_string(lang, "summary_title")
                body = get_notif_string(lang, "summary_body", meals=meals_count)
                await send_expo_push([push_token], title, body, {"type": "summary", "screen": "progress"})
                await _log_notification(user_id, "summary", title, body)
    except Exception as e:
        logger.error(f"Daily summary notification error: {e}")


async def update_daily_summary(user_id: str, date: str):
    meals = await db.meals.find({"user_id": user_id, "date": date}, {"_id": 0}).to_list(100)
    total_nutrients, total_elements = {}, {}
    for meal in meals:
        for k, v in meal.get("nutrients", {}).items():
            total_nutrients[k] = total_nutrients.get(k, 0) + v
        for k, v in meal.get("elements", {}).items():
            total_elements[k] = total_elements.get(k, 0) + v
    water_logs = await db.water_logs.find({"user_id": user_id, "date": date}, {"_id": 0}).to_list(100)
    total_water = sum(log["amount_ml"] for log in water_logs)
    from datetime import datetime as dt
    day_of_week = dt.strptime(date, "%Y-%m-%d").strftime("%a").lower()
    routines = await db.routines.find({"user_id": user_id, "is_active": True, "days": day_of_week}, {"_id": 0}).to_list(20)
    completions = await db.task_completions.find({"user_id": user_id, "date": date}, {"_id": 0}).to_list(200)
    total_tasks = sum(len(r.get("tasks", [])) for r in routines)
    deficiencies = [n for n, rec in DAILY_RECOMMENDED.items() if total_nutrients.get(n, 0) < rec * 0.5]
    summary = {"user_id": user_id, "date": date, "total_calories": total_nutrients.get("energy_kcal", 0), "total_protein": total_nutrients.get("protein_g", 0), "total_carbs": total_nutrients.get("carbohydrate_g", 0), "total_fat": total_nutrients.get("fat_g", 0), "total_water_ml": total_water, "meals_count": len(meals), "nutrients": total_nutrients, "elements": total_elements, "deficiencies": deficiencies, "routines_completed": len(completions), "routines_total": total_tasks}
    await db.daily_summaries.update_one({"user_id": user_id, "date": date}, {"$set": summary}, upsert=True)
    return summary


def _pick_contextual_tip(lang: str, recent_meals: list, seen_ids: set) -> dict | None:
    """Pick a tip relevant to the user's recent food intake, avoiding repeats."""
    tips = NUTRITION_TIPS.get(lang, NUTRITION_TIPS["en"])
    unseen = [t for t in tips if t["id"] not in seen_ids]
    if not unseen:
        unseen = tips
    if recent_meals:
        user_cats: set[str] = set()
        for meal in recent_meals:
            for el, val in (meal.get("elements") or {}).items():
                if val and float(val) > 0:
                    user_cats.add(el)
            nutr = meal.get("nutrients") or {}
            if nutr.get("protein_g", 0) > 15:
                user_cats.add("protein")
            if nutr.get("fat_g", 0) > 10:
                user_cats.add("fat")
            if nutr.get("fiber_g", 0) > 3:
                user_cats.add("fiber")
            cooking = (meal.get("cooking_method") or "").lower()
            if cooking and cooking != "raw":
                user_cats.add("cooking")
        contextual = [t for t in unseen if any(c in user_cats for c in t["cat"])]
        if contextual:
            return random.choice(contextual)
    return random.choice(unseen) if unseen else None


async def send_nutrition_tips():
    """Send contextual 'Did You Know?' nutritional tips (non-repeating, i18n)."""
    try:
        all_tokens = await db.push_tokens.find({}, {"_id": 0}).to_list(10000)
        if not all_tokens:
            return
        for token_doc in all_tokens:
            user_id = token_doc.get("user_id")
            push_token = token_doc.get("push_token")
            if not push_token:
                continue
            settings = await db.user_settings.find_one({"user_id": user_id}, {"_id": 0}) or {}
            if not settings.get("notifications_enabled", True):
                continue
            if not settings.get("tips_enabled", True):
                continue
            lang = await _get_user_lang(user_id)
            recent_meals = await db.meals.find(
                {"user_id": user_id},
                sort=[("created_at", -1)]
            ).to_list(5)
            history = await db.user_tip_history.find_one({"user_id": user_id}) or {}
            seen_ids = set(history.get("seen", []))
            tip = _pick_contextual_tip(lang, recent_meals, seen_ids)
            if not tip:
                continue
            await send_expo_push(
                [push_token], tip["title"], tip["body"],
                {"type": "tip", "screen": "(tabs)/ai"},
            )
            await _log_notification(user_id, "tip", tip["title"], tip["body"])
            if tip["id"] not in seen_ids:
                await db.user_tip_history.update_one(
                    {"user_id": user_id},
                    {"$addToSet": {"seen": tip["id"]}},
                    upsert=True,
                )
            else:
                await db.user_tip_history.update_one(
                    {"user_id": user_id},
                    {"$set": {"seen": [tip["id"]]}},
                    upsert=True,
                )
    except Exception as e:
        logger.error(f"Nutrition tip delivery error: {e}")
