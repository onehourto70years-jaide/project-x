"""NutriOS Service Helpers — food analysis, email, push notifications."""
import asyncio
import uuid
import httpx
import resend
from typing import Dict, List, Optional, Any
from datetime import datetime, timezone, timedelta
from config import (
    logger, USDA_API_KEY, USDA_BASE_URL, RESEND_API_KEY, SENDER_EMAIL,
    ELEMENTAL_FRACTIONS, ATOMIC_WEIGHTS, RETENTION_FACTORS, ALLERGENS,
    BIOLOGICAL_EFFECTS, DAILY_RECOMMENDED, IDEAL_ELEMENTAL_BALANCE, GOAL_PROFILES,
)
from database import db
from notification_i18n import get_notif_string
from nutrition_tips import NUTRITION_TIPS
import random

# Initialize Resend
resend.api_key = RESEND_API_KEY

EXPO_PUSH_URL = "https://exp.host/--/api/v2/push/send"

# ── USDA Food Functions ──

async def search_usda_foods(query: str, page_size: int = 10) -> List[Dict]:
    for attempt in range(3):
        try:
            async with httpx.AsyncClient(timeout=15.0) as client_http:
                response = await client_http.get(
                    f"{USDA_BASE_URL}/foods/search",
                    params={"api_key": USDA_API_KEY, "query": query, "pageSize": page_size,
                            "dataType": ["Foundation", "SR Legacy", "Survey (FNDDS)"]}
                )
                if response.status_code == 200:
                    return [{"fdc_id": f.get("fdcId"), "description": f.get("description"),
                             "brand_owner": f.get("brandOwner"), "data_type": f.get("dataType")}
                            for f in response.json().get("foods", [])]
                elif response.status_code == 400:
                    response = await client_http.get(
                        f"{USDA_BASE_URL}/foods/search",
                        params={"api_key": USDA_API_KEY, "query": query, "pageSize": page_size}
                    )
                    if response.status_code == 200:
                        return [{"fdc_id": f.get("fdcId"), "description": f.get("description"),
                                 "brand_owner": f.get("brandOwner"), "data_type": f.get("dataType")}
                                for f in response.json().get("foods", [])]
                logger.warning(f"USDA search attempt {attempt+1} failed: {response.status_code}")
        except Exception as e:
            logger.warning(f"USDA search attempt {attempt+1} error: {e}")
            if attempt < 2:
                await asyncio.sleep(1)
    return []


async def get_usda_food_details(fdc_id: int) -> Optional[Dict]:
    for attempt in range(3):
        try:
            async with httpx.AsyncClient(timeout=15.0) as client_http:
                response = await client_http.get(
                    f"{USDA_BASE_URL}/food/{fdc_id}",
                    params={"api_key": USDA_API_KEY}
                )
                if response.status_code == 200:
                    return response.json()
                elif response.status_code == 404:
                    return None
                logger.warning(f"USDA detail attempt {attempt+1} for {fdc_id}: {response.status_code}")
        except Exception as e:
            logger.warning(f"USDA detail attempt {attempt+1} error: {e}")
            if attempt < 2:
                await asyncio.sleep(1)
    return None


