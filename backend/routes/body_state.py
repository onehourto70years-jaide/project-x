"""NutriOS — Body State Interpretation Engine + Decision Engine + Nutrient Synergies/Conflicts.

Transforms raw nutrition data into real-time body state predictions and actionable decisions.
"""
from fastapi import APIRouter, Depends
from datetime import datetime, timezone, timedelta
from typing import Dict, Any, List
from database import db
from dependencies import require_user
from models import User
from config import logger, EMERGENT_LLM_KEY, DAILY_RECOMMENDED
import json
import uuid

router = APIRouter(tags=["body-state"])

# ── Nutrient Synergies Knowledge Base ──
NUTRIENT_SYNERGIES = [
    {
        "id": "vitc_iron",
        "nutrients": ["vitamin_c_mg", "iron_mg"],
        "effect": "↑ Iron absorption +300%",
        "explanation": "Vitamin C converts non-heme iron to a more absorbable form (Fe³⁺ → Fe²⁺)",
        "icon": "🔗",
        "color": "#4ecdc4",
        "food_example": "Spinach + Lemon juice",
    },
    {
        "id": "vitd_calcium",
        "nutrients": ["vitamin_d_mcg", "calcium_mg"],
        "effect": "↑ Calcium absorption +40%",
        "explanation": "Vitamin D activates calcium transport proteins in the intestine",
        "icon": "🦴",
        "color": "#ffd93d",
        "food_example": "Salmon + Broccoli",
    },
    {
        "id": "fat_carotenoids",
        "nutrients": ["fat_g", "beta_carotene_mcg"],
        "effect": "↑ Carotenoid absorption +500%",
        "explanation": "Fat-soluble carotenoids require dietary fat for absorption",
        "icon": "🥕",
        "color": "#ff6b6b",
        "food_example": "Carrots + Olive oil",
    },
    {
        "id": "vitc_vite",
        "nutrients": ["vitamin_c_mg", "vitamin_e_mg"],
        "effect": "↑ Antioxidant regeneration",
        "explanation": "Vitamin C regenerates oxidized Vitamin E, extending its antioxidant capacity",
        "icon": "🛡️",
        "color": "#a29bfe",
        "food_example": "Kiwi + Almonds",
    },
    {
        "id": "b6_b12_folate",
        "nutrients": ["vitamin_b6_mg", "vitamin_b12_mcg", "folate_mcg"],
        "effect": "↓ Homocysteine levels",
        "explanation": "B6, B12, and Folate work together to metabolize homocysteine, reducing cardiovascular risk",
        "icon": "❤️",
        "color": "#fd79a8",
        "food_example": "Chicken + Leafy greens + Eggs",
    },
    {
        "id": "zinc_b6",
        "nutrients": ["zinc_mg", "vitamin_b6_mg"],
        "effect": "↑ Immune function",
        "explanation": "Zinc and B6 synergize for T-cell production and immune regulation",
        "icon": "🛡️",
        "color": "#00cec9",
        "food_example": "Beef + Potatoes",
    },
    {
        "id": "omega3_vite",
        "nutrients": ["omega3_total_g", "vitamin_e_mg"],
        "effect": "↑ Omega-3 stability",
        "explanation": "Vitamin E protects omega-3 fatty acids from oxidative damage",
        "icon": "🧬",
        "color": "#6c5ce7",
        "food_example": "Salmon + Sunflower seeds",
    },
    {
        "id": "protein_leucine",
        "nutrients": ["protein_g", "leucine_mg"],
        "effect": "↑ Muscle protein synthesis",
        "explanation": "Leucine triggers mTOR pathway — the master switch for muscle building",
        "icon": "💪",
        "color": "#00ff88",
        "food_example": "Whey protein + Eggs",
    },
]

