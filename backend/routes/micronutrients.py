"""
NutriOS Smart Micronutrient Engine
- 7-day rolling average with RDA/UL percentages
- Bioavailability correlation engine
- Nutrient Density Score algorithm
- AI-powered gap analysis & symptom correlation
"""

from fastapi import APIRouter, Depends
from datetime import datetime, timezone, timedelta
from database import db
from dependencies import require_user
from models import User
from config import EMERGENT_LLM_KEY
import logging

logger = logging.getLogger("nutrios.micronutrients")
router = APIRouter(tags=["micronutrients"])

# ─────────────── RDA & UL Reference Data (Adults 19-50) ───────────────

MICRONUTRIENT_REF = {
    # Vitamins
    "vitamin_a_mcg":  {"name": "Vitamin A",  "unit": "mcg", "rda": 900,   "ul": 3000,  "group": "vitamin", "key_role": "Vision, immune function, skin health"},
    "vitamin_c_mg":   {"name": "Vitamin C",  "unit": "mg",  "rda": 90,    "ul": 2000,  "group": "vitamin", "key_role": "Antioxidant, collagen synthesis, iron absorption"},
    "vitamin_d_mcg":  {"name": "Vitamin D",  "unit": "mcg", "rda": 15,    "ul": 100,   "group": "vitamin", "key_role": "Calcium absorption, bone health, immune function"},
    "vitamin_e_mg":   {"name": "Vitamin E",  "unit": "mg",  "rda": 15,    "ul": 1000,  "group": "vitamin", "key_role": "Antioxidant, cell membrane protection"},
    "vitamin_k_mcg":  {"name": "Vitamin K",  "unit": "mcg", "rda": 120,   "ul": None,  "group": "vitamin", "key_role": "Blood clotting, bone metabolism"},
    "vitamin_b1_mg":  {"name": "Thiamin (B1)",  "unit": "mg",  "rda": 1.2,  "ul": None,  "group": "vitamin", "key_role": "Energy metabolism, nerve function"},
    "vitamin_b2_mg":  {"name": "Riboflavin (B2)", "unit": "mg",  "rda": 1.3,  "ul": None,  "group": "vitamin", "key_role": "Energy production, cell growth"},
    "vitamin_b3_mg":  {"name": "Niacin (B3)",  "unit": "mg",  "rda": 16,   "ul": 35,    "group": "vitamin", "key_role": "DNA repair, energy metabolism"},
    "vitamin_b6_mg":  {"name": "Vitamin B6",  "unit": "mg",  "rda": 1.3,  "ul": 100,   "group": "vitamin", "key_role": "Protein metabolism, neurotransmitter synthesis"},
    "vitamin_b9_mcg": {"name": "Folate (B9)", "unit": "mcg", "rda": 400,  "ul": 1000,  "group": "vitamin", "key_role": "DNA synthesis, cell division, fetal development"},
    "vitamin_b12_mcg": {"name": "Vitamin B12", "unit": "mcg", "rda": 2.4,  "ul": None,  "group": "vitamin", "key_role": "Red blood cell formation, neurological function"},
    # Minerals
    "calcium_mg":     {"name": "Calcium",    "unit": "mg",  "rda": 1000,  "ul": 2500,  "group": "mineral", "key_role": "Bone & teeth health, muscle contraction"},
    "iron_mg":        {"name": "Iron",       "unit": "mg",  "rda": 18,    "ul": 45,    "group": "mineral", "key_role": "Oxygen transport, energy production"},
    "magnesium_mg":   {"name": "Magnesium",  "unit": "mg",  "rda": 400,   "ul": 350,   "group": "mineral", "key_role": "Enzyme activation, muscle & nerve function"},
    "zinc_mg":        {"name": "Zinc",       "unit": "mg",  "rda": 11,    "ul": 40,    "group": "mineral", "key_role": "Immune function, wound healing, DNA synthesis"},
    "potassium_mg":   {"name": "Potassium",  "unit": "mg",  "rda": 4700,  "ul": None,  "group": "mineral", "key_role": "Heart rhythm, fluid balance, nerve signals"},
    "sodium_mg":      {"name": "Sodium",     "unit": "mg",  "rda": 1500,  "ul": 2300,  "group": "mineral", "key_role": "Fluid balance, nerve transmission"},
    "phosphorus_mg":  {"name": "Phosphorus", "unit": "mg",  "rda": 700,   "ul": 4000,  "group": "mineral", "key_role": "Bone formation, energy storage (ATP)"},
    "selenium_mcg":   {"name": "Selenium",   "unit": "mcg", "rda": 55,    "ul": 400,   "group": "mineral", "key_role": "Thyroid function, antioxidant defense"},
    "copper_mg":      {"name": "Copper",     "unit": "mg",  "rda": 0.9,   "ul": 10,    "group": "mineral", "key_role": "Iron metabolism, connective tissue"},
    "manganese_mg":   {"name": "Manganese",  "unit": "mg",  "rda": 2.3,   "ul": 11,    "group": "mineral", "key_role": "Bone formation, metabolism"},
    "fiber_g":        {"name": "Fiber",      "unit": "g",   "rda": 28,    "ul": None,  "group": "other",   "key_role": "Digestive health, blood sugar regulation"},
}

