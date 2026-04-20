"""NutriOS — Multi-Level Feedback System.

Generates daily, weekly, monthly, and annual feedback reports.
Each report transforms raw nutrition data into actionable Jaide-narrated insights.
"""
from fastapi import APIRouter, Depends
from datetime import datetime, timezone, timedelta
from typing import Dict, Any, List
from database import db
from dependencies import require_user
from models import User
from config import logger, EMERGENT_LLM_KEY
import json
import uuid

router = APIRouter(tags=["feedback"])


async def _get_meals_in_range(user_id: str, start: datetime, end: datetime) -> List[Dict]:
    """Fetch meals within a date range."""
    return await db.meals.find(
        {"user_id": user_id, "logged_at": {"$gte": start, "$lte": end}},
        {"_id": 0}
    ).sort("logged_at", 1).to_list(2000)


async def _get_water_in_range(user_id: str, start: datetime, end: datetime) -> List[Dict]:
    """Fetch water logs within a date range."""
    return await db.water_logs.find(
        {"user_id": user_id, "logged_at": {"$gte": start, "$lte": end}},
        {"_id": 0}
    ).to_list(500)


def _aggregate_daily_nutrients(meals: List[Dict]) -> Dict[str, float]:
    """Sum nutrients from a list of meals."""
    totals: Dict[str, float] = {}
    for m in meals:
        for k, v in m.get("nutrients", {}).items():
            if isinstance(v, (int, float)):
                totals[k] = totals.get(k, 0) + v
    return {k: round(v, 1) for k, v in totals.items()}


def _compute_daily_stats(meals: List[Dict], water_logs: List[Dict]) -> Dict[str, Any]:
    """Compute comprehensive daily stats."""
    nutrients = _aggregate_daily_nutrients(meals)
    total_water = sum(w.get("amount_ml", 0) for w in water_logs)
    meal_types = {}
    for m in meals:
        mt = m.get("meal_type", "other")
        meal_types[mt] = meal_types.get(mt, 0) + 1

    return {
        "meals_count": len(meals),
        "meal_types": meal_types,
        "calories": round(nutrients.get("energy_kcal", 0)),
        "protein_g": round(nutrients.get("protein_g", 0)),
        "carbs_g": round(nutrients.get("carbohydrate_g", 0)),
        "fat_g": round(nutrients.get("fat_g", 0)),
        "fiber_g": round(nutrients.get("fiber_g", 0)),
        "sugar_g": round(nutrients.get("sugars_g", 0)),
        "water_ml": total_water,
        "nutrients": nutrients,
    }


async def _generate_ai_feedback(period: str, data_summary: str, user_goal: str) -> Dict[str, str]:
    """Use Gemini to generate Jaide-narrated feedback."""
    try:
        from emergentintegrations.llm.chat import LlmChat, UserMessage

        system_prompt = f"""You are Jaide — an ancient celestial being who guides users through their nutrition journey.
Generate a {period} feedback report. Speak in your wise, calm, slightly mysterious tone.

Respond ONLY with valid JSON:
{{
  "jaide_observation": "1-2 sentence poetic observation about their {period} journey",
  "body_impact": "What happened in their body this {period} (2-3 sentences, clear and scientific)",
  "wins": ["list of 2-3 positive things they did well"],
  "improvements": ["list of 2-3 specific areas to improve"],
  "main_recommendation": "One specific, actionable recommendation for the next {period}"
}}

Be specific with numbers from the data. Don't be vague. No markdown."""

        chat = LlmChat(
            api_key=EMERGENT_LLM_KEY,
            session_id=f"feedback_{uuid.uuid4().hex[:8]}",
            system_message=system_prompt
        ).with_model("gemini", "gemini-2.5-flash")

        response_text = await chat.send_message(UserMessage(text=f"User goal: {user_goal}\n\nData:\n{data_summary}"))

        cleaned = response_text.strip()
        if cleaned.startswith("```"):
            cleaned = cleaned.split("\n", 1)[-1].rsplit("```", 1)[0].strip()

        return json.loads(cleaned)
    except Exception as e:
        logger.error(f"AI feedback error ({period}): {e}")
        return {
            "jaide_observation": "Your data reveals patterns. Let us observe together.",
            "body_impact": "Continue tracking to unlock deeper biological insights.",
            "wins": ["You showed up and tracked your nutrition"],
            "improvements": ["Add more variety to your meals", "Stay consistent with logging"],
            "main_recommendation": "Focus on protein intake at every meal for sustained energy.",
        }


