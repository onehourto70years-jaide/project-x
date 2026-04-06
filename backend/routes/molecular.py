from fastapi import APIRouter, Request, Depends
import json
import re
from database import db
from dependencies import require_user
from models import User
from config import logger, EMERGENT_LLM_KEY, GOAL_PROFILES, DAILY_RECOMMENDED
from services import calculate_elemental_balance, score_food_for_goal

router = APIRouter(tags=["molecular"])


@router.get("/molecular/profiles")
async def get_goal_profiles():
    profiles = {}
    for key, profile in GOAL_PROFILES.items():
        profiles[key] = {"name": profile["name"], "description": profile["description"], "ideal_macro_ratio": profile["ideal_macro_ratio"], "key_foods": profile["key_foods"], "synergy_pairs": profile["synergy_pairs"]}
    return {"profiles": profiles}


@router.post("/molecular/analyze-meal")
async def analyze_meal_balance(request: Request, user: User = Depends(require_user)):
    body = await request.json()
    meal_foods = body.get("foods", [])
    user_goals = body.get("goals", [])
    total_elements, total_nutrients, food_names = {}, {}, []
    for food_item in meal_foods:
        elements = food_item.get("elements", {})
        nutrients = food_item.get("nutrients", {})
        food_names.append(food_item.get("food_name", "Unknown"))
        for el, val in elements.items(): total_elements[el] = total_elements.get(el, 0) + val
        for nut, val in nutrients.items(): total_nutrients[nut] = total_nutrients.get(nut, 0) + val
    balance = calculate_elemental_balance(total_elements)
    goal_scores = {}
    for goal in user_goals:
        goal_scores[goal] = {"score": score_food_for_goal(total_nutrients, total_elements, goal), "profile_name": GOAL_PROFILES.get(goal, {}).get("name", goal)}
    deficiencies, excesses = [], []
    for el, data in balance["elements"].items():
        if data["status"] == "low": deficiencies.append({"element": el, "actual": data["actual_pct"], "ideal": data["ideal_pct"], "role": data["role"]})
        elif data["status"] == "high": excesses.append({"element": el, "actual": data["actual_pct"], "ideal": data["ideal_pct"], "role": data["role"]})
    return {"balance_score": balance["overall_score"], "elements": balance["elements"], "total_mass_g": balance["total_mass_g"], "goal_scores": goal_scores, "deficiencies": deficiencies, "excesses": excesses, "food_names": food_names, "total_nutrients": total_nutrients}


@router.post("/molecular/fix-meal")
async def fix_meal_suggestions(request: Request, user: User = Depends(require_user)):
    body = await request.json()
    meal_foods = body.get("foods", [])
    user_goals = body.get("goals", [])
    deficiencies = body.get("deficiencies", [])
    food_names = [f.get("food_name", "") for f in meal_foods]
    goals_text = ", ".join([GOAL_PROFILES.get(g, {}).get("name", g) for g in user_goals])
    deficiency_text = ", ".join([f"{d['element']} ({d['role']})" for d in deficiencies])
    prompt = f"""You are a molecular nutrition expert. Analyze this meal and suggest specific improvements.
Current meal: {', '.join(food_names)}
User goals: {goals_text}
Elemental deficiencies: {deficiency_text}
Suggest 2-3 foods to ADD, explain WHY at molecular level, and any SWAPS.
Respond in JSON: {{"additions": [{{"food": "", "portion_g": 100, "reason": "", "fixes_elements": []}}], "swaps": [{{"remove": "", "replace_with": "", "reason": ""}}], "explanation": ""}}"""
    try:
        from emergentintegrations.llm.chat import ChatMessage, chat
        messages = [ChatMessage(role="system", content="You are a molecular nutrition AI. Always respond with valid JSON."), ChatMessage(role="user", content=prompt)]
        response = await chat(api_key=EMERGENT_LLM_KEY, model="gemini-2.0-flash", messages=messages, temperature=0.3)
        json_match = re.search(r'\{.*\}', response, re.DOTALL)
        if json_match: suggestions = json.loads(json_match.group())
        else: suggestions = {"additions": [], "swaps": [], "explanation": response}
    except Exception as e:
        logger.error(f"AI fix-meal error: {e}")
        key_foods = []
        for goal in user_goals: key_foods.extend(GOAL_PROFILES.get(goal, {}).get("key_foods", [])[:3])
        suggestions = {"additions": [{"food": f, "portion_g": 100, "reason": "Recommended for your goals", "fixes_elements": []} for f in key_foods[:3]], "swaps": [], "explanation": "Based on your goals, these foods would help improve your elemental balance."}
    return {"suggestions": suggestions}


@router.post("/molecular/generate-meal")
async def generate_optimal_meal(request: Request, user: User = Depends(require_user)):
    body = await request.json()
    user_goals = body.get("goals", ["muscle_gain"])
    meal_type = body.get("meal_type", "lunch")
    num_foods = body.get("num_foods", 5)
    all_key_foods, all_synergies, goals_text = [], [], []
    for goal in user_goals:
        profile = GOAL_PROFILES.get(goal, {})
        all_key_foods.extend(profile.get("key_foods", []))
        all_synergies.extend(profile.get("synergy_pairs", []))
        goals_text.append(profile.get("name", goal))
    prompt = f"""Create an OPTIMAL {meal_type} meal with {num_foods} foods for goals: {', '.join(goals_text)}.
Key foods: {', '.join(set(all_key_foods))}
Respond in JSON: {{"meal_name": "", "foods": [{{"food_name": "", "portion_g": 150, "cooking_method": "", "key_elements": [], "goal_contribution": ""}}], "synergies": [], "elemental_reasoning": "", "estimated_macros": {{"protein_g": 40, "carbs_g": 50, "fat_g": 20, "calories": 540}}}}"""
    try:
        from emergentintegrations.llm.chat import ChatMessage, chat
        messages = [ChatMessage(role="system", content="You are a molecular nutrition AI. Always respond with valid JSON."), ChatMessage(role="user", content=prompt)]
        response = await chat(api_key=EMERGENT_LLM_KEY, model="gemini-2.0-flash", messages=messages, temperature=0.4)
        json_match = re.search(r'\{.*\}', response, re.DOTALL)
        if json_match: meal = json.loads(json_match.group())
        else: meal = {"meal_name": "AI Generated Meal", "foods": [], "synergies": [], "elemental_reasoning": response, "estimated_macros": {}}
    except Exception as e:
        logger.error(f"AI generate-meal error: {e}")
        foods = [{"food_name": f, "portion_g": 150, "cooking_method": "steaming", "key_elements": [], "goal_contribution": "Supports your goals"} for f in all_key_foods[:num_foods]]
        meal = {"meal_name": f"Optimized {meal_type.title()}", "foods": foods, "synergies": [s["reason"] for s in all_synergies[:3]], "elemental_reasoning": "Combined for optimal elemental balance", "estimated_macros": {}}
    return {"meal": meal, "goals": goals_text}


@router.post("/molecular/suggest-combinations")
async def suggest_food_combinations(request: Request, user: User = Depends(require_user)):
    body = await request.json()
    user_goals = body.get("goals", ["muscle_gain"])
    result = {"goals": {}}
    for goal in user_goals:
        profile = GOAL_PROFILES.get(goal)
        if not profile: continue
        result["goals"][goal] = {"name": profile["name"], "description": profile["description"], "key_foods": profile["key_foods"], "synergy_pairs": profile["synergy_pairs"], "ideal_macro_ratio": profile["ideal_macro_ratio"], "priority_elements": list(profile["priority_elements"].keys())}
    return result
