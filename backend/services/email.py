"""NutriOS — Email service (Resend integration)."""
import asyncio
import uuid
import resend
from datetime import datetime, timezone, timedelta
from config import logger, RESEND_API_KEY, SENDER_EMAIL
from database import db

# Initialize Resend
resend.api_key = RESEND_API_KEY


async def send_cancellation_email(email: str, name: str, plan: str, access_until: str):
    """Send a cancellation confirmation email via Resend."""
    try:
        html = f"""
        <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; max-width: 500px; margin: 0 auto; background: #0a0a1a; color: #fff; border-radius: 16px; overflow: hidden;">
            <div style="padding: 32px; text-align: center; background: linear-gradient(135deg, #1a1a3e, #0a0a1a);">
                <h1 style="color: #ffd93d; margin: 0; font-size: 24px;">NutriOS</h1>
                <p style="color: #888; margin: 8px 0 0;">Subscription Cancellation Confirmation</p>
            </div>
            <div style="padding: 24px;">
                <p style="color: #ccc; line-height: 1.6;">Hi {name or 'there'},</p>
                <p style="color: #ccc; line-height: 1.6;">We're sorry to see you go. Your <strong style="color: #ffd93d;">{plan.title()}</strong> subscription has been cancelled.</p>
                <div style="background: rgba(255,255,255,0.05); border-radius: 12px; padding: 16px; margin: 20px 0; border-left: 3px solid #00d4ff;">
                    <p style="color: #00d4ff; margin: 0 0 4px; font-weight: 600;">Important:</p>
                    <p style="color: #ccc; margin: 0;">You will continue to have full access to NutriOS Pro until <strong style="color: #fff;">{access_until}</strong>.</p>
                </div>
                <p style="color: #ccc; line-height: 1.6;">You can resubscribe anytime from the app to regain Pro features.</p>
                <p style="color: #888; margin-top: 24px; font-size: 13px;">Thank you for being a NutriOS user.</p>
            </div>
        </div>
        """
        params = {"from": SENDER_EMAIL, "to": [email], "subject": "NutriOS \u2014 Subscription Cancellation Confirmation", "html": html}
        result = await asyncio.to_thread(resend.Emails.send, params)
        logger.info(f"Cancellation email sent to {email} via Resend (id: {result.get('id', 'unknown')})")
        await db.email_logs.insert_one({"id": str(uuid.uuid4()), "to": email, "subject": "Subscription Cancellation Confirmation", "type": "cancellation", "resend_id": result.get("id", ""), "created_at": datetime.now(timezone.utc)})
        return True
    except Exception as e:
        logger.error(f"Resend email send error: {e}")
        return False


async def send_welcome_email(email: str, name: str):
    """Send a welcome email to new users after signup."""
    try:
        html = f"""
        <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; max-width: 500px; margin: 0 auto; background: #0a0a1a; color: #fff; border-radius: 16px; overflow: hidden;">
            <div style="padding: 40px 32px; text-align: center; background: linear-gradient(135deg, #0d1a3e, #0a0a1a);">
                <h1 style="color: #00d4ff; margin: 0; font-size: 28px;">Welcome to NutriOS</h1>
                <p style="color: #888; margin: 10px 0 0; font-size: 15px;">Your Nutrition Operating System</p>
            </div>
            <div style="padding: 28px;">
                <p style="color: #ccc; line-height: 1.7; font-size: 15px;">Hi {name or 'there'} \U0001f44b,</p>
                <p style="color: #ccc; line-height: 1.7; font-size: 15px;">Welcome aboard! Start tracking your first meal today!</p>
                <div style="background: rgba(0, 212, 255, 0.08); border-radius: 12px; padding: 16px; margin: 20px 0; border-left: 3px solid #00d4ff;">
                    <p style="color: #00d4ff; margin: 0 0 4px; font-weight: 600;">\U0001f389 Your free trial is active!</p>
                    <p style="color: #ccc; margin: 0; font-size: 14px;">Enjoy full access to all NutriOS features.</p>
                </div>
                <p style="color: #888; margin-top: 28px; font-size: 13px; text-align: center;">Let's make every bite count.<br/>\u2014 The NutriOS Team</p>
            </div>
        </div>
        """
        params = {"from": SENDER_EMAIL, "to": [email], "subject": "Welcome to NutriOS \U0001f9ec \u2014 Let's Get Started!", "html": html}
        result = await asyncio.to_thread(resend.Emails.send, params)
        logger.info(f"Welcome email sent to {email} via Resend (id: {result.get('id', 'unknown')})")
        await db.email_logs.insert_one({"id": str(uuid.uuid4()), "to": email, "subject": "Welcome to NutriOS", "type": "welcome", "resend_id": result.get("id", ""), "created_at": datetime.now(timezone.utc)})
        return True
    except Exception as e:
        logger.error(f"Welcome email send error: {e}")
        return False