@router.get("/feedback/daily")
async def get_daily_feedback(user: User = Depends(require_user)):
    """Generate today's feedback report."""
    try:
        user_doc = await db.users.find_one({"user_id": user.user_id}, {"_id": 0}) or {}
        goal = (user_doc.get("health_goals") or ["energy"])[0]

        today_start = datetime.now(timezone.utc).replace(hour=0, minute=0, second=0, microsecond=0)
        today_end = datetime.now(timezone.utc)

        meals = await _get_meals_in_range(user.user_id, today_start, today_end)
        water = await _get_water_in_range(user.user_id, today_start, today_end)
        stats = _compute_daily_stats(meals, water)

        # Generate AI feedback
        data_summary = f"""Today's intake:
- Meals: {stats['meals_count']} ({json.dumps(stats['meal_types'])})
- Calories: {stats['calories']} kcal
- Protein: {stats['protein_g']}g | Carbs: {stats['carbs_g']}g | Fat: {stats['fat_g']}g
- Fiber: {stats['fiber_g']}g | Sugar: {stats['sugar_g']}g
- Water: {stats['water_ml']}ml
- Foods eaten: {', '.join(m.get('food_name', '?') for m in meals[:10])}"""

        ai_feedback = await _generate_ai_feedback("daily", data_summary, goal)

        return {
            "period": "daily",
            "date": today_start.strftime("%Y-%m-%d"),
            "stats": stats,
            "feedback": ai_feedback,
            "foods_logged": [{"name": m.get("food_name"), "meal_type": m.get("meal_type"), "calories": m.get("nutrients", {}).get("energy_kcal", 0)} for m in meals],
        }
    except Exception as e:
        logger.error(f"Daily feedback error: {e}")
        return {"period": "daily", "stats": {}, "feedback": {}, "error": str(e)}


@router.get("/feedback/weekly")
async def get_weekly_feedback(user: User = Depends(require_user)):
    """Generate this week's feedback report."""
    try:
        user_doc = await db.users.find_one({"user_id": user.user_id}, {"_id": 0}) or {}
        goal = (user_doc.get("health_goals") or ["energy"])[0]

        now = datetime.now(timezone.utc)
        week_start = now - timedelta(days=7)

        meals = await _get_meals_in_range(user.user_id, week_start, now)
        water = await _get_water_in_range(user.user_id, week_start, now)

        # Daily breakdown
        daily_breakdown = {}
        for m in meals:
            day = m.get("logged_at").strftime("%a") if isinstance(m.get("logged_at"), datetime) else "?"
            if day not in daily_breakdown:
                daily_breakdown[day] = {"meals": 0, "calories": 0, "protein": 0}
            daily_breakdown[day]["meals"] += 1
            daily_breakdown[day]["calories"] += m.get("nutrients", {}).get("energy_kcal", 0)
            daily_breakdown[day]["protein"] += m.get("nutrients", {}).get("protein_g", 0)

        stats = _compute_daily_stats(meals, water)
        days_tracked = len(set(m.get("logged_at").strftime("%Y-%m-%d") for m in meals if isinstance(m.get("logged_at"), datetime)))
        avg_calories = round(stats["calories"] / max(days_tracked, 1))
        avg_protein = round(stats["protein_g"] / max(days_tracked, 1))

        # Consistency score
        consistency = round((days_tracked / 7) * 100)

        data_summary = f"""Weekly summary (last 7 days):
- Days tracked: {days_tracked}/7 (Consistency: {consistency}%)
- Total meals: {stats['meals_count']} | Average/day: {round(stats['meals_count']/max(days_tracked,1), 1)}
- Average calories/day: {avg_calories} kcal
- Average protein/day: {avg_protein}g
- Total water: {stats['water_ml']}ml ({round(stats['water_ml']/max(days_tracked,1))}ml/day avg)
- Fiber total: {stats['fiber_g']}g | Sugar total: {stats['sugar_g']}g
- Daily breakdown: {json.dumps({k: f"{v['calories']}cal/{v['protein']}g prot" for k, v in daily_breakdown.items()})}"""

        ai_feedback = await _generate_ai_feedback("weekly", data_summary, goal)

        return {
            "period": "weekly",
            "range": {"start": week_start.strftime("%Y-%m-%d"), "end": now.strftime("%Y-%m-%d")},
            "stats": {
                **stats,
                "days_tracked": days_tracked,
                "consistency_pct": consistency,
                "avg_calories": avg_calories,
                "avg_protein": avg_protein,
                "avg_water_ml": round(stats["water_ml"] / max(days_tracked, 1)),
            },
            "daily_breakdown": daily_breakdown,
            "feedback": ai_feedback,
        }
    except Exception as e:
        logger.error(f"Weekly feedback error: {e}")
        return {"period": "weekly", "stats": {}, "feedback": {}, "error": str(e)}