# ── Nutrient Conflicts Knowledge Base ──
NUTRIENT_CONFLICTS = [
    {
        "id": "calcium_iron",
        "nutrients": ["calcium_mg", "iron_mg"],
        "effect": "↓ Iron absorption -60%",
        "explanation": "Calcium competes with iron for the same absorption pathway (DMT1 transporter)",
        "icon": "⚠️",
        "color": "#e74c3c",
        "advice": "Separate calcium-rich and iron-rich foods by 2+ hours",
        "food_example": "Milk + Red meat (avoid together)",
    },
    {
        "id": "caffeine_iron",
        "nutrients": ["caffeine_mg", "iron_mg"],
        "effect": "↓ Iron absorption -40%",
        "explanation": "Polyphenols in caffeine bind to non-heme iron forming insoluble complexes",
        "icon": "☕",
        "color": "#e74c3c",
        "advice": "Wait 1 hour after eating before drinking coffee or tea",
        "food_example": "Coffee + Iron supplement",
    },
    {
        "id": "oxalate_calcium",
        "nutrients": ["oxalate_mg", "calcium_mg"],
        "effect": "↓ Calcium absorption -25%",
        "explanation": "Oxalates bind calcium in the gut, forming insoluble calcium oxalate",
        "icon": "🥬",
        "color": "#e17055",
        "advice": "Cook oxalate-rich foods (spinach, rhubarb) to reduce oxalate content",
        "food_example": "Raw spinach + Cheese (avoid)",
    },
    {
        "id": "phytate_zinc",
        "nutrients": ["phytate_mg", "zinc_mg"],
        "effect": "↓ Zinc absorption -50%",
        "explanation": "Phytic acid in grains/legumes chelates zinc, preventing absorption",
        "icon": "🌾",
        "color": "#fdcb6e",
        "advice": "Soak, sprout, or ferment grains to reduce phytate content",
        "food_example": "Whole wheat + Oysters (reduce synergy)",
    },
    {
        "id": "zinc_copper",
        "nutrients": ["zinc_mg", "copper_mg"],
        "effect": "↓ Copper absorption at high Zn",
        "explanation": "Excess zinc induces metallothionein which sequesters copper",
        "icon": "⚖️",
        "color": "#636e72",
        "advice": "Maintain zinc:copper ratio around 8-12:1",
        "food_example": "Zinc supplement + Copper-rich foods",
    },
]


def detect_active_synergies(nutrients: Dict[str, float]) -> List[Dict]:
    """Detect nutrient synergies active in today's meals."""
    active = []
    for syn in NUTRIENT_SYNERGIES:
        present = all(nutrients.get(n, 0) > 0 for n in syn["nutrients"])
        if present:
            # Calculate strength based on % of daily recommended
            strengths = []
            for n in syn["nutrients"]:
                rec = DAILY_RECOMMENDED.get(n, 1)
                val = nutrients.get(n, 0)
                strengths.append(min(val / rec, 1.0) if rec > 0 else 0)
            avg_strength = sum(strengths) / len(strengths) if strengths else 0
            active.append({**syn, "strength": round(avg_strength, 2), "active": True})
    return active


def detect_active_conflicts(nutrients: Dict[str, float]) -> List[Dict]:
    """Detect nutrient conflicts active in today's meals."""
    active = []
    for conf in NUTRIENT_CONFLICTS:
        # Only flag major conflicts (nutrients that are both significantly present)
        present_counts = 0
        for n in conf["nutrients"]:
            rec = DAILY_RECOMMENDED.get(n, 0)
            val = nutrients.get(n, 0)
            if rec > 0 and val / rec > 0.3:  # >30% of daily recommended
                present_counts += 1
            elif rec == 0 and val > 0:
                present_counts += 1
        if present_counts >= 2:
            active.append({**conf, "active": True})
    return active