async def send_account_deletion_email(email: str, name: str):
    """Send account deletion confirmation email."""
    try:
        html = f"""
        <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; max-width: 500px; margin: 0 auto; background: #0a0a1a; color: #fff; border-radius: 16px; overflow: hidden;">
            <div style="padding: 32px; text-align: center; background: linear-gradient(135deg, #1a1a3e, #0a0a1a);">
                <h1 style="color: #ff6b6b; margin: 0; font-size: 24px;">NutriOS</h1>
                <p style="color: #888; margin: 8px 0 0;">Account Deletion Confirmation</p>
            </div>
            <div style="padding: 28px;">
                <p style="color: #ccc; line-height: 1.7;">Hi {name or 'there'},</p>
                <p style="color: #ccc; line-height: 1.7;">Your NutriOS account and all data have been <strong style="color: #ff6b6b;">permanently deleted</strong>.</p>
                <p style="color: #888; margin-top: 24px; font-size: 13px;">You're always welcome back.<br/>\u2014 The NutriOS Team</p>
            </div>
        </div>
        """
        params = {"from": SENDER_EMAIL, "to": [email], "subject": "NutriOS \u2014 Your Account Has Been Deleted", "html": html}
        result = await asyncio.to_thread(resend.Emails.send, params)
        logger.info(f"Account deletion email sent to {email} via Resend (id: {result.get('id', 'unknown')})")
        await db.email_logs.insert_one({"id": str(uuid.uuid4()), "to": email, "subject": "Account Deletion Confirmation", "type": "account_deletion", "resend_id": result.get("id", ""), "created_at": datetime.now(timezone.utc)})
        return True
    except Exception as e:
        logger.error(f"Account deletion email send error: {e}")
        return False


async def send_subscription_activation_email(email: str, name: str, plan: str):
    """Send subscription activation/payment confirmation email."""
    try:
        plan_label = "Annual" if plan == "annual" else "Monthly"
        html = f"""
        <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; max-width: 500px; margin: 0 auto; background: #0a0a1a; color: #fff; border-radius: 16px; overflow: hidden;">
            <div style="padding: 40px 32px; text-align: center; background: linear-gradient(135deg, #1a1a3e, #0a0a1a);">
                <h1 style="color: #ffd93d; margin: 0; font-size: 24px;">Welcome to NutriOS Pro!</h1>
            </div>
            <div style="padding: 28px;">
                <p style="color: #ccc; line-height: 1.7;">Hi {name or 'there'},</p>
                <p style="color: #ccc; line-height: 1.7;">Your <strong style="color: #ffd93d;">{plan_label}</strong> subscription is now active! \U0001f389</p>
                <p style="color: #ccc; line-height: 1.7;">You can manage your subscription anytime from the app's Settings page.</p>
                <p style="color: #888; margin-top: 24px; font-size: 13px; text-align: center;">Thank you for supporting NutriOS!</p>
            </div>
        </div>
        """
        params = {"from": SENDER_EMAIL, "to": [email], "subject": "NutriOS Pro Activated \U0001f48e \u2014 Payment Confirmation", "html": html}
        result = await asyncio.to_thread(resend.Emails.send, params)
        logger.info(f"Subscription activation email sent to {email} via Resend (id: {result.get('id', 'unknown')})")
        await db.email_logs.insert_one({"id": str(uuid.uuid4()), "to": email, "subject": "Subscription Activation", "type": "subscription_activation", "resend_id": result.get("id", ""), "plan": plan, "created_at": datetime.now(timezone.utc)})
        return True
    except Exception as e:
        logger.error(f"Subscription activation email send error: {e}")
        return False