def extract_nutrients(food_data: Dict, portion_grams: float = 100.0) -> Dict[str, float]:
    nutrients = {}
    portion_factor = portion_grams / 100.0
    nutrient_mapping = {
        # Energy
        1008: "energy_kcal",
        # Macronutrients
        1003: "protein_g",
        1004: "fat_g",
        1005: "carbohydrate_g",
        1079: "fiber_g",
        1051: "water_g",
        1018: "alcohol_g",
        # Sugars
        2000: "sugars_g",
        1063: "sugars_g",
        # Fats detailed
        1258: "saturated_fat_g",
        1292: "monounsaturated_fat_g",
        1293: "polyunsaturated_fat_g",
        1257: "trans_fat_g",
        1253: "cholesterol_mg",
        # Minerals
        1087: "calcium_mg",
        1089: "iron_mg",
        1090: "magnesium_mg",
        1091: "phosphorus_mg",
        1092: "potassium_mg",
        1093: "sodium_mg",
        1095: "zinc_mg",
        1098: "copper_mg",
        1099: "fluoride_mcg",
        1101: "manganese_mg",
        1103: "selenium_mcg",
        # Vitamins
        1106: "vitamin_a_mcg",
        1165: "vitamin_b1_mg",
        1166: "vitamin_b2_mg",
        1167: "vitamin_b3_mg",
        1170: "vitamin_b5_mg",
        1175: "vitamin_b6_mg",
        1177: "folate_mcg",
        1190: "folate_mcg",
        1178: "vitamin_b12_mcg",
        1162: "vitamin_c_mg",
        1114: "vitamin_d_mcg",
        1109: "vitamin_e_mg",
        1185: "vitamin_k_mcg",
        1180: "choline_mg",
        # ═══ Essential Amino Acids (9) ═══
        1210: "tryptophan_mg",
        1211: "threonine_mg",
        1212: "isoleucine_mg",
        1213: "leucine_mg",
        1214: "lysine_mg",
        1215: "methionine_mg",
        1217: "phenylalanine_mg",
        1219: "valine_mg",
        1221: "histidine_mg",
        # ═══ Semi-Essential Amino Acids ═══
        1220: "arginine_mg",
        1216: "cystine_mg",
        1218: "tyrosine_mg",
        1225: "glycine_mg",
        1226: "proline_mg",
        # ═══ Omega-3 Fatty Acids ═══
        1404: "omega3_ala_g",
        1278: "omega3_epa_g",
        1272: "omega3_dha_g",
        # ═══ Omega-6 Fatty Acids ═══
        1269: "omega6_la_g",
        1271: "omega6_aa_g",
        # ═══ Carotenoids ═══
        1107: "beta_carotene_mcg",
        1108: "alpha_carotene_mcg",
        1120: "beta_cryptoxanthin_mcg",
        1121: "lycopene_mcg",
        1123: "lutein_zeaxanthin_mcg",
    }
    for fn in food_data.get("foodNutrients", []):
        nutrient_id = fn.get("nutrient", {}).get("id") or fn.get("nutrientId")
        amount = fn.get("amount", 0) or 0
        if nutrient_id in nutrient_mapping:
            key = nutrient_mapping[nutrient_id]
            calculated = round(amount * portion_factor, 3)
            # Amino acids from USDA are in grams, convert to mg
            if key.endswith("_mg") and key in (
                "tryptophan_mg", "threonine_mg", "isoleucine_mg", "leucine_mg",
                "lysine_mg", "methionine_mg", "phenylalanine_mg", "valine_mg",
                "histidine_mg", "arginine_mg", "cystine_mg", "tyrosine_mg",
                "glycine_mg", "proline_mg"
            ):
                # USDA reports amino acids in grams, convert to mg for display
                calculated = round(amount * portion_factor * 1000, 1)
            # For duplicate IDs (e.g. folate, sugars), keep the higher value
            if key in nutrients:
                nutrients[key] = max(nutrients[key], calculated)
            else:
                nutrients[key] = calculated
    # Derived: Salt from sodium (salt = sodium * 2.5 / 1000)
    if "sodium_mg" in nutrients:
        nutrients["salt_g"] = round(nutrients["sodium_mg"] * 2.5 / 1000, 3)
    # Derived: Total Omega-3
    omega3_total = (nutrients.get("omega3_ala_g", 0) + nutrients.get("omega3_epa_g", 0) + nutrients.get("omega3_dha_g", 0))
    if omega3_total > 0:
        nutrients["omega3_total_g"] = round(omega3_total, 3)
    # Derived: Total Omega-6
    omega6_total = (nutrients.get("omega6_la_g", 0) + nutrients.get("omega6_aa_g", 0))
    if omega6_total > 0:
        nutrients["omega6_total_g"] = round(omega6_total, 3)
    return nutrients