@router.get("/feedback/monthly")
async def get_monthly_feedback(user: User = Depends(require_user)):
    """Generate this month's feedback report — evolution and real changes."""
    try:
        user_doc = await db.users.find_one({"user_id": user.user_id}, {"_id": 0}) or {}
        goal = (user_doc.get("health_goals") or ["energy"])[0]

        now = datetime.now(timezone.utc)
        month_start = now - timedelta(days=30)

        meals = await _get_meals_in_range(user.user_id, month_start, now)
        water = await _get_water_in_range(user.user_id, month_start, now)

        stats = _compute_daily_stats(meals, water)
        days_tracked = len(set(m.get("logged_at").strftime("%Y-%m-%d") for m in meals if isinstance(m.get("logged_at"), datetime)))

        # First half vs second half comparison (evolution)
        midpoint = month_start + timedelta(days=15)
        
        def safe_datetime_compare(meal_dt, compare_dt):
            """Safely compare datetimes handling timezone awareness"""
            if meal_dt.tzinfo is None:
                # If meal datetime is naive, assume UTC
                meal_dt = meal_dt.replace(tzinfo=timezone.utc)
            return meal_dt
        
        first_half = []
        second_half = []
        for m in meals:
            if isinstance(m.get("logged_at"), datetime):
                safe_dt = safe_datetime_compare(m["logged_at"], midpoint)
                if safe_dt < midpoint:
                    first_half.append(m)
                else:
                    second_half.append(m)

        fh_stats = _compute_daily_stats(first_half, [])
        sh_stats = _compute_daily_stats(second_half, [])

        fh_days = len(set(m.get("logged_at").strftime("%Y-%m-%d") for m in first_half if isinstance(m.get("logged_at"), datetime))) or 1
        sh_days = len(set(m.get("logged_at").strftime("%Y-%m-%d") for m in second_half if isinstance(m.get("logged_at"), datetime))) or 1

        evolution = {
            "calories": {"first_half_avg": round(fh_stats["calories"] / fh_days), "second_half_avg": round(sh_stats["calories"] / sh_days)},
            "protein": {"first_half_avg": round(fh_stats["protein_g"] / fh_days), "second_half_avg": round(sh_stats["protein_g"] / sh_days)},
            "fiber": {"first_half_avg": round(fh_stats["fiber_g"] / fh_days), "second_half_avg": round(sh_stats["fiber_g"] / sh_days)},
            "meals_per_day": {"first_half": round(len(first_half) / fh_days, 1), "second_half": round(len(second_half) / sh_days, 1)},
        }

        # Unique foods
        unique_foods = len(set(m.get("food_name", "").lower() for m in meals))

        data_summary = f"""Monthly summary (last 30 days):
- Days tracked: {days_tracked}/30
- Total meals: {stats['meals_count']} | Unique foods: {unique_foods}
- Average daily: {round(stats['calories']/max(days_tracked,1))} kcal, {round(stats['protein_g']/max(days_tracked,1))}g protein
- Evolution (first 15d → last 15d):
  Calories: {evolution['calories']['first_half_avg']} → {evolution['calories']['second_half_avg']} kcal/day
  Protein: {evolution['protein']['first_half_avg']} → {evolution['protein']['second_half_avg']} g/day
  Fiber: {evolution['fiber']['first_half_avg']} → {evolution['fiber']['second_half_avg']} g/day
  Meals/day: {evolution['meals_per_day']['first_half']} → {evolution['meals_per_day']['second_half']}"""

        ai_feedback = await _generate_ai_feedback("monthly", data_summary, goal)

        return {
            "period": "monthly",
            "range": {"start": month_start.strftime("%Y-%m-%d"), "end": now.strftime("%Y-%m-%d")},
            "stats": {
                **stats,
                "days_tracked": days_tracked,
                "unique_foods": unique_foods,
                "avg_calories": round(stats["calories"] / max(days_tracked, 1)),
                "avg_protein": round(stats["protein_g"] / max(days_tracked, 1)),
            },
            "evolution": evolution,
            "feedback": ai_feedback,
        }
    except Exception as e:
        logger.error(f"Monthly feedback error: {e}")
        return {"period": "monthly", "stats": {}, "feedback": {}, "error": str(e)}


