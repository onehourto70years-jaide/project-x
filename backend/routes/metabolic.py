"""NutriOS — Metabolic Profile Engine.

Computes BMR (Mifflin-St Jeor), TDEE, macro targets, and dynamic metabolic profile labels.
"""
from fastapi import APIRouter, Depends
from datetime import datetime, timezone, timedelta
from typing import Dict, Any, List, Optional
from database import db
from dependencies import require_user
from models import User
from config import logger

router = APIRouter(tags=["metabolic"])

# ── Activity multipliers for TDEE ──
ACTIVITY_MULTIPLIERS = {
    "sedentary": 1.2,
    "light": 1.375,
    "moderate": 1.55,
    "active": 1.725,
    "very_active": 1.9,
}

# ── Goal-based calorie adjustments and macro splits ──
GOAL_PROFILES = {
    "muscle_gain": {
        "calorie_adj": 300,  # surplus
        "protein_pct": 0.30,
        "carbs_pct": 0.45,
        "fat_pct": 0.25,
        "priority_nutrients": ["protein_g", "leucine_mg", "creatine_mg", "zinc_mg", "iron_mg", "vitamin_d_mcg"],
        "label_pool": ["Lean Muscle Builder", "Anabolic Optimizer", "Strength Architect"],
    },
    "weight_loss": {
        "calorie_adj": -500,  # deficit
        "protein_pct": 0.35,
        "carbs_pct": 0.35,
        "fat_pct": 0.30,
        "priority_nutrients": ["protein_g", "fiber_g", "chromium_mcg", "calcium_mg", "vitamin_b12_mcg"],
        "label_pool": ["Fat Loss Optimizer", "Metabolic Shifter", "Lean Converter"],
    },
    "energy": {
        "calorie_adj": 0,
        "protein_pct": 0.25,
        "carbs_pct": 0.50,
        "fat_pct": 0.25,
        "priority_nutrients": ["iron_mg", "vitamin_b12_mcg", "magnesium_mg", "coenzyme_q10_mg", "carbohydrate_g"],
        "label_pool": ["Energy Stabilizer", "Vitality Optimizer", "Power Sustainer"],
    },
    "immune": {
        "calorie_adj": 0,
        "protein_pct": 0.25,
        "carbs_pct": 0.45,
        "fat_pct": 0.30,
        "priority_nutrients": ["vitamin_c_mg", "zinc_mg", "vitamin_d_mcg", "selenium_mcg", "vitamin_a_mcg"],
        "label_pool": ["Immune Fortifier", "Defense Architect", "Shield Optimizer"],
    },
    "brain": {
        "calorie_adj": 0,
        "protein_pct": 0.25,
        "carbs_pct": 0.40,
        "fat_pct": 0.35,
        "priority_nutrients": ["omega3_dha_mg", "omega3_epa_mg", "vitamin_b12_mcg", "folate_mcg", "magnesium_mg", "choline_mg"],
        "label_pool": ["Cognitive Optimizer", "Neuro Sustainer", "Brain Architect"],
    },
    "gut_health": {
        "calorie_adj": 0,
        "protein_pct": 0.25,
        "carbs_pct": 0.45,
        "fat_pct": 0.30,
        "priority_nutrients": ["fiber_g", "vitamin_a_mcg", "zinc_mg", "glutamine_mg", "probiotics"],
        "label_pool": ["Gut Harmonizer", "Microbiome Architect", "Digestive Optimizer"],
    },
    "longevity": {
        "calorie_adj": -100,
        "protein_pct": 0.25,
        "carbs_pct": 0.45,
        "fat_pct": 0.30,
        "priority_nutrients": ["vitamin_d_mcg", "omega3_dha_mg", "selenium_mcg", "vitamin_e_mg", "resveratrol_mg", "quercetin_mg"],
        "label_pool": ["Longevity Optimizer", "Cellular Guardian", "Age Defier"],
    },
}

DEFAULT_GOAL = {
    "calorie_adj": 0,
    "protein_pct": 0.25,
    "carbs_pct": 0.45,
    "fat_pct": 0.30,
    "priority_nutrients": [],
    "label_pool": ["Balanced Optimizer", "Wellness Maintainer"],
}