# ─────────────── Bioavailability Interaction Rules ───────────────

NUTRIENT_INTERACTIONS = [
    {
        "id": "fe_vitc_synergy",
        "type": "synergy",
        "nutrients": ["iron_mg", "vitamin_c_mg"],
        "threshold": {"iron_mg": 5, "vitamin_c_mg": 20},
        "title": "Iron + Vitamin C Synergy",
        "description": "Vitamin C increases non-heme iron absorption by up to 6x. Your iron intake would be much more effective with adequate Vitamin C.",
        "advice": "Add citrus fruits, bell peppers, or tomatoes to iron-rich meals.",
        "severity": "high"
    },
    {
        "id": "zn_cu_inhibition",
        "type": "inhibition",
        "nutrients": ["zinc_mg", "copper_mg"],
        "threshold": {"zinc_mg": 25},
        "title": "Zinc → Copper Inhibition",
        "description": "High zinc intake (>25mg/day) can inhibit copper absorption, leading to copper deficiency over time.",
        "advice": "If supplementing zinc, ensure adequate copper intake from nuts, shellfish, or dark chocolate.",
        "severity": "high"
    },
    {
        "id": "vitd_ca_synergy",
        "type": "synergy",
        "nutrients": ["vitamin_d_mcg", "calcium_mg"],
        "threshold": {"calcium_mg": 200, "vitamin_d_mcg": 5},
        "title": "Vitamin D + Calcium Synergy",
        "description": "Vitamin D is essential for calcium absorption in the intestine. Without it, only 10-15% of dietary calcium is absorbed.",
        "advice": "Get sunlight exposure or include fatty fish, fortified milk, and egg yolks.",
        "severity": "high"
    },
    {
        "id": "ca_fe_inhibition",
        "type": "inhibition",
        "nutrients": ["calcium_mg", "iron_mg"],
        "threshold": {"calcium_mg": 300},
        "title": "Calcium → Iron Inhibition",
        "description": "High calcium intake at the same meal can reduce iron absorption by up to 50%.",
        "advice": "Separate calcium-rich foods (dairy) from iron-rich foods by 2+ hours.",
        "severity": "medium"
    },
    {
        "id": "fe_mg_competition",
        "type": "inhibition",
        "nutrients": ["iron_mg", "magnesium_mg"],
        "threshold": {"iron_mg": 20, "magnesium_mg": 200},
        "title": "Iron ↔ Magnesium Competition",
        "description": "Iron and magnesium compete for the same absorption pathways. Very high doses of either can reduce absorption of the other.",
        "advice": "Space out iron and magnesium supplements if taking both.",
        "severity": "low"
    },
    {
        "id": "vitc_vite_synergy",
        "type": "synergy",
        "nutrients": ["vitamin_c_mg", "vitamin_e_mg"],
        "threshold": {"vitamin_c_mg": 30, "vitamin_e_mg": 5},
        "title": "Vitamin C + E Antioxidant Cascade",
        "description": "Vitamin C regenerates oxidized Vitamin E, creating a powerful antioxidant recycling system.",
        "advice": "Combine citrus fruits with nuts and seeds for maximum antioxidant protection.",
        "severity": "medium"
    },
    {
        "id": "na_k_balance",
        "type": "balance",
        "nutrients": ["sodium_mg", "potassium_mg"],
        "threshold": {"sodium_mg": 2000},
        "title": "Sodium ↔ Potassium Balance",
        "description": "A high sodium-to-potassium ratio increases blood pressure risk. Aim for more potassium than sodium.",
        "advice": "Increase potassium with bananas, sweet potatoes, and leafy greens while reducing processed foods.",
        "severity": "high"
    },
]