async def estimate_phytochemicals(food_name: str, portion_grams: float = 100.0) -> Dict[str, Any]:
    """Use Gemini AI to estimate phytochemicals and bioactive compounds not in USDA data."""
    from config import EMERGENT_LLM_KEY
    try:
        from emergentintegrations.llm.chat import LlmChat, UserMessage
        system_prompt = """You are a nutrition science AI. Estimate phytochemical and bioactive compound content for foods.
Return ONLY valid JSON (no markdown fences) with this exact structure:
{
  "phytochemicals": {
    "flavonoids_mg": 0,
    "polyphenols_mg": 0,
    "quercetin_mg": 0,
    "resveratrol_mg": 0,
    "glucosinolates_mg": 0,
    "terpenes_mg": 0,
    "limonene_mg": 0,
    "phytoestrogens_mg": 0,
    "alkaloids_mg": 0
  },
  "cofactors": {
    "coq10_mg": 0,
    "carnitine_mg": 0,
    "alpha_lipoic_acid_mg": 0,
    "glutathione_mg": 0,
    "nad_precursors_mg": 0
  },
  "glycemic_index": 0,
  "glycemic_load": 0
}
Use scientific literature values. If a compound is not present in this food, use 0.
Scale values for the given portion size. Be accurate - use peer-reviewed data."""

        chat = LlmChat(
            api_key=EMERGENT_LLM_KEY,
            session_id=f"phyto_{uuid.uuid4().hex[:6]}",
            system_message=system_prompt
        ).with_model("gemini", "gemini-2.5-flash")

        response = await chat.send_message(UserMessage(
            text=f"Estimate phytochemicals and bioactive compounds in {portion_grams}g of '{food_name}'. Use scientific data."
        ))

        import json
        cleaned = response.strip()
        if cleaned.startswith("```"):
            cleaned = cleaned.split("```")[1]
            if cleaned.startswith("json"):
                cleaned = cleaned[4:]
            cleaned = cleaned.strip()
        return json.loads(cleaned)
    except Exception as e:
        logger.warning(f"Phytochemical estimation failed for {food_name}: {e}")
        return {"phytochemicals": {}, "cofactors": {}, "glycemic_index": 0, "glycemic_load": 0}


def calculate_elemental_composition(nutrients: Dict[str, float]) -> Dict[str, Any]:
    elements = {"C": 0.0, "H": 0.0, "O": 0.0, "N": 0.0, "S": 0.0, "Ca": 0.0, "Fe": 0.0, "Mg": 0.0, "P": 0.0, "K": 0.0, "Na": 0.0, "Zn": 0.0}
    for macro, fractions in [("protein_g", ELEMENTAL_FRACTIONS["protein"]), ("carbohydrate_g", ELEMENTAL_FRACTIONS["carbohydrate"]), ("fat_g", ELEMENTAL_FRACTIONS["fat"])]:
        for el, frac in fractions.items():
            elements[el] += nutrients.get(macro, 0) * frac
    for nutrient_key, element in {"calcium_mg": "Ca", "iron_mg": "Fe", "magnesium_mg": "Mg", "potassium_mg": "K", "sodium_mg": "Na", "zinc_mg": "Zn"}.items():
        if nutrient_key in nutrients:
            elements[element] = nutrients[nutrient_key] / 1000
    elements = {k: round(v, 6) for k, v in elements.items()}
    millimoles = {el: round((mass / ATOMIC_WEIGHTS.get(el, 1)) * 1000, 4) for el, mass in elements.items() if mass > 0 and el in ATOMIC_WEIGHTS}
    return {"mass_grams": elements, "millimoles": millimoles, "confidence": "high" if nutrients.get("protein_g", 0) > 0 else "estimated"}