def calculate_bmr(weight_kg: float, height_cm: float, age: int, sex: str) -> float:
    """Mifflin-St Jeor BMR formula.
    Male:   (10 × weight_kg) + (6.25 × height_cm) - (5 × age) + 5
    Female: (10 × weight_kg) + (6.25 × height_cm) - (5 × age) - 161
    """
    base = (10 * weight_kg) + (6.25 * height_cm) - (5 * age)
    if sex == "female":
        return round(base - 161, 1)
    return round(base + 5, 1)  # male or default


def calculate_tdee(bmr: float, activity_level: str) -> float:
    """TDEE = BMR × Activity Multiplier."""
    multiplier = ACTIVITY_MULTIPLIERS.get(activity_level, 1.55)
    return round(bmr * multiplier, 1)


def calculate_macro_targets(tdee: float, goal: str) -> Dict[str, Any]:
    """Calculate daily macro targets based on TDEE and goal."""
    profile = GOAL_PROFILES.get(goal, DEFAULT_GOAL)
    target_calories = round(tdee + profile["calorie_adj"])

    protein_cals = target_calories * profile["protein_pct"]
    carbs_cals = target_calories * profile["carbs_pct"]
    fat_cals = target_calories * profile["fat_pct"]

    return {
        "calories": target_calories,
        "calorie_adjustment": profile["calorie_adj"],
        "protein_g": round(protein_cals / 4),     # 4 kcal per gram
        "protein_pct": round(profile["protein_pct"] * 100),
        "carbs_g": round(carbs_cals / 4),          # 4 kcal per gram
        "carbs_pct": round(profile["carbs_pct"] * 100),
        "fat_g": round(fat_cals / 9),              # 9 kcal per gram
        "fat_pct": round(profile["fat_pct"] * 100),
        "priority_nutrients": profile["priority_nutrients"],
    }


def determine_metabolic_label(
    user_data: Dict, meals_summary: Dict, goal: str
) -> Dict[str, str]:
    """Generate a dynamic metabolic profile label based on user data and behavior."""
    profile = GOAL_PROFILES.get(goal, DEFAULT_GOAL)
    labels = profile["label_pool"]

    # Analyze patterns to pick the most fitting label
    avg_protein = meals_summary.get("avg_protein", 0)
    avg_calories = meals_summary.get("avg_calories", 0)
    weight = user_data.get("weight_kg", 70)
    consistency = meals_summary.get("days_logged", 0)

    # Primary label from goal
    primary_label = labels[0] if labels else "Balanced Optimizer"

    # Secondary qualifiers based on behavior
    qualifiers = []

    # Protein sufficiency check
    protein_per_kg = avg_protein / weight if weight > 0 else 0
    if protein_per_kg >= 1.6:
        qualifiers.append("High Protein Adapted")
    elif protein_per_kg < 0.8:
        qualifiers.append("Low Protein Intake")

    # Consistency check
    if consistency >= 5:
        qualifiers.append("Consistent Tracker")
    elif consistency <= 1:
        qualifiers.append("Getting Started")

    # Caloric pattern
    tdee = user_data.get("tdee", 2000)
    if avg_calories > 0:
        cal_ratio = avg_calories / tdee
        if cal_ratio > 1.15:
            qualifiers.append("Surplus Pattern")
        elif cal_ratio < 0.80:
            qualifiers.append("Deficit Pattern")
        else:
            qualifiers.append("Balanced Intake")

    return {
        "primary": primary_label,
        "qualifiers": qualifiers,
        "evolution_note": _get_evolution_note(consistency, qualifiers),
    }


def _get_evolution_note(consistency: int, qualifiers: List[str]) -> str:
    """Generate an evolution note based on the user's journey."""
    if consistency >= 14:
        return "Your metabolic identity is stabilizing. Patterns are becoming clearer."
    elif consistency >= 7:
        return "Your profile is evolving. More data will sharpen your metabolic identity."
    elif consistency >= 3:
        return "Early patterns detected. Continue tracking to unlock deeper insights."
    return "Your journey begins. Every meal logged reveals more about your biology."


