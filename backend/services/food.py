"""NutriOS — Food analysis, USDA integration, elemental composition."""
import asyncio
import uuid
import httpx
from typing import Dict, List, Optional, Any
from config import (
    logger, USDA_API_KEY, USDA_BASE_URL,
    ELEMENTAL_FRACTIONS, ATOMIC_WEIGHTS, RETENTION_FACTORS, ALLERGENS,
    BIOLOGICAL_EFFECTS, DAILY_RECOMMENDED, IDEAL_ELEMENTAL_BALANCE, GOAL_PROFILES,
)


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
        1008: "energy_kcal",
        1003: "protein_g", 1004: "fat_g", 1005: "carbohydrate_g",
        1079: "fiber_g", 1051: "water_g", 1018: "alcohol_g",
        2000: "sugars_g", 1063: "sugars_g",
        1258: "saturated_fat_g", 1292: "monounsaturated_fat_g",
        1293: "polyunsaturated_fat_g", 1257: "trans_fat_g", 1253: "cholesterol_mg",
        1087: "calcium_mg", 1089: "iron_mg", 1090: "magnesium_mg",
        1091: "phosphorus_mg", 1092: "potassium_mg", 1093: "sodium_mg",
        1095: "zinc_mg", 1098: "copper_mg", 1099: "fluoride_mcg",
        1101: "manganese_mg", 1103: "selenium_mcg",
        1106: "vitamin_a_mcg", 1165: "vitamin_b1_mg", 1166: "vitamin_b2_mg",
        1167: "vitamin_b3_mg", 1170: "vitamin_b5_mg", 1175: "vitamin_b6_mg",
        1177: "folate_mcg", 1190: "folate_mcg", 1178: "vitamin_b12_mcg",
        1162: "vitamin_c_mg", 1114: "vitamin_d_mcg", 1109: "vitamin_e_mg",
        1185: "vitamin_k_mcg", 1180: "choline_mg",
        1210: "tryptophan_mg", 1211: "threonine_mg", 1212: "isoleucine_mg",
        1213: "leucine_mg", 1214: "lysine_mg", 1215: "methionine_mg",
        1217: "phenylalanine_mg", 1219: "valine_mg", 1221: "histidine_mg",
        1220: "arginine_mg", 1216: "cystine_mg", 1218: "tyrosine_mg",
        1225: "glycine_mg", 1226: "proline_mg",
        1404: "omega3_ala_g", 1278: "omega3_epa_g", 1272: "omega3_dha_g",
        1269: "omega6_la_g", 1271: "omega6_aa_g",
        1107: "beta_carotene_mcg", 1108: "alpha_carotene_mcg",
        1120: "beta_cryptoxanthin_mcg", 1121: "lycopene_mcg", 1123: "lutein_zeaxanthin_mcg",
    }
    amino_keys = {
        "tryptophan_mg", "threonine_mg", "isoleucine_mg", "leucine_mg",
        "lysine_mg", "methionine_mg", "phenylalanine_mg", "valine_mg",
        "histidine_mg", "arginine_mg", "cystine_mg", "tyrosine_mg",
        "glycine_mg", "proline_mg"
    }
    for fn in food_data.get("foodNutrients", []):
        nutrient_id = fn.get("nutrient", {}).get("id") or fn.get("nutrientId")
        amount = fn.get("amount", 0) or 0
        if nutrient_id in nutrient_mapping:
            key = nutrient_mapping[nutrient_id]
            calculated = round(amount * portion_factor, 3)
            if key.endswith("_mg") and key in amino_keys:
                calculated = round(amount * portion_factor * 1000, 1)
            if key in nutrients:
                nutrients[key] = max(nutrients[key], calculated)
            else:
                nutrients[key] = calculated
    if "sodium_mg" in nutrients:
        nutrients["salt_g"] = round(nutrients["sodium_mg"] * 2.5 / 1000, 3)
    omega3_total = (nutrients.get("omega3_ala_g", 0) + nutrients.get("omega3_epa_g", 0) + nutrients.get("omega3_dha_g", 0))
    if omega3_total > 0:
        nutrients["omega3_total_g"] = round(omega3_total, 3)
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
    "flavonoids_mg": 0, "polyphenols_mg": 0, "quercetin_mg": 0,
    "resveratrol_mg": 0, "glucosinolates_mg": 0, "terpenes_mg": 0,
    "limonene_mg": 0, "phytoestrogens_mg": 0, "alkaloids_mg": 0
  },
  "cofactors": {
    "coq10_mg": 0, "carnitine_mg": 0, "alpha_lipoic_acid_mg": 0,
    "glutathione_mg": 0, "nad_precursors_mg": 0
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