# ─────────────── Symptom-Nutrient Correlation Map ───────────────

SYMPTOM_CORRELATIONS = {
    "fatigue":      {"nutrients": ["iron_mg", "vitamin_b12_mcg", "vitamin_d_mcg", "magnesium_mg"], "note": "Fatigue is most commonly linked to iron deficiency (anemia), low B12, or vitamin D deficiency."},
    "tiredness":    {"nutrients": ["iron_mg", "vitamin_b12_mcg", "vitamin_d_mcg", "magnesium_mg"], "note": "Chronic tiredness often correlates with micronutrient deficiencies."},
    "cramps":       {"nutrients": ["magnesium_mg", "potassium_mg", "calcium_mg", "sodium_mg"], "note": "Muscle cramps are strongly linked to electrolyte imbalances, especially magnesium and potassium."},
    "hair_loss":    {"nutrients": ["iron_mg", "zinc_mg", "vitamin_d_mcg", "vitamin_b9_mcg"], "note": "Hair loss can indicate iron deficiency, zinc deficiency, or low vitamin D."},
    "weak_nails":   {"nutrients": ["iron_mg", "zinc_mg", "calcium_mg"], "note": "Brittle nails often indicate iron or zinc deficiency."},
    "brain_fog":    {"nutrients": ["iron_mg", "vitamin_b12_mcg", "vitamin_b9_mcg", "magnesium_mg"], "note": "Cognitive impairment can result from B12 or iron deficiency affecting oxygen transport to the brain."},
    "insomnia":     {"nutrients": ["magnesium_mg", "vitamin_d_mcg", "calcium_mg", "vitamin_b6_mg"], "note": "Magnesium and B6 are crucial for melatonin production and sleep quality."},
    "anxiety":      {"nutrients": ["magnesium_mg", "zinc_mg", "vitamin_b6_mg", "vitamin_d_mcg"], "note": "Magnesium is a natural relaxant; deficiency is linked to increased anxiety."},
    "weak_immunity": {"nutrients": ["zinc_mg", "vitamin_c_mg", "vitamin_d_mcg", "vitamin_a_mcg"], "note": "Frequent illness often correlates with zinc, vitamin C, or vitamin D deficiency."},
    "bone_pain":    {"nutrients": ["vitamin_d_mcg", "calcium_mg", "magnesium_mg", "phosphorus_mg"], "note": "Bone pain and weakness strongly correlate with vitamin D and calcium deficiency."},
    "bruising":     {"nutrients": ["vitamin_c_mg", "vitamin_k_mcg", "iron_mg"], "note": "Easy bruising can indicate vitamin C or K deficiency affecting collagen or clotting."},
    "dry_skin":     {"nutrients": ["vitamin_a_mcg", "vitamin_e_mg", "zinc_mg"], "note": "Dry, flaky skin is often linked to vitamin A, E, or zinc deficiency."},
    "mouth_sores":  {"nutrients": ["vitamin_b2_mg", "vitamin_b3_mg", "iron_mg", "zinc_mg"], "note": "Mouth ulcers and angular cheilitis correlate with B-vitamin and iron deficiency."},
}