async def send_streak_milestone_email(email: str, name: str, streak_days: int):
    """Send congratulations email when user hits a streak milestone."""
    try:
        milestones = {7: ("1 Week", "\U0001f525"), 14: ("2 Weeks", "\U0001f3c6"), 30: ("1 Month", "\U0001f31f"), 60: ("2 Months", "\U0001f4ab"), 100: ("100 Days", "\U0001f680")}
        label, emoji = milestones.get(streak_days, (f"{streak_days} Days", "\U0001f525"))
        html = f"""
        <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; max-width: 500px; margin: 0 auto; background: #0a0a1a; color: #fff; border-radius: 16px; overflow: hidden;">
            <div style="padding: 40px 32px; text-align: center; background: linear-gradient(135deg, #1a1a3e, #0a0a1a);">
                <div style="font-size: 56px; margin-bottom: 12px;">{emoji}</div>
                <h1 style="color: #ff6b6b; margin: 0; font-size: 24px;">{label} Streak!</h1>
            </div>
            <div style="padding: 28px;">
                <p style="color: #ccc; line-height: 1.7;">You've been tracking for <strong style="color: #ff6b6b;">{streak_days} consecutive days</strong>!</p>
                <p style="color: #ccc; line-height: 1.7;">Consistency is the key. Keep it up!</p>
                <p style="color: #888; margin-top: 24px; font-size: 13px; text-align: center;">\u2014 The NutriOS Team</p>
            </div>
        </div>
        """
        params = {"from": SENDER_EMAIL, "to": [email], "subject": f"{emoji} {label} Streak on NutriOS!", "html": html}
        result = await asyncio.to_thread(resend.Emails.send, params)
        logger.info(f"Streak milestone email sent to {email} ({streak_days} days) via Resend")
        await db.email_logs.insert_one({"id": str(uuid.uuid4()), "to": email, "subject": f"Streak Milestone: {label}", "type": "streak_milestone", "streak_days": streak_days, "resend_id": result.get("id", ""), "created_at": datetime.now(timezone.utc)})
        return True
    except Exception as e:
        logger.error(f"Streak milestone email send error: {e}")
        return False


async def send_weekly_summary_email(email: str, name: str, stats: dict):
    """Send a weekly nutrition summary email."""
    try:
        meals = stats.get("total_meals", 0)
        calories = stats.get("total_calories", 0)
        protein = stats.get("total_protein", 0)
        water_ml = stats.get("total_water", 0)
        streak = stats.get("streak_days", 0)
        unique_foods = stats.get("unique_foods", 0)
        html = f"""
        <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; max-width: 500px; margin: 0 auto; background: #0a0a1a; color: #fff; border-radius: 16px; overflow: hidden;">
            <div style="padding: 32px; text-align: center; background: linear-gradient(135deg, #1a1a3e, #0a0a1a);">
                <h1 style="color: #00d4ff; margin: 0; font-size: 24px;">Your Weekly Recap</h1>
            </div>
            <div style="padding: 28px;">
                <p style="color: #ccc; line-height: 1.7;">Hi {name or 'there'}, here's your week:</p>
                <p style="color: #ccc;">Meals: {meals} | Calories: {int(calories)} | Protein: {int(protein)}g | Water: {water_ml / 1000:.1f}L</p>
                <p style="color: #ccc;">Streak: {streak} days | Unique foods: {unique_foods}</p>
                <p style="color: #888; margin-top: 24px; font-size: 13px; text-align: center;">See you next week \U0001f4ca<br/>\u2014 The NutriOS Team</p>
            </div>
        </div>
        """
        params = {"from": SENDER_EMAIL, "to": [email], "subject": "\U0001f4ca Your NutriOS Weekly Recap is Here!", "html": html}
        result = await asyncio.to_thread(resend.Emails.send, params)
        logger.info(f"Weekly summary email sent to {email} via Resend")
        await db.email_logs.insert_one({"id": str(uuid.uuid4()), "to": email, "subject": "Weekly Summary", "type": "weekly_summary", "stats": stats, "resend_id": result.get("id", ""), "created_at": datetime.now(timezone.utc)})
        return True
    except Exception as e:
        logger.error(f"Weekly summary email send error: {e}")
        return False