def apply_cooking_retention(nutrients: Dict[str, float], cooking_method: str) -> Dict[str, float]:
    factors = RETENTION_FACTORS.get(cooking_method, RETENTION_FACTORS["raw"])
    cooked = nutrients.copy()
    for nk, fk in {"vitamin_a_mcg": "vitamin_a", "vitamin_c_mg": "vitamin_c", "iron_mg": "iron", "magnesium_mg": "magnesium", "potassium_mg": "potassium", "zinc_mg": "zinc", "calcium_mg": "calcium", "protein_g": "protein"}.items():
        if nk in cooked and fk in factors:
            cooked[nk] = round(cooked[nk] * factors[fk], 3)
    return cooked


def detect_allergens(food_name: str, ingredients: Optional[str] = None) -> List[str]:
    text = food_name.lower() + (" " + ingredients.lower() if ingredients else "")
    detected = []
    categories = {"peanut": "peanuts", "milk": "dairy", "dairy": "dairy", "egg": "eggs", "wheat": "wheat/gluten", "gluten": "wheat/gluten", "soy": "soy", "fish": "fish", "shellfish": "shellfish", "sesame": "sesame"}
    for allergen in ALLERGENS:
        if allergen in text:
            cat = categories.get(allergen, allergen)
            if cat not in detected:
                detected.append(cat)
    return detected


def calculate_elemental_balance(elements_grams: Dict[str, float]) -> Dict:
    total = sum(elements_grams.values()) or 1
    scores = {}
    total_score = 0
    element_count = 0
    for el, ideal in IDEAL_ELEMENTAL_BALANCE.items():
        actual_pct = (elements_grams.get(el, 0) / total) * 100
        min_pct, max_pct, ideal_pct = ideal["min_pct"], ideal["max_pct"], ideal["ideal_pct"]
        if min_pct <= actual_pct <= max_pct:
            deviation = abs(actual_pct - ideal_pct) / ideal_pct
            score = max(0, 100 - (deviation * 100))
        elif actual_pct < min_pct:
            score = max(0, (actual_pct / min_pct) * 60)
        else:
            score = max(0, 60 - ((actual_pct - max_pct) / max_pct) * 60)
        status = "optimal" if abs(actual_pct - ideal_pct) < 2 else ("low" if actual_pct < min_pct else ("high" if actual_pct > max_pct else "acceptable"))
        scores[el] = {"actual_pct": round(actual_pct, 2), "ideal_pct": ideal_pct, "score": round(score), "status": status, "role": ideal["role"]}
        total_score += score
        element_count += 1
    return {"overall_score": round(total_score / max(element_count, 1)), "elements": scores, "total_mass_g": round(total, 2)}


def score_food_for_goal(nutrients: Dict, elements: Dict, goal_key: str) -> float:
    profile = GOAL_PROFILES.get(goal_key)
    if not profile:
        return 0
    score = 0
    weight_sum = 0
    for nutrient, multiplier in profile.get("priority_nutrients", {}).items():
        value = nutrients.get(nutrient, 0)
        recommended = DAILY_RECOMMENDED.get(nutrient, 1)
        contribution = min((value / recommended) * 100, 150)
        score += contribution * multiplier
        weight_sum += multiplier
    for element, multiplier in profile.get("priority_elements", {}).items():
        value = elements.get(element, 0)
        if value > 0:
            score += 20 * multiplier
            weight_sum += multiplier
    return round(score / max(weight_sum, 1), 1)