# ═══════════════════ ENDPOINTS ═══════════════════

@router.get("/progress/micronutrients")
async def get_micronutrient_progress(user: User = Depends(require_user)):
    """7-day rolling average of all micronutrients with RDA/UL percentages."""
    end_date = datetime.now(timezone.utc)
    start_date = end_date - timedelta(days=7)
    start_str = start_date.strftime("%Y-%m-%d")

    meals = await db.meals.find(
        {"user_id": user.user_id, "date": {"$gte": start_str}},
        {"_id": 0, "nutrients": 1, "date": 1}
    ).to_list(500)

    # Aggregate nutrients across all 7 days
    totals = {}
    days_with_data = set()
    for meal in meals:
        nutrients = meal.get("nutrients", {})
        if not isinstance(nutrients, dict) or not nutrients:
            continue
        days_with_data.add(meal.get("date"))
        for key, value in nutrients.items():
            if key in MICRONUTRIENT_REF and isinstance(value, (int, float)):
                totals[key] = totals.get(key, 0) + value

    num_days = max(len(days_with_data), 1)

    # Build radar chart data
    chart_data = []
    for key, ref in MICRONUTRIENT_REF.items():
        total = totals.get(key, 0)
        daily_avg = round(total / num_days, 2)
        rda = ref["rda"]
        ul = ref.get("ul")
        pct_rda = round((daily_avg / rda) * 100, 1) if rda else 0

        # Color coding
        if ul and daily_avg > ul:
            status = "excess"
            color = "#bf5af2"  # purple
        elif pct_rda >= 90 and pct_rda <= 110:
            status = "optimal"
            color = "#34c759"  # green
        elif pct_rda >= 70:
            status = "adequate"
            color = "#30d158"  # light green
        elif pct_rda >= 40:
            status = "low"
            color = "#ffd60a"  # yellow
        else:
            status = "deficient"
            color = "#ff453a"  # red

        chart_data.append({
            "key": key,
            "name": ref["name"],
            "unit": ref["unit"],
            "group": ref["group"],
            "daily_avg": daily_avg,
            "rda": rda,
            "ul": ul,
            "pct_rda": pct_rda,
            "pct_ul": round((daily_avg / ul) * 100, 1) if ul else None,
            "status": status,
            "color": color,
            "key_role": ref["key_role"],
        })

    # Sort: deficient first, then low, then rest
    priority = {"deficient": 0, "low": 1, "adequate": 2, "optimal": 3, "excess": 4}
    chart_data.sort(key=lambda x: priority.get(x["status"], 5))

    # Nutrient Density Score
    total_calories = sum(
        m.get("nutrients", {}).get("energy_kcal", 0)
        for m in meals if isinstance(m.get("nutrients"), dict)
    )
    total_micro_score = sum(
        (totals.get(k, 0) / ref["rda"]) * 100
        for k, ref in MICRONUTRIENT_REF.items()
        if ref["rda"] and k != "fiber_g"
    )
    density_score = round(
        min(100, (total_micro_score / (len(MICRONUTRIENT_REF) - 1)) * (2000 / max(total_calories, 1))),
        1
    ) if total_calories > 0 else 0

    return {
        "chart_data": chart_data,
        "density_score": density_score,
        "days_tracked": num_days,
        "total_nutrients_tracked": len([c for c in chart_data if c["daily_avg"] > 0]),
    }


