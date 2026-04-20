"""NutriOS — Adaptive Learning & Behavioral Insight System.

Tracks user patterns, learns individual food responses, and identifies behavioral insights.
The system evolves over time: "This food works / doesn't work for YOU."
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

router = APIRouter(tags=["adaptive"])


async def _get_meals_history(user_id: str, days: int = 30) -> List[Dict]:
    """Fetch user's meal history for the specified number of days."""
    cutoff = datetime.now(timezone.utc) - timedelta(days=days)
    return await db.meals.find(
        {"user_id": user_id, "logged_at": {"$gte": cutoff}},
        {"_id": 0}
    ).sort("logged_at", -1).to_list(1000)


def _analyze_timing_patterns(meals: List[Dict]) -> Dict[str, Any]:
    """Analyze when the user eats — consistency, gaps, late eating."""
    if not meals:
        return {"pattern": "insufficient_data", "insights": []}

    # Group meals by hour of day
    hour_distribution = {}
    meal_type_times = {"breakfast": [], "lunch": [], "dinner": [], "snack": []}
    days_with_meals = set()

    for meal in meals:
        logged = meal.get("logged_at")
        if not isinstance(logged, datetime):
            continue
        hour = logged.hour
        hour_distribution[hour] = hour_distribution.get(hour, 0) + 1
        meal_type = meal.get("meal_type", "snack")
        if meal_type in meal_type_times:
            meal_type_times[meal_type].append(hour)
        days_with_meals.add(logged.strftime("%Y-%m-%d"))

    total_days = len(days_with_meals) or 1
    meals_per_day = len(meals) / total_days

    # Detect patterns
    insights = []

    # Late night eating (after 21:00)
    late_meals = sum(v for h, v in hour_distribution.items() if h >= 21)
    if late_meals > len(meals) * 0.2:
        insights.append({
            "type": "late_eating",
            "severity": "medium",
            "icon": "🌙",
            "message": f"You eat late (after 9 PM) {round(late_meals/total_days, 1)}x/day on average",
            "recommendation": "Late eating can disrupt sleep and metabolism. Try to finish dinner by 8 PM.",
        })

    # Breakfast skipping
    breakfast_days = len(set(
        m.get("logged_at").strftime("%Y-%m-%d")
        for m in meals
        if isinstance(m.get("logged_at"), datetime) and m.get("meal_type") == "breakfast"
    ))
    skip_rate = 1 - (breakfast_days / total_days)
    if skip_rate > 0.5:
        insights.append({
            "type": "breakfast_skipping",
            "severity": "high",
            "icon": "⏰",
            "message": f"You skip breakfast {round(skip_rate * 100)}% of the time",
            "recommendation": "Skipping breakfast often leads to overeating later. Even a small protein-rich meal helps stabilize energy.",
        })

    # Meal frequency
    if meals_per_day < 2.5:
        insights.append({
            "type": "low_frequency",
            "severity": "medium",
            "icon": "📉",
            "message": f"Low meal frequency: averaging {round(meals_per_day, 1)} meals/day",
            "recommendation": "Eating too few meals can slow metabolism and trigger overeating. Aim for 3-4 balanced meals.",
        })
    elif meals_per_day > 5:
        insights.append({
            "type": "grazing",
            "severity": "low",
            "icon": "🍿",
            "message": f"High snacking frequency: {round(meals_per_day, 1)} meals/day",
            "recommendation": "Frequent snacking may indicate unstable blood sugar. Consider more satiating meals with protein and fiber.",
        })

    return {
        "meals_per_day": round(meals_per_day, 1),
        "peak_hours": sorted(hour_distribution.items(), key=lambda x: -x[1])[:3],
        "total_days_tracked": total_days,
        "breakfast_skip_rate": round(skip_rate * 100),
        "late_eating_rate": round(late_meals / max(len(meals), 1) * 100),
        "insights": insights,
    }