# ── Email ──

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
                <p style="color: #ccc; line-height: 1.7; font-size: 15px;">Welcome aboard! We're thrilled to have you join the NutriOS community. Here's what you can start doing right away:</p>
                <div style="margin: 24px 0;">
                    <div style="display: flex; align-items: center; margin-bottom: 16px;">
                        <span style="display: inline-block; width: 32px; height: 32px; line-height: 32px; text-align: center; background: rgba(0, 212, 255, 0.15); border-radius: 10px; margin-right: 14px; font-size: 16px;">\U0001f50d</span>
                        <span style="color: #ddd; font-size: 14px;"><strong style="color: #00d4ff;">Search & Track Foods</strong> — Log meals with full elemental breakdowns</span>
                    </div>
                    <div style="display: flex; align-items: center; margin-bottom: 16px;">
                        <span style="display: inline-block; width: 32px; height: 32px; line-height: 32px; text-align: center; background: rgba(78, 205, 196, 0.15); border-radius: 10px; margin-right: 14px; font-size: 16px;">\U0001f4a7</span>
                        <span style="color: #ddd; font-size: 14px;"><strong style="color: #4ecdc4;">Track Hydration</strong> — Smart water goals based on your activity</span>
                    </div>
                    <div style="display: flex; align-items: center; margin-bottom: 16px;">
                        <span style="display: inline-block; width: 32px; height: 32px; line-height: 32px; text-align: center; background: rgba(162, 155, 254, 0.15); border-radius: 10px; margin-right: 14px; font-size: 16px;">\U0001f9ec</span>
                        <span style="color: #ddd; font-size: 14px;"><strong style="color: #a29bfe;">Molecular Engine</strong> — See your food at the atomic level</span>
                    </div>
                    <div style="display: flex; align-items: center; margin-bottom: 16px;">
                        <span style="display: inline-block; width: 32px; height: 32px; line-height: 32px; text-align: center; background: rgba(253, 121, 168, 0.15); border-radius: 10px; margin-right: 14px; font-size: 16px;">\U0001f916</span>
                        <span style="color: #ddd; font-size: 14px;"><strong style="color: #fd79a8;">AI Coach</strong> — Get personalized nutrition insights</span>
                    </div>
                </div>
                <div style="background: rgba(0, 212, 255, 0.08); border-radius: 12px; padding: 16px; margin: 20px 0; border-left: 3px solid #00d4ff;">
                    <p style="color: #00d4ff; margin: 0 0 4px; font-weight: 600;">\U0001f389 Your free trial is active!</p>
                    <p style="color: #ccc; margin: 0; font-size: 14px;">Enjoy full access to all NutriOS features. Start tracking your first meal today!</p>
                </div>
                <p style="color: #888; margin-top: 28px; font-size: 13px; text-align: center;">Let's make every bite count.<br/>— The NutriOS Team</p>
            </div>
        </div>
        """
        params = {"from": SENDER_EMAIL, "to": [email], "subject": "Welcome to NutriOS \U0001f9ec — Let's Get Started!", "html": html}
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
                <p style="color: #ccc; line-height: 1.7;">This email confirms that your NutriOS account and all associated data have been <strong style="color: #ff6b6b;">permanently deleted</strong>.</p>
                <div style="background: rgba(255, 107, 107, 0.08); border-radius: 12px; padding: 16px; margin: 20px 0; border-left: 3px solid #ff6b6b;">
                    <p style="color: #ff6b6b; margin: 0 0 4px; font-weight: 600;">What was deleted:</p>
                    <ul style="color: #ccc; margin: 8px 0 0; padding-left: 20px; font-size: 14px; line-height: 1.8;">
                        <li>Your profile and preferences</li>
                        <li>All meal and nutrition logs</li>
                        <li>Water tracking history</li>
                        <li>Routines, recipes, and meal plans</li>
                        <li>AI conversation history</li>
                        <li>Badges and achievements</li>
                    </ul>
                </div>
                <p style="color: #ccc; line-height: 1.7;">This action cannot be undone. If you didn't request this, please contact us immediately.</p>
                <p style="color: #888; margin-top: 24px; font-size: 13px;">We're sad to see you go. You're always welcome back.<br/>— The NutriOS Team</p>
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
                <div style="font-size: 48px; margin-bottom: 12px;">\U0001f48e</div>
                <h1 style="color: #ffd93d; margin: 0; font-size: 24px;">Welcome to NutriOS Pro!</h1>
                <p style="color: #888; margin: 8px 0 0;">Payment Confirmation</p>
            </div>
            <div style="padding: 28px;">
                <p style="color: #ccc; line-height: 1.7;">Hi {name or 'there'},</p>
                <p style="color: #ccc; line-height: 1.7;">Your <strong style="color: #ffd93d;">{plan_label}</strong> subscription to NutriOS Pro is now active! \U0001f389</p>
                <div style="background: rgba(255, 217, 61, 0.08); border-radius: 12px; padding: 16px; margin: 20px 0; border-left: 3px solid #ffd93d;">
                    <p style="color: #ffd93d; margin: 0 0 8px; font-weight: 600;">Pro Features Unlocked:</p>
                    <ul style="color: #ccc; margin: 0; padding-left: 20px; font-size: 14px; line-height: 1.8;">
                        <li>Unlimited AI Coach conversations</li>
                        <li>Advanced molecular analysis</li>
                        <li>Food Sequence Optimizer</li>
                        <li>Priority support</li>
                        <li>All future Pro features</li>
                    </ul>
                </div>
                <p style="color: #ccc; line-height: 1.7;">You can manage your subscription anytime from the app's Settings page.</p>
                <p style="color: #888; margin-top: 24px; font-size: 13px; text-align: center;">Thank you for supporting NutriOS!<br/>— The NutriOS Team</p>
            </div>
        </div>
        """
        params = {"from": SENDER_EMAIL, "to": [email], "subject": "NutriOS Pro Activated \U0001f48e — Payment Confirmation", "html": html}
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
                <p style="color: #888; margin: 8px 0 0;">Incredible consistency, {name or 'Champion'}!</p>
            </div>
            <div style="padding: 28px;">
                <p style="color: #ccc; line-height: 1.7;">You've been tracking your nutrition for <strong style="color: #ff6b6b;">{streak_days} consecutive days</strong>!</p>
                <div style="background: rgba(255, 107, 107, 0.08); border-radius: 12px; padding: 20px; margin: 20px 0; text-align: center;">
                    <div style="font-size: 48px; font-weight: 900; color: #ff6b6b;">{streak_days}</div>
                    <div style="color: #888; font-size: 14px; margin-top: 4px;">Day Streak</div>
                </div>
                <p style="color: #ccc; line-height: 1.7;">Consistency is the key to lasting health improvements. Keep up the amazing work!</p>
                <p style="color: #888; margin-top: 24px; font-size: 13px; text-align: center;">Keep the flame burning \U0001f525<br/>— The NutriOS Team</p>
            </div>
        </div>
        """
        params = {"from": SENDER_EMAIL, "to": [email], "subject": f"{emoji} {label} Streak on NutriOS — You're on Fire!", "html": html}
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
                <p style="color: #888; margin: 8px 0 0;">NutriOS Weekly Summary</p>
            </div>
            <div style="padding: 28px;">
                <p style="color: #ccc; line-height: 1.7;">Hi {name or 'there'}, here's how your week went:</p>
                <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 12px; margin: 20px 0;">
                    <div style="background: rgba(0, 212, 255, 0.08); border-radius: 12px; padding: 16px; text-align: center;">
                        <div style="font-size: 28px; font-weight: 900; color: #00d4ff;">{meals}</div>
                        <div style="color: #888; font-size: 12px; margin-top: 4px;">Meals Logged</div>
                    </div>
                    <div style="background: rgba(255, 107, 107, 0.08); border-radius: 12px; padding: 16px; text-align: center;">
                        <div style="font-size: 28px; font-weight: 900; color: #ff6b6b;">{int(calories)}</div>
                        <div style="color: #888; font-size: 12px; margin-top: 4px;">Calories (kcal)</div>
                    </div>
                    <div style="background: rgba(0, 255, 136, 0.08); border-radius: 12px; padding: 16px; text-align: center;">
                        <div style="font-size: 28px; font-weight: 900; color: #00ff88;">{int(protein)}g</div>
                        <div style="color: #888; font-size: 12px; margin-top: 4px;">Protein</div>
                    </div>
                    <div style="background: rgba(78, 205, 196, 0.08); border-radius: 12px; padding: 16px; text-align: center;">
                        <div style="font-size: 28px; font-weight: 900; color: #4ecdc4;">{water_ml / 1000:.1f}L</div>
                        <div style="color: #888; font-size: 12px; margin-top: 4px;">Water</div>
                    </div>
                </div>
                <div style="background: rgba(255,255,255,0.04); border-radius: 12px; padding: 16px; margin: 16px 0; display: flex; justify-content: space-between;">
                    <div style="text-align: center; flex: 1;">
                        <div style="color: #ff6b6b; font-size: 20px; font-weight: 800;">{streak}</div>
                        <div style="color: #888; font-size: 11px;">Day Streak</div>
                    </div>
                    <div style="width: 1px; background: rgba(255,255,255,0.08);"></div>
                    <div style="text-align: center; flex: 1;">
                        <div style="color: #ffd93d; font-size: 20px; font-weight: 800;">{unique_foods}</div>
                        <div style="color: #888; font-size: 11px;">Unique Foods</div>
                    </div>
                </div>
                <p style="color: #ccc; line-height: 1.7; font-size: 14px;">Keep tracking consistently to see your health transform over time!</p>
                <p style="color: #888; margin-top: 24px; font-size: 13px; text-align: center;">See you next week \U0001f4ca<br/>— The NutriOS Team</p>
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


# ── Push Notifications ──

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


# ── Scheduled Notification Helpers (Multilingual & Smart) ──

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
        # Find unsent reminders that are due
        due_reminders = await db.scheduled_notifications.find({
            "sent": False,
            "scheduled_at": {"$lte": now}
        }).to_list(100)

        if not due_reminders:
            return

        for reminder in due_reminders:
            user_id = reminder.get("user_id")
            title = reminder.get("title", "⏰ Reminder")
            body = reminder.get("body", "Your AI coach reminder")

            # Get user's push token
            token_doc = await db.push_tokens.find_one({"user_id": user_id})
            if token_doc and token_doc.get("push_token"):
                push_token = token_doc["push_token"]
                # Check if notifications are enabled
                settings = await db.user_settings.find_one({"user_id": user_id}) or {}
                if settings.get("notifications_enabled", True):
                    await send_expo_push([push_token], title, body, {"type": "ai_reminder", "source": "ai_coach"})
                    await _log_notification(user_id, "ai_reminder", title, body)

            # Mark as sent
            await db.scheduled_notifications.update_one(
                {"_id": reminder["_id"]},
                {"$set": {"sent": True, "sent_at": now}}
            )
            logger.info(f"AI reminder sent to {user_id}: {title}")

    except Exception as e:
        logger.error(f"AI Coach reminder error: {e}")



async def send_smart_water_reminders():
    """Smart water reminder — checks actual intake before sending. Sends personalized messages."""
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
                # Already hit goal — skip or send congratulation (only once)
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
    """Evening check — tell users how they're doing on calories for the day."""
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
                continue  # Don't nudge if they logged nothing today
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
    """Alert users whose logging streak is about to break (no meal logged today by evening)."""
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
            # Check if user logged yesterday but not today
            yesterday_meals = await db.meals.count_documents({"user_id": user_id, "date": yesterday})
            today_meals = await db.meals.count_documents({"user_id": user_id, "date": today})
            if yesterday_meals > 0 and today_meals == 0:
                # Calculate current streak length
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
            # Check last activity (meal, water, or routine completion)
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
                # Don't spam — only send once per inactivity period (check recent notif logs)
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
    """Send a personalized, translated daily summary push to all users at end of day."""
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