@router.get("/progress/bioavailability")
async def get_bioavailability_insights(user: User = Depends(require_user)):
    """Analyze nutrient interactions and bioavailability."""
    end_date = datetime.now(timezone.utc)
    start_date = end_date - timedelta(days=7)
    start_str = start_date.strftime("%Y-%m-%d")

    meals = await db.meals.find(
        {"user_id": user.user_id, "date": {"$gte": start_str}},
        {"_id": 0, "nutrients": 1}
    ).to_list(500)

    # Aggregate
    totals = {}
    days = set()
    for meal in meals:
        n = meal.get("nutrients", {})
        if not isinstance(n, dict):
            continue
        for key, val in n.items():
            if isinstance(val, (int, float)):
                totals[key] = totals.get(key, 0) + val

    num_days = max(1, 7)
    daily_avgs = {k: v / num_days for k, v in totals.items()}

    insights = []
    for rule in NUTRIENT_INTERACTIONS:
        relevant_vals = {n: daily_avgs.get(n, 0) for n in rule["nutrients"]}
        triggered = False

        if rule["type"] == "synergy":
            # Check if one nutrient is present but synergy partner is low
            present = [n for n, v in relevant_vals.items() if v >= rule["threshold"].get(n, 0)]
            absent = [n for n, v in relevant_vals.items() if v < rule["threshold"].get(n, 0)]
            if len(present) >= 1 and len(absent) >= 1:
                triggered = True

        elif rule["type"] == "inhibition":
            # Check if inhibiting nutrient exceeds threshold
            for n, thresh in rule["threshold"].items():
                if daily_avgs.get(n, 0) > thresh:
                    triggered = True
                    break

        elif rule["type"] == "balance":
            # Sodium/Potassium ratio check
            na = daily_avgs.get("sodium_mg", 0)
            k = daily_avgs.get("potassium_mg", 1)
            if na > 0 and na / max(k, 1) > 1.0:
                triggered = True

        if triggered:
            insights.append({
                "id": rule["id"],
                "type": rule["type"],
                "title": rule["title"],
                "description": rule["description"],
                "advice": rule["advice"],
                "severity": rule["severity"],
                "nutrients": {n: round(daily_avgs.get(n, 0), 2) for n in rule["nutrients"]},
            })

    # Sort by severity
    sev_order = {"high": 0, "medium": 1, "low": 2}
    insights.sort(key=lambda x: sev_order.get(x["severity"], 3))

    return {"insights": insights, "total_interactions_checked": len(NUTRIENT_INTERACTIONS)}


@router.post("/progress/symptom-correlation")
async def symptom_correlation(data: dict, user: User = Depends(require_user)):
    """Cross-reference user symptoms with nutrient deficiencies."""
    symptoms = data.get("symptoms", [])
    if not symptoms:
        return {"correlations": [], "message": "No symptoms provided"}

    # Get 7-day nutrient data
    end_date = datetime.now(timezone.utc)
    start_str = (end_date - timedelta(days=7)).strftime("%Y-%m-%d")
    meals = await db.meals.find(
        {"user_id": user.user_id, "date": {"$gte": start_str}},
        {"_id": 0, "nutrients": 1}
    ).to_list(500)

    totals = {}
    for meal in meals:
        n = meal.get("nutrients", {})
        if isinstance(n, dict):
            for key, val in n.items():
                if isinstance(val, (int, float)):
                    totals[key] = totals.get(key, 0) + val

    daily_avgs = {k: v / 7 for k, v in totals.items()}

    correlations = []
    for symptom in symptoms:
        symptom_key = symptom.lower().replace(" ", "_")
        if symptom_key in SYMPTOM_CORRELATIONS:
            corr = SYMPTOM_CORRELATIONS[symptom_key]
            deficient_nutrients = []
            for n_key in corr["nutrients"]:
                ref = MICRONUTRIENT_REF.get(n_key, {})
                rda = ref.get("rda", 0)
                avg = daily_avgs.get(n_key, 0)
                pct = round((avg / rda) * 100, 1) if rda else 0
                if pct < 70:
                    deficient_nutrients.append({
                        "key": n_key,
                        "name": ref.get("name", n_key),
                        "daily_avg": round(avg, 2),
                        "rda": rda,
                        "pct_rda": pct,
                        "deficit": round(rda - avg, 2),
                    })

            correlations.append({
                "symptom": symptom,
                "note": corr["note"],
                "deficient_nutrients": deficient_nutrients,
                "correlation_strength": "strong" if len(deficient_nutrients) >= 2 else "moderate" if len(deficient_nutrients) == 1 else "weak",
            })

    return {"correlations": correlations}