async def generate_body_state_ai(user_data: Dict, meals_today: List[Dict], nutrient_totals: Dict, metabolic: Dict) -> Dict:
    """Use Gemini AI to generate body state interpretation and decisions."""
    try:
        from emergentintegrations.llm.chat import LlmChat, UserMessage

        # Build context
        meals_desc = ", ".join([f"{m.get('food_name', '?')} ({m.get('portion_grams', 0)}g)" for m in meals_today[:10]])
        cal_eaten = round(nutrient_totals.get("energy_kcal", 0))
        prot_eaten = round(nutrient_totals.get("protein_g", 0))
        carb_eaten = round(nutrient_totals.get("carbohydrate_g", 0))
        fat_eaten = round(nutrient_totals.get("fat_g", 0))
        fiber_eaten = round(nutrient_totals.get("fiber_g", 0))
        sugar_eaten = round(nutrient_totals.get("sugars_g", 0))
        iron_eaten = round(nutrient_totals.get("iron_mg", 0), 1)
        mag_eaten = round(nutrient_totals.get("magnesium_mg", 0))

        tdee = metabolic.get("tdee", 2000)
        goal = user_data.get("primary_goal", "energy")
        age = user_data.get("age", 30)
        weight = user_data.get("weight_kg", 70)
        sleep = user_data.get("sleep_hours", 7)
        activity = user_data.get("activity_level", "moderate")

        system_prompt = """You are NutriOS Body State Engine — a biological interpretation system.
You analyze food intake data and predict the user's real-time body state.
You MUST respond ONLY with valid JSON, no markdown, no extra text.

Response format:
{
  "body_state": {
    "energy": {"level": "high|moderate|low|unstable", "score": 0-100, "prediction": "short sentence about energy in next 2-4h"},
    "glycemic_stability": {"level": "stable|rising|falling|crash_risk", "score": 0-100, "prediction": "sentence about blood sugar trend"},
    "concentration": {"level": "sharp|normal|declining|foggy", "score": 0-100, "prediction": "sentence about mental focus"},
    "hunger": {"level": "satisfied|mild|moderate|intense", "hours_until_hungry": 0-6, "prediction": "when user will be hungry"},
    "recovery": {"level": "optimal|adequate|insufficient|critical", "score": 0-100, "prediction": "sentence about physical recovery state"}
  },
  "decisions": [
    {"priority": "high|medium|low", "action": "short imperative sentence", "reason": "why this matters now", "icon": "emoji"}
  ],
  "metabolic_note": "one-sentence overall metabolic state observation"
}

Rules:
- decisions: 3-5 items max, sorted by priority
- Be specific and actionable (e.g., "Add 30g protein in your next meal" not "eat more protein")
- Consider time of day, what was eaten, what's missing
- If no meals logged, focus on what to eat first
- If sugar is high, flag glycemic risk
- If protein is low relative to goal, flag it"""

        user_msg = f"""User: {age}yo, {weight}kg, {activity} activity, sleeps {sleep}h, goal: {goal}
TDEE: {tdee} kcal
Time: {datetime.now(timezone.utc).strftime("%H:%M UTC")}

Today's meals: {meals_desc if meals_desc else "No meals logged yet"}
Nutrients eaten: {cal_eaten}/{tdee} kcal, {prot_eaten}g protein, {carb_eaten}g carbs, {fat_eaten}g fat, {fiber_eaten}g fiber, {sugar_eaten}g sugar, {iron_eaten}mg iron, {mag_eaten}mg magnesium

Analyze and predict body state."""

        chat = LlmChat(
            api_key=EMERGENT_LLM_KEY,
            session_id=f"bstate_{uuid.uuid4().hex[:8]}",
            system_message=system_prompt
        ).with_model("gemini", "gemini-2.5-flash")

        response_text = await chat.send_message_async(UserMessage(content=user_msg))

        # Clean JSON
        cleaned = response_text.strip()
        if cleaned.startswith("```"):
            cleaned = cleaned.split("\n", 1)[-1].rsplit("```", 1)[0].strip()

        return json.loads(cleaned)

    except Exception as e:
        logger.error(f"Body state AI error: {e}")
        return _fallback_body_state(nutrient_totals, metabolic)