# ── Daily Summary Helper ──

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


# ── Scheduled: Weekly Summary Email ──

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
                # Check user settings for email preference
                settings = await db.user_settings.find_one({"user_id": user_id})
                if settings and settings.get("weekly_email_enabled") is False:
                    continue
                # Aggregate weekly stats
                meals = await db.meals.find({"user_id": user_id, "created_at": {"$gte": week_ago}}).to_list(500)
                total_calories = sum(m.get("nutrients", {}).get("energy_kcal", 0) for m in meals)
                total_protein = sum(m.get("nutrients", {}).get("protein_g", 0) for m in meals)
                water_logs = await db.water_logs.find({"user_id": user_id, "created_at": {"$gte": week_ago}}).to_list(500)
                total_water = sum(w.get("amount_ml", 0) for w in water_logs)
                food_names = set()
                for m in meals:
                    food_names.add(m.get("food_name", ""))
                # Get streak
                streak_data = await db.routines.find_one({"user_id": user_id}, sort=[("streak_days", -1)])
                streak_days = streak_data.get("streak_days", 0) if streak_data else 0
                stats = {
                    "total_meals": len(meals),
                    "total_calories": total_calories,
                    "total_protein": total_protein,
                    "total_water": total_water,
                    "streak_days": streak_days,
                    "unique_foods": len(food_names),
                }
                # Only send if user had some activity
                if len(meals) > 0 or total_water > 0:
                    await send_weekly_summary_email(email, name, stats)
            except Exception as e:
                logger.error(f"Weekly email error for user {user_doc.get('user_id', '?')}: {e}")
    except Exception as e:
        logger.error(f"Weekly summary emails batch error: {e}")