def _analyze_food_frequency(meals: List[Dict]) -> Dict[str, Any]:
    """Analyze which foods the user eats most/least, variety score."""
    if not meals:
        return {"top_foods": [], "variety_score": 0, "insights": []}

    food_counts: Dict[str, int] = {}
    food_nutrients: Dict[str, Dict] = {}

    for meal in meals:
        name = meal.get("food_name", "Unknown").lower().strip()
        food_counts[name] = food_counts.get(name, 0) + 1
        if name not in food_nutrients:
            food_nutrients[name] = meal.get("nutrients", {})

    # Sort by frequency
    sorted_foods = sorted(food_counts.items(), key=lambda x: -x[1])
    total_days = len(set(
        m.get("logged_at").strftime("%Y-%m-%d")
        for m in meals if isinstance(m.get("logged_at"), datetime)
    )) or 1
    top_foods = [
        {"name": f[0].title(), "count": f[1], "frequency": f"~{round(f[1]/total_days, 1)}x/day"}
        for f in sorted_foods[:10]
    ]

    # Variety score (unique foods / total meals)
    unique_foods = len(food_counts)
    variety_score = min(round((unique_foods / max(len(meals), 1)) * 100), 100)

    insights = []
    if variety_score < 30:
        insights.append({
            "type": "low_variety",
            "severity": "high",
            "icon": "🔄",
            "message": f"Low food variety: only {unique_foods} unique foods in your diet",
            "recommendation": "Low variety limits micronutrient diversity. Try adding one new food per week.",
        })
    elif variety_score > 60:
        insights.append({
            "type": "high_variety",
            "severity": "positive",
            "icon": "🌈",
            "message": f"Great food variety! {unique_foods} unique foods tracked",
            "recommendation": "High variety supports gut microbiome diversity and broad nutrient coverage.",
        })

    # Repetition detection
    if sorted_foods and sorted_foods[0][1] > len(meals) * 0.3:
        most_common = sorted_foods[0]
        insights.append({
            "type": "repetitive_food",
            "severity": "low",
            "icon": "🔁",
            "message": f'You eat "{most_common[0].title()}" very frequently ({most_common[1]} times)',
            "recommendation": "Consider rotating alternatives with similar nutrients to prevent micronutrient gaps.",
        })

    return {
        "top_foods": top_foods,
        "unique_foods": unique_foods,
        "variety_score": variety_score,
        "insights": insights,
    }


def _analyze_nutrient_trends(meals: List[Dict], days: int = 30) -> Dict[str, Any]:
    """Analyze nutrient intake trends over time — improving or declining."""
    if len(meals) < 7:
        return {"trends": [], "insights": []}

    # Split into first half and second half
    half = len(meals) // 2
    first_half = meals[half:]  # older meals (sorted desc, so second part is older)
    second_half = meals[:half]  # recent meals

    def avg_nutrient(meal_list: List[Dict], key: str) -> float:
        vals = [m.get("nutrients", {}).get(key, 0) for m in meal_list]
        return sum(vals) / max(len(vals), 1)

    key_nutrients = ["protein_g", "fiber_g", "iron_mg", "vitamin_c_mg", "calcium_mg", "magnesium_mg", "omega3_total_g"]
    trends = []
    insights = []

    for nutrient in key_nutrients:
        old_avg = avg_nutrient(first_half, nutrient)
        new_avg = avg_nutrient(second_half, nutrient)
        if old_avg == 0 and new_avg == 0:
            continue
        change_pct = ((new_avg - old_avg) / max(old_avg, 0.01)) * 100

        direction = "improving" if change_pct > 15 else "declining" if change_pct < -15 else "stable"
        trends.append({
            "nutrient": nutrient.replace("_", " ").title().replace(" G", " (g)").replace(" Mg", " (mg)"),
            "old_avg": round(old_avg, 1),
            "new_avg": round(new_avg, 1),
            "change_pct": round(change_pct),
            "direction": direction,
        })

        if direction == "declining" and abs(change_pct) > 30:
            insights.append({
                "type": "nutrient_decline",
                "severity": "medium",
                "icon": "📉",
                "message": f'{nutrient.replace("_", " ").title()} intake declining ({round(change_pct)}% over {days} days)',
                "recommendation": f"Your {nutrient.replace('_', ' ')} intake has dropped significantly. Consider adding foods rich in this nutrient.",
            })
        elif direction == "improving" and change_pct > 30:
            insights.append({
                "type": "nutrient_improvement",
                "severity": "positive",
                "icon": "📈",
                "message": f'{nutrient.replace("_", " ").title()} intake improving (+{round(change_pct)}%)',
                "recommendation": "Great progress! Your body is adapting positively to this change.",
            })

    return {"trends": trends, "insights": insights}