def _fallback_body_state(nutrients: Dict, metabolic: Dict) -> Dict:
    """Rule-based fallback when AI is unavailable."""
    cal = nutrients.get("energy_kcal", 0)
    prot = nutrients.get("protein_g", 0)
    sugar = nutrients.get("sugars_g", 0)
    fiber = nutrients.get("fiber_g", 0)
    tdee = metabolic.get("tdee", 2000)

    cal_pct = cal / tdee if tdee > 0 else 0
    prot_target = metabolic.get("macros", {}).get("protein_g", 50)
    prot_pct = prot / prot_target if prot_target > 0 else 0

    # Energy prediction
    if cal_pct < 0.2:
        energy = {"level": "low", "score": 25, "prediction": "Energy is low — you need fuel soon"}
    elif cal_pct > 0.9:
        energy = {"level": "high", "score": 85, "prediction": "Energy reserves are well stocked"}
    elif sugar > 40 and fiber < 10:
        energy = {"level": "unstable", "score": 50, "prediction": "High sugar + low fiber may cause energy crash in 1-2h"}
    else:
        energy = {"level": "moderate", "score": 60, "prediction": "Energy is stable for now"}

    # Glycemic
    if sugar > 50 and fiber < 10:
        glyc = {"level": "crash_risk", "score": 30, "prediction": "Glycemic crash predicted — high sugar without fiber"}
    elif sugar > 30:
        glyc = {"level": "rising", "score": 55, "prediction": "Blood sugar elevated — balance with protein or fiber"}
    else:
        glyc = {"level": "stable", "score": 75, "prediction": "Blood sugar is stable"}

    # Concentration
    mag = nutrients.get("magnesium_mg", 0)
    iron = nutrients.get("iron_mg", 0)
    if mag < 100 and iron < 5:
        conc = {"level": "declining", "score": 40, "prediction": "Low magnesium + iron may reduce focus"}
    elif cal_pct < 0.15:
        conc = {"level": "foggy", "score": 30, "prediction": "Brain needs glucose — eat something soon"}
    else:
        conc = {"level": "normal", "score": 65, "prediction": "Cognitive function is adequate"}

    # Hunger
    if cal_pct > 0.7:
        hunger = {"level": "satisfied", "hours_until_hungry": 3, "prediction": "You should feel satisfied for 2-3 hours"}
    elif cal_pct > 0.4:
        hunger = {"level": "mild", "hours_until_hungry": 1.5, "prediction": "Mild hunger expected within 1-2 hours"}
    else:
        hunger = {"level": "moderate", "hours_until_hungry": 0.5, "prediction": "You may be hungry soon"}

    # Recovery
    if prot_pct >= 0.8:
        recovery = {"level": "optimal", "score": 85, "prediction": "Protein intake supports muscle recovery"}
    elif prot_pct >= 0.5:
        recovery = {"level": "adequate", "score": 60, "prediction": "Recovery is moderate — more protein would help"}
    else:
        recovery = {"level": "insufficient", "score": 35, "prediction": "Protein too low for optimal recovery"}

    # Decisions
    decisions = []
    if cal_pct < 0.3:
        decisions.append({"priority": "high", "action": f"Eat a balanced meal — only {round(cal)} of {round(tdee)} kcal consumed", "reason": "Energy deficit will impact performance", "icon": "🍽️"})
    if prot_pct < 0.5:
        deficit = round(prot_target - prot)
        decisions.append({"priority": "high", "action": f"Add {deficit}g protein — try eggs, chicken, or legumes", "reason": "Insufficient protein for your goal", "icon": "🥩"})
    if sugar > 40 and fiber < 10:
        decisions.append({"priority": "high", "action": "Add fiber-rich food — oats, vegetables, or fruit with skin", "reason": "High sugar without fiber = glycemic instability", "icon": "🌾"})
    if mag < 150:
        decisions.append({"priority": "medium", "action": "Eat magnesium-rich food — nuts, dark chocolate, spinach", "reason": "Low magnesium impacts energy and focus", "icon": "🥜"})
    if not decisions:
        decisions.append({"priority": "low", "action": "You're on track — maintain your current intake pattern", "reason": "Nutrition balance is looking good", "icon": "✅"})

    return {
        "body_state": {
            "energy": energy,
            "glycemic_stability": glyc,
            "concentration": conc,
            "hunger": hunger,
            "recovery": recovery,
        },
        "decisions": decisions[:5],
        "metabolic_note": f"{'Well fueled' if cal_pct > 0.6 else 'Needs more fuel'} — {round(cal_pct * 100)}% of daily target consumed"
    }