def calculate_hydration_need(weight_kg: float, activity_level: str, sleep_hours: float = 7) -> Dict[str, Any]:
    """Dynamic hydration calculation based on weight, activity, and sleep."""
    # Base: 35ml per kg of body weight
    base_ml = weight_kg * 35

    # Activity adjustment
    activity_adj = {
        "sedentary": 0,
        "light": 200,
        "moderate": 400,
        "active": 600,
        "very_active": 800,
    }
    base_ml += activity_adj.get(activity_level, 300)

    # Sleep deficit adjustment (less sleep = more water needed)
    if sleep_hours < 6:
        base_ml += 300
    elif sleep_hours < 7:
        base_ml += 150

    return {
        "daily_target_ml": round(base_ml),
        "base_ml": round(weight_kg * 35),
        "activity_bonus_ml": activity_adj.get(activity_level, 300),
        "sleep_adj_ml": 300 if sleep_hours < 6 else (150 if sleep_hours < 7 else 0),
    }


@router.get("/metabolic/profile")
async def get_metabolic_profile(user: User = Depends(require_user)):
    """Return complete metabolic profile: BMR, TDEE, macro targets, metabolic label."""
    try:
        # Fetch full user document
        user_doc = await db.users.find_one({"user_id": user.user_id}, {"_id": 0}) or {}

        weight_kg = user_doc.get("weight_kg", 70)
        height_cm = user_doc.get("height_cm", 170)
        age = user_doc.get("age", 30)
        sex = user_doc.get("sex", "male")
        activity_level = user_doc.get("activity_level", "moderate")
        health_goals = user_doc.get("health_goals", [])
        sleep_hours = user_doc.get("sleep_hours", 7)
        diet_type = user_doc.get("diet_type", "standard")
        primary_goal = health_goals[0] if health_goals else "energy"

        # Core calculations
        bmr = calculate_bmr(weight_kg, height_cm, age, sex)
        tdee = calculate_tdee(bmr, activity_level)
        macros = calculate_macro_targets(tdee, primary_goal)
        hydration = calculate_hydration_need(weight_kg, activity_level, sleep_hours)

        # Get recent meal averages for metabolic label
        today = datetime.now(timezone.utc)
        seven_days_ago = today - timedelta(days=7)
        recent_meals = await db.meals.find({
            "user_id": user.user_id,
            "logged_at": {"$gte": seven_days_ago}
        }).to_list(500)

        # Calculate averages
        days_with_meals = len(set(
            m.get("date", m.get("logged_at", today).strftime("%Y-%m-%d") if isinstance(m.get("logged_at"), datetime) else "")
            for m in recent_meals
        ))
        total_calories = sum(m.get("nutrients", {}).get("energy_kcal", 0) for m in recent_meals)
        total_protein = sum(m.get("nutrients", {}).get("protein_g", 0) for m in recent_meals)

        meals_summary = {
            "avg_calories": round(total_calories / max(days_with_meals, 1)),
            "avg_protein": round(total_protein / max(days_with_meals, 1)),
            "days_logged": days_with_meals,
            "total_meals": len(recent_meals),
        }

        # Generate metabolic label
        user_data = {"weight_kg": weight_kg, "tdee": tdee}
        metabolic_label = determine_metabolic_label(user_data, meals_summary, primary_goal)

        # Build response
        return {
            "user_profile": {
                "weight_kg": weight_kg,
                "height_cm": height_cm,
                "age": age,
                "sex": sex,
                "activity_level": activity_level,
                "sleep_hours": sleep_hours,
                "diet_type": diet_type,
                "health_goals": health_goals,
                "primary_goal": primary_goal,
            },
            "bmr": bmr,
            "tdee": tdee,
            "macros": macros,
            "hydration": hydration,
            "metabolic_identity": metabolic_label,
            "meals_summary_7d": meals_summary,
            "formula": "Mifflin-St Jeor",
            "last_updated": today.isoformat(),
        }
    except Exception as e:
        logger.error(f"Metabolic profile error: {e}")
        return {
            "bmr": 1500,
            "tdee": 2000,
            "macros": {"calories": 2000, "protein_g": 125, "protein_pct": 25, "carbs_g": 225, "carbs_pct": 45, "fat_g": 67, "fat_pct": 30, "calorie_adjustment": 0, "priority_nutrients": []},
            "hydration": {"daily_target_ml": 2500, "base_ml": 2450, "activity_bonus_ml": 300, "sleep_adj_ml": 0},
            "metabolic_identity": {"primary": "Balanced Optimizer", "qualifiers": [], "evolution_note": "Getting started..."},
            "formula": "Mifflin-St Jeor",
            "error": str(e),
        }