async def send_weekly_summary_emails():
    """Send weekly nutrition summary emails to all active users (runs every Sunday evening)."""
    try:
        now = datetime.now(timezone.utc)
        week_ago = now - timedelta(days=7)
        users = await db.users.find({"email": {"$exists": True}}, {"_id": 0, "user_id": 1, "email": 1, "name": 1}).to_list(1000)
        for user_doc in users:
            try:
                user_id = user_doc["user_id"]
                email = user_doc.get("email", "")
                name = user_doc.get("name", "")
                if not email:
                    continue
                settings = await db.user_settings.find_one({"user_id": user_id})
                if settings and settings.get("weekly_email_enabled") is False:
                    continue
                meals = await db.meals.find({"user_id": user_id, "created_at": {"$gte": week_ago}}).to_list(500)
                total_calories = sum(m.get("nutrients", {}).get("energy_kcal", 0) for m in meals)
                total_protein = sum(m.get("nutrients", {}).get("protein_g", 0) for m in meals)
                water_logs = await db.water_logs.find({"user_id": user_id, "created_at": {"$gte": week_ago}}).to_list(500)
                total_water = sum(w.get("amount_ml", 0) for w in water_logs)
                food_names = set(m.get("food_name", "") for m in meals)
                streak_data = await db.routines.find_one({"user_id": user_id}, sort=[("streak_days", -1)])
                streak_days = streak_data.get("streak_days", 0) if streak_data else 0
                stats = {"total_meals": len(meals), "total_calories": total_calories, "total_protein": total_protein, "total_water": total_water, "streak_days": streak_days, "unique_foods": len(food_names)}
                if len(meals) > 0 or total_water > 0:
                    await send_weekly_summary_email(email, name, stats)
            except Exception as e:
                logger.error(f"Weekly email error for user {user_doc.get('user_id', '?')}: {e}")
    except Exception as e:
        logger.error(f"Weekly summary emails batch error: {e}")


async def check_streak_milestones():
    """Check all users for streak milestones and send congratulations emails."""
    try:
        milestone_days = {7, 14, 30, 60, 100}
        users = await db.users.find({"email": {"$exists": True}}, {"_id": 0, "user_id": 1, "email": 1, "name": 1}).to_list(1000)
        for user_doc in users:
            try:
                user_id = user_doc["user_id"]
                email = user_doc.get("email", "")
                name = user_doc.get("name", "")
                if not email:
                    continue
                streak_days = 0
                check_date = datetime.now(timezone.utc)
                for _ in range(365):
                    date_str = check_date.strftime("%Y-%m-%d")
                    has_meal = await db.meals.find_one({"user_id": user_id, "date": date_str})
                    if has_meal:
                        streak_days += 1
                        check_date -= timedelta(days=1)
                    else:
                        break
                if streak_days in milestone_days:
                    already_sent = await db.email_logs.find_one({"to": email, "type": "streak_milestone", "streak_days": streak_days})
                    if not already_sent:
                        await send_streak_milestone_email(email, name, streak_days)
            except Exception as e:
                logger.error(f"Streak milestone check error for {user_doc.get('user_id', '?')}: {e}")
    except Exception as e:
        logger.error(f"Streak milestone checker batch error: {e}")