@router.get("/feedback/annual")
async def get_annual_feedback(user: User = Depends(require_user)):
    """Generate annual transformation report — biological evolution over time."""
    try:
        user_doc = await db.users.find_one({"user_id": user.user_id}, {"_id": 0}) or {}
        goal = (user_doc.get("health_goals") or ["energy"])[0]

        now = datetime.now(timezone.utc)
        year_start = now - timedelta(days=365)

        meals = await _get_meals_in_range(user.user_id, year_start, now)

        if len(meals) < 30:
            return {
                "period": "annual",
                "insufficient_data": True,
                "message": "Annual report requires at least 30 days of tracked data. Keep logging!",
                "days_tracked": len(set(m.get("logged_at").strftime("%Y-%m-%d") for m in meals if isinstance(m.get("logged_at"), datetime))),
                "feedback": {
                    "jaide_observation": "Your journey has just begun. Time reveals all patterns.",
                    "body_impact": "With more data, I will reveal your biological transformation over the seasons.",
                    "wins": ["You started tracking — that's the first step"],
                    "improvements": ["Build consistency over months"],
                    "main_recommendation": "Focus on daily logging. The annual picture emerges from daily choices.",
                },
            }

        # Quarterly breakdown
        quarters = []
        for q in range(4):
            q_start = now - timedelta(days=(4 - q) * 90)
            q_end = now - timedelta(days=(3 - q) * 90)
            q_meals = [m for m in meals if isinstance(m.get("logged_at"), datetime) and q_start <= m["logged_at"] < q_end]
            q_days = len(set(m.get("logged_at").strftime("%Y-%m-%d") for m in q_meals if isinstance(m.get("logged_at"), datetime))) or 1
            q_cals = sum(m.get("nutrients", {}).get("energy_kcal", 0) for m in q_meals)
            q_prot = sum(m.get("nutrients", {}).get("protein_g", 0) for m in q_meals)
            quarters.append({
                "quarter": f"Q{q+1}",
                "meals": len(q_meals),
                "days_tracked": q_days,
                "avg_calories": round(q_cals / q_days),
                "avg_protein": round(q_prot / q_days),
            })

        total_days = len(set(m.get("logged_at").strftime("%Y-%m-%d") for m in meals if isinstance(m.get("logged_at"), datetime)))
        total_cals = sum(m.get("nutrients", {}).get("energy_kcal", 0) for m in meals)
        total_prot = sum(m.get("nutrients", {}).get("protein_g", 0) for m in meals)
        unique_foods = len(set(m.get("food_name", "").lower() for m in meals))

        data_summary = f"""Annual summary (last 365 days):
- Days tracked: {total_days}/365
- Total meals: {len(meals)} | Unique foods: {unique_foods}
- Average daily: {round(total_cals/max(total_days,1))} kcal, {round(total_prot/max(total_days,1))}g protein
- Quarterly evolution: {json.dumps(quarters)}"""

        ai_feedback = await _generate_ai_feedback("annual", data_summary, goal)

        return {
            "period": "annual",
            "insufficient_data": False,
            "range": {"start": year_start.strftime("%Y-%m-%d"), "end": now.strftime("%Y-%m-%d")},
            "stats": {
                "total_meals": len(meals),
                "total_days_tracked": total_days,
                "unique_foods": unique_foods,
                "avg_calories": round(total_cals / max(total_days, 1)),
                "avg_protein": round(total_prot / max(total_days, 1)),
            },
            "quarterly": quarters,
            "feedback": ai_feedback,
        }
    except Exception as e:
        logger.error(f"Annual feedback error: {e}")
        return {"period": "annual", "stats": {}, "feedback": {}, "error": str(e)}