# ── Scheduled: Streak Milestone Email Checker ──

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
                # Get user's current streak from daily tracking
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
                    # Check if we already sent this milestone email
                    already_sent = await db.email_logs.find_one({
                        "to": email,
                        "type": "streak_milestone",
                        "streak_days": streak_days,
                    })
                    if not already_sent:
                        await send_streak_milestone_email(email, name, streak_days)
            except Exception as e:
                logger.error(f"Streak milestone check error for {user_doc.get('user_id', '?')}: {e}")
    except Exception as e:
        logger.error(f"Streak milestone checker batch error: {e}")


# ────────────────────────────────────────────────────────────
#  "Did You Know?" Nutritional Tips — Contextual & Non-Repeating
# ────────────────────────────────────────────────────────────

def _pick_contextual_tip(lang: str, recent_meals: list, seen_ids: set) -> dict | None:
    """Pick a tip relevant to the user's recent food intake, avoiding repeats."""
    tips = NUTRITION_TIPS.get(lang, NUTRITION_TIPS["en"])
    unseen = [t for t in tips if t["id"] not in seen_ids]
    if not unseen:
        # All tips seen — reset the cycle so user gets fresh round
        unseen = tips

    if recent_meals:
        # Build a set of element / nutrient categories from recent meals
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

        # Try contextual match first
        contextual = [t for t in unseen if any(c in user_cats for c in t["cat"])]
        if contextual:
            return random.choice(contextual)

    # Fallback: random unseen tip
    return random.choice(unseen) if unseen else None