@router.get("/body-state")
async def get_body_state(user: User = Depends(require_user)):
    """Main body state endpoint — interprets nutrition → body state → decisions."""
    try:
        user_doc = await db.users.find_one({"user_id": user.user_id}, {"_id": 0}) or {}

        # User profile data
        weight_kg = user_doc.get("weight_kg", 70)
        height_cm = user_doc.get("height_cm", 170)
        age = user_doc.get("age", 30)
        sex = user_doc.get("sex", "male")
        activity_level = user_doc.get("activity_level", "moderate")
        sleep_hours = user_doc.get("sleep_hours", 7)
        health_goals = user_doc.get("health_goals", [])
        primary_goal = health_goals[0] if health_goals else "energy"

        # Import BMR/TDEE functions
        from routes.metabolic import calculate_bmr, calculate_tdee, calculate_macro_targets
        bmr = calculate_bmr(weight_kg, height_cm, age, sex)
        tdee = calculate_tdee(bmr, activity_level)
        macros = calculate_macro_targets(tdee, primary_goal)

        # Today's meals
        today_start = datetime.now(timezone.utc).replace(hour=0, minute=0, second=0, microsecond=0)
        meals_today = await db.meals.find(
            {"user_id": user.user_id, "logged_at": {"$gte": today_start}},
            {"_id": 0}
        ).to_list(100)

        # Aggregate nutrients
        nutrient_totals: Dict[str, float] = {}
        for meal in meals_today:
            for key, val in meal.get("nutrients", {}).items():
                if isinstance(val, (int, float)):
                    nutrient_totals[key] = nutrient_totals.get(key, 0) + val

        # Detect synergies and conflicts
        synergies = detect_active_synergies(nutrient_totals)
        conflicts = detect_active_conflicts(nutrient_totals)

        # Generate body state with AI
        user_data = {
            "age": age, "weight_kg": weight_kg, "sleep_hours": sleep_hours,
            "activity_level": activity_level, "primary_goal": primary_goal,
        }
        metabolic = {"tdee": tdee, "macros": macros}

        ai_result = await generate_body_state_ai(user_data, meals_today, nutrient_totals, metabolic)

        return {
            **ai_result,
            "synergies": synergies,
            "conflicts": conflicts,
            "nutrient_totals": {k: round(v, 2) for k, v in nutrient_totals.items()},
            "meals_count": len(meals_today),
            "tdee": tdee,
            "timestamp": datetime.now(timezone.utc).isoformat(),
        }

    except Exception as e:
        logger.error(f"Body state error: {e}")
        return {
            "body_state": {
                "energy": {"level": "unknown", "score": 50, "prediction": "Unable to analyze — log meals to activate"},
                "glycemic_stability": {"level": "unknown", "score": 50, "prediction": "No data yet"},
                "concentration": {"level": "unknown", "score": 50, "prediction": "No data yet"},
                "hunger": {"level": "unknown", "hours_until_hungry": 0, "prediction": "No data yet"},
                "recovery": {"level": "unknown", "score": 50, "prediction": "No data yet"},
            },
            "decisions": [{"priority": "high", "action": "Log your first meal to activate body state analysis", "reason": "System needs nutrition data", "icon": "🍽️"}],
            "metabolic_note": "Awaiting first meal data...",
            "synergies": [],
            "conflicts": [],
            "nutrient_totals": {},
            "meals_count": 0,
            "error": str(e),
        }


@router.get("/nutrients/synergies-conflicts")
async def get_synergies_conflicts(user: User = Depends(require_user)):
    """Standalone endpoint for synergies/conflicts knowledge base + active detections."""
    try:
        today_start = datetime.now(timezone.utc).replace(hour=0, minute=0, second=0, microsecond=0)
        meals_today = await db.meals.find(
            {"user_id": user.user_id, "logged_at": {"$gte": today_start}},
            {"_id": 0}
        ).to_list(100)

        nutrient_totals: Dict[str, float] = {}
        for meal in meals_today:
            for key, val in meal.get("nutrients", {}).items():
                if isinstance(val, (int, float)):
                    nutrient_totals[key] = nutrient_totals.get(key, 0) + val

        return {
            "active_synergies": detect_active_synergies(nutrient_totals),
            "active_conflicts": detect_active_conflicts(nutrient_totals),
            "all_synergies": NUTRIENT_SYNERGIES,
            "all_conflicts": NUTRIENT_CONFLICTS,
            "meals_analyzed": len(meals_today),
        }
    except Exception as e:
        logger.error(f"Synergies error: {e}")
        return {"active_synergies": [], "active_conflicts": [], "all_synergies": NUTRIENT_SYNERGIES, "all_conflicts": NUTRIENT_CONFLICTS, "meals_analyzed": 0}