@router.get("/progress/gap-analysis")
async def gap_analysis(user: User = Depends(require_user)):
    """AI-powered gap filling: identify top deficiency and suggest foods."""
    # Get 7-day data
    end_str = datetime.now(timezone.utc).strftime("%Y-%m-%d")
    start_str = (datetime.now(timezone.utc) - timedelta(days=7)).strftime("%Y-%m-%d")

    meals = await db.meals.find(
        {"user_id": user.user_id, "date": {"$gte": start_str}},
        {"_id": 0, "nutrients": 1, "food_name": 1}
    ).to_list(500)

    totals = {}
    food_library = set()
    for meal in meals:
        food_library.add(meal.get("food_name", ""))
        n = meal.get("nutrients", {})
        if isinstance(n, dict):
            for key, val in n.items():
                if isinstance(val, (int, float)):
                    totals[key] = totals.get(key, 0) + val

    daily_avgs = {k: v / 7 for k, v in totals.items()}

    # Find top 3 deficiencies
    deficiencies = []
    for key, ref in MICRONUTRIENT_REF.items():
        rda = ref["rda"]
        avg = daily_avgs.get(key, 0)
        pct = (avg / rda) * 100 if rda else 100
        if pct < 70:
            deficiencies.append({
                "key": key,
                "name": ref["name"],
                "pct_rda": round(pct, 1),
                "daily_avg": round(avg, 2),
                "rda": rda,
                "unit": ref["unit"],
                "deficit": round(rda - avg, 2),
                "key_role": ref["key_role"],
            })

    deficiencies.sort(key=lambda x: x["pct_rda"])
    top_gaps = deficiencies[:3]

    # Use AI to suggest foods
    ai_suggestions = []
    if top_gaps and EMERGENT_LLM_KEY:
        try:
            from emergentintegrations.llm.chat import LlmChat, UserMessage
            prompt = f"""You are a nutrition expert. The user has these nutrient deficiencies (7-day average):

{chr(10).join(f"- {g['name']}: {g['pct_rda']}% of RDA ({g['daily_avg']}{g['unit']} / {g['rda']}{g['unit']})" for g in top_gaps)}

The user's food library includes: {', '.join(list(food_library)[:20])}

For EACH deficiency, suggest exactly 3 specific, common foods that are rich in that nutrient. 
Format your response as JSON array:
[{{"nutrient": "name", "foods": [{{"name": "food", "amount": "100g", "nutrient_content": "X mg"}}]}}]
Return ONLY the JSON, no markdown."""

            chat = LlmChat(
                api_key=EMERGENT_LLM_KEY,
                session_id=f"gap_{user.user_id}",
                system_message="You are a nutrition data expert. Return only valid JSON."
            ).with_model("gemini", "gemini-3-flash-preview")

            response = await chat.send_message(UserMessage(text=prompt))
            import json
            # Clean response
            clean = response.strip()
            if clean.startswith("```"):
                clean = clean.split("\n", 1)[1].rsplit("```", 1)[0]
            ai_suggestions = json.loads(clean)
        except Exception as e:
            logger.error(f"AI gap analysis error: {e}")

    return {
        "top_gaps": top_gaps,
        "all_deficiencies": deficiencies,
        "ai_suggestions": ai_suggestions,
        "foods_in_library": len(food_library),
    }