async def send_nutrition_tips():
    """Send contextual 'Did You Know?' nutritional tips to users (non-repeating, i18n)."""
    try:
        all_tokens = await db.push_tokens.find({}, {"_id": 0}).to_list(10000)
        if not all_tokens:
            return

        for token_doc in all_tokens:
            user_id = token_doc.get("user_id")
            push_token = token_doc.get("push_token")
            if not push_token:
                continue

            # Respect notification + tip settings
            settings = await db.user_settings.find_one({"user_id": user_id}, {"_id": 0}) or {}
            if not settings.get("notifications_enabled", True):
                continue
            if not settings.get("tips_enabled", True):
                continue

            lang = await _get_user_lang(user_id)

            # Fetch recent meals for contextual matching
            recent_meals = await db.meals.find(
                {"user_id": user_id},
                sort=[("created_at", -1)]
            ).to_list(5)

            # Load tip history
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

            # Mark tip as seen (auto-reset happens inside _pick_contextual_tip
            # when all tips have been seen)
            if tip["id"] not in seen_ids:
                await db.user_tip_history.update_one(
                    {"user_id": user_id},
                    {"$addToSet": {"seen": tip["id"]}},
                    upsert=True,
                )
            else:
                # Full cycle completed — reset
                await db.user_tip_history.update_one(
                    {"user_id": user_id},
                    {"$set": {"seen": [tip["id"]]}},
                    upsert=True,
                )
    except Exception as e:
        logger.error(f"Nutrition tip delivery error: {e}")