async def _generate_behavioral_ai_insights(user_id: str, meals: List[Dict], user_doc: Dict) -> List[Dict]:
    """Use Gemini AI to generate deeper behavioral insights."""
    try:
        from emergentintegrations.llm.chat import LlmChat, UserMessage

        # Build context
        total_meals = len(meals)
        if total_meals < 5:
            return []

        # Calculate key stats
        days_tracked = len(set(
            m.get("logged_at").strftime("%Y-%m-%d")
            for m in meals if isinstance(m.get("logged_at"), datetime)
        ))
        meal_types = {}
        for m in meals:
            mt = m.get("meal_type", "unknown")
            meal_types[mt] = meal_types.get(mt, 0) + 1

        # Check for binge patterns (>3 meals in 2-hour window)
        # Check for emotional eating indicators (high sugar + low protein meals)
        high_sugar_meals = [
            m for m in meals
            if m.get("nutrients", {}).get("sugars_g", 0) > 30
            and m.get("nutrients", {}).get("protein_g", 0) < 10
        ]

        goal = user_doc.get("health_goals", ["energy"])[0] if user_doc.get("health_goals") else "energy"

        system_prompt = """You are NutriOS Behavioral Analyst — you identify hidden eating patterns and psychological triggers.
Respond ONLY with a JSON array of behavioral insights. No markdown, no explanation outside the JSON.

Each insight must have: {"type": "string", "severity": "high|medium|low|positive", "icon": "emoji", "message": "clear observation", "recommendation": "actionable advice"}

Focus on:
- Emotional eating patterns (sugar cravings when stressed/tired)
- Meal skipping → binge cycles
- Inconsistency patterns
- Goal-behavior misalignment
- Positive reinforcement for good patterns

Max 4 insights. Be specific and evidence-based. Don't speculate without data."""

        user_msg = f"""User goal: {goal}
Days tracked: {days_tracked}
Total meals: {total_meals}
Meal distribution: {json.dumps(meal_types)}
High-sugar low-protein meals (emotional eating indicator): {len(high_sugar_meals)} out of {total_meals}
Average meals/day: {round(total_meals / max(days_tracked, 1), 1)}

Recent 10 meals (newest first):
{json.dumps([{"food": m.get("food_name", "?"), "type": m.get("meal_type"), "hour": m.get("logged_at").hour if isinstance(m.get("logged_at"), datetime) else "?", "cals": m.get("nutrients", {}).get("energy_kcal", 0), "protein": m.get("nutrients", {}).get("protein_g", 0), "sugar": m.get("nutrients", {}).get("sugars_g", 0)} for m in meals[:10]])}

Generate behavioral insights."""

        chat = LlmChat(
            api_key=EMERGENT_LLM_KEY,
            session_id=f"behav_{uuid.uuid4().hex[:8]}",
            system_message=system_prompt
        ).with_model("gemini", "gemini-2.5-flash")

        response_text = await chat.send_message(UserMessage(text=user_msg))

        # Clean JSON
        cleaned = response_text.strip()
        if cleaned.startswith("```"):
            cleaned = cleaned.split("\n", 1)[-1].rsplit("```", 1)[0].strip()

        insights = json.loads(cleaned)
        if isinstance(insights, list):
            return insights[:4]
        return []

    except Exception as e:
        logger.error(f"Behavioral AI error: {e}")
        return []


@router.get("/adaptive/patterns")
async def get_adaptive_patterns(user: User = Depends(require_user)):
    """Get comprehensive adaptive learning patterns for the user."""
    try:
        meals = await _get_meals_history(user.user_id, days=30)

        timing = _analyze_timing_patterns(meals)
        frequency = _analyze_food_frequency(meals)
        trends = _analyze_nutrient_trends(meals, days=30)

        # Combine all insights
        all_insights = timing.get("insights", []) + frequency.get("insights", []) + trends.get("insights", [])
        # Sort by severity
        severity_order = {"high": 0, "medium": 1, "low": 2, "positive": 3}
        all_insights.sort(key=lambda x: severity_order.get(x.get("severity", "low"), 2))

        return {
            "timing_patterns": timing,
            "food_frequency": frequency,
            "nutrient_trends": trends,
            "combined_insights": all_insights,
            "data_quality": {
                "total_meals": len(meals),
                "days_tracked": timing.get("total_days_tracked", 0),
                "sufficient_data": len(meals) >= 10,
            },
        }
    except Exception as e:
        logger.error(f"Adaptive patterns error: {e}")
        return {"timing_patterns": {}, "food_frequency": {}, "nutrient_trends": {}, "combined_insights": [], "error": str(e)}


@router.get("/adaptive/behavioral-insights")
async def get_behavioral_insights(user: User = Depends(require_user)):
    """Get AI-powered behavioral insights about eating patterns."""
    try:
        meals = await _get_meals_history(user.user_id, days=30)
        user_doc = await db.users.find_one({"user_id": user.user_id}, {"_id": 0}) or {}

        if len(meals) < 5:
            return {
                "insights": [{
                    "type": "insufficient_data",
                    "severity": "low",
                    "icon": "📊",
                    "message": "Not enough data yet to detect behavioral patterns",
                    "recommendation": "Continue logging meals for at least 5-7 days to unlock behavioral insights.",
                }],
                "data_points": len(meals),
            }

        ai_insights = await _generate_behavioral_ai_insights(user.user_id, meals, user_doc)

        # Add rule-based insights as fallback
        rule_insights = []

        # Check for meal skipping + overeating pattern
        daily_cals: Dict[str, float] = {}
        daily_meals_count: Dict[str, int] = {}
        for m in meals:
            if isinstance(m.get("logged_at"), datetime):
                day = m["logged_at"].strftime("%Y-%m-%d")
                daily_cals[day] = daily_cals.get(day, 0) + m.get("nutrients", {}).get("energy_kcal", 0)
                daily_meals_count[day] = daily_meals_count.get(day, 0) + 1

        # Find days with low meal count but high calories (binge indicator)
        binge_days = [
            d for d, count in daily_meals_count.items()
            if count <= 2 and daily_cals.get(d, 0) > 2000
        ]
        if binge_days and len(binge_days) > 2:
            rule_insights.append({
                "type": "skip_binge_cycle",
                "severity": "high",
                "icon": "🔄",
                "message": f"Detected skip-then-binge pattern on {len(binge_days)} days (few meals but high calories)",
                "recommendation": "This cycle disrupts metabolism. Eating smaller, regular meals prevents overeating later.",
            })

        combined = (ai_insights or []) + rule_insights
        return {
            "insights": combined[:5],
            "data_points": len(meals),
            "analysis_period_days": 30,
        }
    except Exception as e:
        logger.error(f"Behavioral insights error: {e}")
        return {"insights": [], "error": str(e)}


@router.get("/adaptive/food-response")
async def get_food_responses(user: User = Depends(require_user)):
    """Analyze individual food responses — which foods work/don't work for the user."""
    try:
        meals = await _get_meals_history(user.user_id, days=60)
        user_doc = await db.users.find_one({"user_id": user.user_id}, {"_id": 0}) or {}
        goal = (user_doc.get("health_goals") or ["energy"])[0]

        if len(meals) < 10:
            return {"foods": [], "goal": goal, "message": "Need more meal data (10+ meals) to generate food responses"}

        # Group by food and analyze goal-alignment
        food_data: Dict[str, List[Dict]] = {}
        for m in meals:
            name = m.get("food_name", "Unknown").lower().strip()
            if name not in food_data:
                food_data[name] = []
            food_data[name].append(m.get("nutrients", {}))

        # Score foods based on goal alignment
        goal_priorities = {
            "muscle_gain": {"protein_g": 3.0, "leucine_mg": 2.0, "energy_kcal": 1.0},
            "weight_loss": {"protein_g": 2.0, "fiber_g": 2.0, "energy_kcal": -1.5, "sugars_g": -2.0},
            "energy": {"iron_mg": 2.0, "vitamin_b12_mcg": 2.0, "magnesium_mg": 1.5, "carbohydrate_g": 1.0},
            "immune": {"vitamin_c_mg": 2.0, "zinc_mg": 2.0, "vitamin_d_mcg": 1.5, "selenium_mcg": 1.5},
            "brain": {"omega3_dha_mg": 3.0, "omega3_epa_mg": 2.0, "vitamin_b12_mcg": 1.5, "folate_mcg": 1.5},
            "gut_health": {"fiber_g": 3.0, "vitamin_a_mcg": 1.0},
            "longevity": {"fiber_g": 2.0, "vitamin_d_mcg": 2.0, "omega3_total_g": 2.0, "selenium_mcg": 1.5},
        }
        weights = goal_priorities.get(goal, {"protein_g": 1.0, "fiber_g": 1.0})

        food_scores = []
        for food_name, nutrient_list in food_data.items():
            if len(nutrient_list) < 2:
                continue  # Need at least 2 entries for meaningful analysis

            # Average nutrients across all entries
            avg_nutrients = {}
            for nutrients in nutrient_list:
                for k, v in nutrients.items():
                    if isinstance(v, (int, float)):
                        avg_nutrients[k] = avg_nutrients.get(k, 0) + v
            for k in avg_nutrients:
                avg_nutrients[k] /= len(nutrient_list)

            # Calculate goal-alignment score
            score = 0
            for nutrient, weight in weights.items():
                val = avg_nutrients.get(nutrient, 0)
                if val > 0:
                    score += weight * min(val / 10, 5)  # Normalize

            food_scores.append({
                "name": food_name.title(),
                "times_eaten": len(nutrient_list),
                "goal_score": round(score, 1),
                "works_for_you": score > 3,
                "key_nutrients": {k: round(v, 1) for k, v in sorted(avg_nutrients.items(), key=lambda x: -x[1])[:5] if v > 0},
            })

        # Sort by score
        food_scores.sort(key=lambda x: -x["goal_score"])

        works = [f for f in food_scores if f["works_for_you"]][:8]
        doesnt_work = [f for f in food_scores if not f["works_for_you"]][:5]

        return {
            "goal": goal,
            "works_for_you": works,
            "less_optimal": doesnt_work,
            "total_foods_analyzed": len(food_scores),
            "jaide_note": f"Based on your {goal.replace('_', ' ')} goal, I've identified which foods align with your biological needs." if food_scores else "Log more diverse meals to unlock personalized food analysis.",
        }
    except Exception as e:
        logger.error(f"Food response error: {e}")
        return {"foods": [], "error": str(e)}
