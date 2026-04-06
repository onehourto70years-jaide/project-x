"""
NutriOS — Food Consumption Sequence Optimizer

Science-based engine that determines the optimal order to eat foods
for maximum nutrient absorption, digestion efficiency, and biochemical synergy.
"""

from fastapi import APIRouter, Depends
from typing import Optional, List, Dict, Any
from pydantic import BaseModel
from datetime import datetime, timezone
import json
import uuid

from database import db
from dependencies import require_user, get_current_user_optional
from models import User
from config import logger, EMERGENT_LLM_KEY

router = APIRouter(tags=["sequence-optimizer"])


# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
# MODELS
# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

class FoodItem(BaseModel):
    name: str
    portion_grams: float = 100
    category: Optional[str] = None          # user-supplied hint
    nutrients: Optional[Dict[str, float]] = None  # optional pre-loaded

class OptimizeRequest(BaseModel):
    foods: List[FoodItem]
    mode: str = "health"          # "health" or "performance"
    goal: Optional[str] = None    # muscle_gain, fat_loss, energy, digestion

class SequenceStep(BaseModel):
    phase: int
    phase_name: str
    food_name: str
    reasoning: str
    benefits: List[str]
    wait_minutes: int = 0         # suggested wait before next phase

class OptimizeResponse(BaseModel):
    sequence: List[SequenceStep]
    insights: List[Dict[str, str]]
    mode: str
    total_foods: int
    science_summary: str


# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
# NUTRITIONAL SCIENCE KNOWLEDGE BASE
# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

# Food classification rules
FOOD_CATEGORIES = {
    "fiber_rich": {
        "keywords": ["spinach", "kale", "broccoli", "salad", "lettuce", "cabbage",
                      "celery", "cucumber", "zucchini", "asparagus", "green bean",
                      "bell pepper", "carrot", "beet", "artichoke", "brussels sprout",
                      "cauliflower", "eggplant", "onion", "mushroom", "tomato",
                      "arugula", "chard", "collard", "okra", "radish", "turnip",
                      "beans", "lentils", "chickpea", "peas", "edamame",
                      "oats", "oatmeal", "bran", "whole grain", "quinoa",
                      "flax", "chia", "psyllium", "avocado"],
        "phase": 1,
        "digestion_speed": "medium",
        "gi_estimate": "low",
    },
    "protein_rich": {
        "keywords": ["chicken", "turkey", "beef", "steak", "pork", "lamb",
                      "fish", "salmon", "tuna", "shrimp", "crab", "lobster",
                      "egg", "tofu", "tempeh", "seitan",
                      "whey", "casein", "protein powder", "protein shake",
                      "cottage cheese", "greek yogurt",
                      "duck", "venison", "bison", "sardine", "mackerel",
                      "cod", "tilapia", "trout", "swordfish"],
        "phase": 2,
        "digestion_speed": "slow",
        "gi_estimate": "low",
    },
    "healthy_fat": {
        "keywords": ["olive oil", "coconut oil", "butter", "ghee",
                      "almonds", "walnut", "cashew", "pecan", "pistachio",
                      "peanut butter", "almond butter", "tahini",
                      "avocado", "coconut", "dark chocolate",
                      "cheese", "cream cheese", "heavy cream",
                      "flaxseed oil", "hemp seed", "sunflower seed",
                      "pumpkin seed", "macadamia", "brazil nut"],
        "phase": 2,
        "digestion_speed": "slow",
        "gi_estimate": "low",
    },
    "complex_carb": {
        "keywords": ["rice", "brown rice", "wild rice", "pasta", "noodle",
                      "bread", "whole wheat", "tortilla", "pita",
                      "potato", "sweet potato", "yam", "corn",
                      "barley", "millet", "buckwheat", "amaranth",
                      "couscous", "bulgur", "farro", "spelt"],
        "phase": 3,
        "digestion_speed": "medium",
        "gi_estimate": "medium",
    },
    "simple_carb": {
        "keywords": ["white bread", "white rice", "sugar", "candy",
                      "cookie", "cake", "pastry", "donut", "muffin",
                      "soda", "juice", "syrup", "honey", "jam",
                      "ice cream", "chocolate milk", "cereal",
                      "cracker", "pretzel", "chips", "fries", "french fries"],
        "phase": 4,
        "digestion_speed": "fast",
        "gi_estimate": "high",
    },
    "fruit": {
        "keywords": ["apple", "banana", "orange", "grape", "berry",
                      "strawberry", "blueberry", "raspberry", "blackberry",
                      "mango", "pineapple", "papaya", "melon", "watermelon",
                      "cantaloupe", "kiwi", "peach", "pear", "plum",
                      "cherry", "fig", "date", "pomegranate", "lychee",
                      "grapefruit", "tangerine", "lemon", "lime",
                      "passion fruit", "guava", "dragon fruit"],
        "phase": 3,
        "digestion_speed": "fast",
        "gi_estimate": "medium",
    },
    "dairy": {
        "keywords": ["milk", "yogurt", "cheese", "cream", "kefir",
                      "cottage cheese", "ricotta", "mozzarella",
                      "cheddar", "parmesan", "feta", "brie",
                      "sour cream", "whipped cream", "ice cream"],
        "phase": 2,
        "digestion_speed": "medium",
        "gi_estimate": "low",
    },
    "fermented": {
        "keywords": ["yogurt", "kefir", "sauerkraut", "kimchi",
                      "kombucha", "miso", "tempeh", "natto",
                      "pickle", "vinegar", "apple cider vinegar"],
        "phase": 1,
        "digestion_speed": "fast",
        "gi_estimate": "low",
    },
    "liquid": {
        "keywords": ["water", "tea", "coffee", "broth", "soup",
                      "smoothie", "shake", "lemon water"],
        "phase": 0,
        "digestion_speed": "fast",
        "gi_estimate": "low",
    },
}

# Nutrient synergy rules (positive interactions)
NUTRIENT_SYNERGIES = [
    {
        "pair": ["iron", "vitamin_c"],
        "foods_a": ["spinach", "lentil", "beef", "bean", "tofu", "kale", "chickpea"],
        "foods_b": ["lemon", "orange", "bell pepper", "tomato", "strawberry", "broccoli", "kiwi", "grapefruit"],
        "benefit": "Vitamin C increases non-heme iron absorption by up to 6x",
        "boost_percent": 30,
        "action": "Eat vitamin C-rich food close to iron-rich food",
    },
    {
        "pair": ["fat", "fat_soluble_vitamins"],
        "foods_a": ["olive oil", "avocado", "butter", "nuts", "cheese", "coconut oil", "almond", "walnut"],
        "foods_b": ["carrot", "sweet potato", "spinach", "kale", "mango", "egg", "broccoli", "tomato", "bell pepper"],
        "benefit": "Dietary fat enhances absorption of vitamins A, D, E, K and carotenoids by 3-5x",
        "boost_percent": 40,
        "action": "Add healthy fat when eating colorful vegetables",
    },
    {
        "pair": ["protein", "leucine"],
        "foods_a": ["whey", "egg", "chicken", "beef", "fish", "greek yogurt", "cottage cheese"],
        "foods_b": ["rice", "potato", "oats", "bread"],
        "benefit": "Complete protein with carbs maximizes muscle protein synthesis via insulin + amino acid synergy",
        "boost_percent": 25,
        "action": "Combine lean protein with carbs post-workout",
    },
    {
        "pair": ["calcium", "vitamin_d"],
        "foods_a": ["milk", "yogurt", "cheese", "kefir", "sardine", "broccoli", "kale"],
        "foods_b": ["salmon", "egg", "mushroom", "fortified"],
        "benefit": "Vitamin D increases calcium absorption in the intestine by 30-40%",
        "boost_percent": 35,
        "action": "Pair calcium-rich foods with vitamin D sources",
    },
    {
        "pair": ["turmeric", "black_pepper"],
        "foods_a": ["turmeric", "curry"],
        "foods_b": ["black pepper", "pepper"],
        "benefit": "Piperine in black pepper increases curcumin bioavailability by 2000%",
        "boost_percent": 50,
        "action": "Always add black pepper when using turmeric",
    },
    {
        "pair": ["fiber", "probiotics"],
        "foods_a": ["oats", "banana", "asparagus", "garlic", "onion", "beans", "lentils"],
        "foods_b": ["yogurt", "kefir", "sauerkraut", "kimchi", "kombucha", "miso"],
        "benefit": "Prebiotic fiber feeds probiotics, enhancing gut colonization and diversity",
        "boost_percent": 20,
        "action": "Eat prebiotic foods before or with probiotic foods",
    },
]

# Nutrient conflict rules (negative interactions)
NUTRIENT_CONFLICTS = [
    {
        "pair": ["calcium", "iron"],
        "foods_a": ["milk", "yogurt", "cheese", "calcium supplement"],
        "foods_b": ["spinach", "lentil", "beef", "bean", "tofu", "kale", "liver"],
        "issue": "Calcium inhibits both heme and non-heme iron absorption by 50-60%",
        "reduction_percent": 50,
        "action": "Separate calcium and iron-rich foods by at least 2 hours",
    },
    {
        "pair": ["tannins", "iron"],
        "foods_a": ["tea", "coffee", "red wine", "dark chocolate"],
        "foods_b": ["spinach", "lentil", "beef", "bean", "tofu", "liver"],
        "issue": "Tannins and polyphenols bind to iron, reducing absorption by 60-70%",
        "reduction_percent": 60,
        "action": "Avoid tea/coffee within 1 hour of iron-rich meals",
    },
    {
        "pair": ["phytates", "zinc"],
        "foods_a": ["whole grain", "bran", "soy", "corn"],
        "foods_b": ["oyster", "beef", "pumpkin seed", "cashew", "chicken"],
        "issue": "Phytic acid chelates zinc and reduces its bioavailability by 40-50%",
        "reduction_percent": 40,
        "action": "Soak or sprout grains before pairing with zinc-rich foods",
    },
    {
        "pair": ["oxalates", "calcium"],
        "foods_a": ["spinach", "rhubarb", "beet greens", "swiss chard"],
        "foods_b": ["milk", "yogurt", "cheese", "tofu"],
        "issue": "Oxalic acid binds calcium forming insoluble crystals, reducing absorption",
        "reduction_percent": 35,
        "action": "Don't rely on high-oxalate greens as primary calcium source",
    },
]

# Phase definitions
PHASES = {
    0: {"name": "Pre-Meal Primer", "icon": "💧", "description": "Liquids and digestive primers to activate enzymes"},
    1: {"name": "Fiber & Vegetables First", "icon": "🥬", "description": "Fiber creates a gel matrix that slows sugar absorption"},
    2: {"name": "Proteins & Healthy Fats", "icon": "🥩", "description": "Protein triggers satiety hormones; fats slow gastric emptying"},
    3: {"name": "Complex Carbohydrates", "icon": "🍚", "description": "Carbs eaten after fiber/protein cause smaller glucose spikes"},
    4: {"name": "Simple Sugars Last", "icon": "🍬", "description": "Simple carbs at the end minimize insulin spikes"},
}

# Performance mode adjustments
PERFORMANCE_ADJUSTMENTS = {
    "muscle_gain": {
        "phase_order": [0, 1, 3, 2, 4],  # carbs before protein for insulin spike
        "reasoning": "Carbs before protein creates an insulin environment that drives amino acids into muscle",
    },
    "fat_loss": {
        "phase_order": [0, 1, 2, 3, 4],  # standard order, protein first
        "reasoning": "Protein and fiber first maximize satiety and thermogenesis",
    },
    "energy": {
        "phase_order": [0, 3, 2, 1, 4],  # quick carbs for immediate energy
        "reasoning": "Fast-absorbing carbs first provide immediate energy, then sustained release",
    },
    "digestion": {
        "phase_order": [0, 1, 2, 3, 4],  # standard digestive order
        "reasoning": "Following the natural digestive cascade for optimal enzyme activation",
    },
}


# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
# CLASSIFICATION ENGINE
# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

def classify_food(food_name: str, nutrients: Optional[Dict] = None) -> Dict[str, Any]:
    """Classify a food item into a category and phase."""
    name_lower = food_name.lower()

    # Check each category for keyword matches
    best_match = None
    best_score = 0

    for cat_name, cat_data in FOOD_CATEGORIES.items():
        for keyword in cat_data["keywords"]:
            if keyword in name_lower:
                score = len(keyword)  # longer match = more specific
                if score > best_score:
                    best_score = score
                    best_match = cat_name

    # Fallback: use nutrient profile if available
    if not best_match and nutrients:
        protein = nutrients.get("protein_g", 0)
        fat = nutrients.get("fat_g", 0)
        carbs = nutrients.get("carbohydrate_g", 0)
        fiber = nutrients.get("fiber_g", 0)

        if fiber > 5:
            best_match = "fiber_rich"
        elif protein > 15:
            best_match = "protein_rich"
        elif fat > 15:
            best_match = "healthy_fat"
        elif carbs > 30:
            best_match = "complex_carb"
        else:
            best_match = "complex_carb"  # default

    if not best_match:
        best_match = "complex_carb"  # safe default

    cat = FOOD_CATEGORIES[best_match]
    return {
        "category": best_match,
        "phase": cat["phase"],
        "digestion_speed": cat["digestion_speed"],
        "gi_estimate": cat["gi_estimate"],
    }


def detect_synergies(foods: List[Dict]) -> List[Dict]:
    """Detect positive nutrient synergies between foods."""
    found = []
    food_names = [f["name"].lower() for f in foods]

    for synergy in NUTRIENT_SYNERGIES:
        group_a = [n for n in food_names if any(kw in n for kw in synergy["foods_a"])]
        group_b = [n for n in food_names if any(kw in n for kw in synergy["foods_b"])]

        if group_a and group_b:
            found.append({
                "type": "synergy",
                "icon": "✅",
                "foods": group_a[:2] + group_b[:2],
                "benefit": synergy["benefit"],
                "boost_percent": synergy["boost_percent"],
                "action": synergy["action"],
            })

    return found


def detect_conflicts(foods: List[Dict]) -> List[Dict]:
    """Detect nutrient conflicts between foods."""
    found = []
    food_names = [f["name"].lower() for f in foods]

    for conflict in NUTRIENT_CONFLICTS:
        group_a = [n for n in food_names if any(kw in n for kw in conflict["foods_a"])]
        group_b = [n for n in food_names if any(kw in n for kw in conflict["foods_b"])]

        if group_a and group_b:
            found.append({
                "type": "conflict",
                "icon": "⚠️",
                "foods": group_a[:2] + group_b[:2],
                "issue": conflict["issue"],
                "reduction_percent": conflict["reduction_percent"],
                "action": conflict["action"],
            })

    return found


# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
# SEQUENCE OPTIMIZER ALGORITHM
# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

def optimize_sequence(foods: List[FoodItem], mode: str = "health", goal: Optional[str] = None) -> Dict:
    """Core algorithm: determine optimal eating order."""

    # Step 1: Classify each food
    classified = []
    for food in foods:
        classification = classify_food(food.name, food.nutrients)
        classified.append({
            "name": food.name,
            "portion_grams": food.portion_grams,
            **classification,
        })

    # Step 2: Determine phase order based on mode/goal
    if mode == "performance" and goal in PERFORMANCE_ADJUSTMENTS:
        phase_order = PERFORMANCE_ADJUSTMENTS[goal]["phase_order"]
        mode_reasoning = PERFORMANCE_ADJUSTMENTS[goal]["reasoning"]
    else:
        phase_order = [0, 1, 2, 3, 4]
        mode_reasoning = "Standard digestive-optimized order: fiber first to create a protective gel layer, then proteins and fats for satiety, then carbohydrates for minimized glucose response."

    # Step 3: Sort foods into phases
    phase_buckets: Dict[int, List[Dict]] = {p: [] for p in range(5)}
    for item in classified:
        phase_buckets[item["phase"]].append(item)

    # Step 4: Within each phase, sort by digestion speed (fast first within phase)
    speed_order = {"fast": 0, "medium": 1, "slow": 2}
    for phase in phase_buckets:
        phase_buckets[phase].sort(key=lambda x: speed_order.get(x["digestion_speed"], 1))

    # Step 5: Build the ordered sequence
    sequence = []
    step_num = 0

    for phase_idx in phase_order:
        phase_foods = phase_buckets.get(phase_idx, [])
        if not phase_foods:
            continue

        phase_info = PHASES[phase_idx]

        for food_item in phase_foods:
            step_num += 1
            reasoning = _generate_reasoning(food_item, phase_idx, mode, goal)
            benefits = _generate_benefits(food_item, phase_idx, classified)

            sequence.append({
                "step": step_num,
                "phase": phase_idx,
                "phase_name": f"{phase_info['icon']} {phase_info['name']}",
                "food_name": food_item["name"],
                "portion_grams": food_item["portion_grams"],
                "category": food_item["category"],
                "digestion_speed": food_item["digestion_speed"],
                "gi_estimate": food_item["gi_estimate"],
                "reasoning": reasoning,
                "benefits": benefits,
                "wait_minutes": 5 if step_num < len(classified) and phase_idx != phase_order[-1] else 0,
            })

    # Step 6: Detect synergies and conflicts
    synergies = detect_synergies(classified)
    conflicts = detect_conflicts(classified)

    # Step 7: Generate smart insights
    insights = _generate_insights(classified, synergies, conflicts, mode, goal)

    return {
        "sequence": sequence,
        "synergies": synergies,
        "conflicts": conflicts,
        "insights": insights,
        "mode": mode,
        "goal": goal,
        "mode_reasoning": mode_reasoning,
        "total_foods": len(foods),
        "total_phases": len(set(s["phase"] for s in sequence)),
    }


def _generate_reasoning(food: Dict, phase: int, mode: str, goal: Optional[str]) -> str:
    """Generate scientific reasoning for why a food is in this position."""
    cat = food["category"]
    name = food["name"]

    reasons = {
        "liquid": f"Starting with {name} activates digestive enzymes and hydrates the stomach lining, preparing it for optimal nutrient extraction.",
        "fermented": f"{name} contains live cultures and organic acids that prime the digestive tract, lowering stomach pH for better protein digestion.",
        "fiber_rich": f"Eating {name} early creates a viscous fiber matrix in the stomach. Research shows this can reduce post-meal glucose spikes by 30-40% and slow gastric emptying.",
        "protein_rich": f"{name} in this position triggers CCK and GLP-1 satiety hormones. Protein eaten after fiber is digested more slowly, improving amino acid absorption by ~25%.",
        "healthy_fat": f"{name} here slows gastric emptying, providing sustained energy. Fat at this stage enhances absorption of any fat-soluble vitamins (A, D, E, K) from earlier vegetables.",
        "dairy": f"{name} provides calcium and protein. Positioned here to avoid interfering with iron absorption from earlier foods.",
        "complex_carb": f"Eating {name} after protein and fiber significantly blunts the glycemic response. Studies show this ordering can reduce blood glucose spikes by up to 40% compared to eating carbs first.",
        "fruit": f"{name} contains natural sugars and micronutrients. Eaten at this stage, the fiber from earlier foods moderates fructose absorption.",
        "simple_carb": f"{name} is positioned last because simple carbohydrates eaten after fiber, protein, and fat have a dramatically reduced glycemic impact — the protective food matrix is already in place.",
    }

    return reasons.get(cat, f"{name} is optimally placed at phase {phase + 1} based on its macronutrient profile and digestion speed.")


def _generate_benefits(food: Dict, phase: int, all_foods: List[Dict]) -> List[str]:
    """Generate expected benefits for this food's position."""
    benefits = []
    cat = food["category"]

    if cat == "fiber_rich":
        benefits.append("Reduced glucose spike by ~35%")
        benefits.append("Enhanced satiety signaling")
    elif cat == "protein_rich":
        benefits.append("Optimized amino acid absorption")
        benefits.append("Extended satiety (3-4 hours)")
    elif cat == "healthy_fat":
        benefits.append("Enhanced fat-soluble vitamin absorption")
        benefits.append("Sustained energy release")
    elif cat in ("complex_carb", "simple_carb"):
        benefits.append("Minimized insulin spike")
        benefits.append("Steady energy without crash")
    elif cat == "fermented":
        benefits.append("Improved digestive enzyme activation")
        benefits.append("Better nutrient bioavailability")
    elif cat == "fruit":
        benefits.append("Antioxidant boost with controlled fructose")
    elif cat == "liquid":
        benefits.append("Digestive system primed")

    return benefits


def _generate_insights(classified: List[Dict], synergies: List, conflicts: List, mode: str, goal: Optional[str]) -> List[Dict]:
    """Generate smart, actionable insights."""
    insights = []

    # Synergy insights
    for syn in synergies:
        insights.append({
            "type": "synergy",
            "icon": "🔗",
            "title": f"Nutrient Synergy Detected",
            "message": syn["benefit"],
            "action": syn["action"],
            "impact": f"+{syn['boost_percent']}% absorption",
        })

    # Conflict insights
    for conf in conflicts:
        insights.append({
            "type": "conflict",
            "icon": "⚠️",
            "title": "Nutrient Conflict Warning",
            "message": conf["issue"],
            "action": conf["action"],
            "impact": f"-{conf['reduction_percent']}% absorption",
        })

    # General insights based on meal composition
    categories = [f["category"] for f in classified]

    if "fiber_rich" not in categories:
        insights.append({
            "type": "suggestion",
            "icon": "💡",
            "title": "Add Fiber",
            "message": "Your meal lacks fiber-rich foods. Adding vegetables or legumes before carbs would significantly reduce glucose spikes.",
            "action": "Consider adding a side salad or steamed vegetables",
            "impact": "Could reduce glucose spike by 30%",
        })

    if "protein_rich" not in categories and "dairy" not in categories:
        insights.append({
            "type": "suggestion",
            "icon": "💡",
            "title": "Add Protein",
            "message": "No significant protein source detected. Adding protein increases satiety and supports muscle maintenance.",
            "action": "Add eggs, chicken, fish, or legumes",
            "impact": "Extends satiety by 2-3 hours",
        })

    if "healthy_fat" not in categories and any(c in categories for c in ["fiber_rich"]):
        insights.append({
            "type": "suggestion",
            "icon": "💡",
            "title": "Add Healthy Fat",
            "message": "Your vegetables would benefit from a fat source to enhance absorption of fat-soluble vitamins A, D, E, K.",
            "action": "Add olive oil, avocado, or nuts",
            "impact": "+300% carotenoid absorption",
        })

    # Mode-specific insights
    if mode == "performance" and goal == "muscle_gain":
        insights.append({
            "type": "performance",
            "icon": "💪",
            "title": "Performance Mode: Muscle Gain",
            "message": "Sequence adjusted: carbs positioned before protein to create an insulin-driven anabolic window.",
            "action": "Eat within 2 hours of training for best results",
            "impact": "Enhanced muscle protein synthesis",
        })
    elif mode == "performance" and goal == "fat_loss":
        insights.append({
            "type": "performance",
            "icon": "🔥",
            "title": "Performance Mode: Fat Loss",
            "message": "Protein and fiber prioritized first to maximize thermogenesis and satiety hormones (CCK, PYY, GLP-1).",
            "action": "Eat slowly — 20 min minimum per meal",
            "impact": "Reduced caloric intake by 15-20%",
        })

    return insights


# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
# AI-ENHANCED EXPLANATIONS
# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

async def generate_ai_summary(sequence: List[Dict], mode: str, goal: Optional[str]) -> str:
    """Use Gemini to generate a natural-language summary of the sequence."""
    try:
        from emergentintegrations.llm.chat import LlmChat, UserMessage

        food_list = ", ".join([s["food_name"] for s in sequence])
        order_desc = " → ".join([f'{s["step"]}. {s["food_name"]}' for s in sequence])

        prompt = f"""You are a molecular nutrition expert. A user has the following foods: {food_list}.
The optimal eating sequence is: {order_desc}.
Mode: {mode}. Goal: {goal or 'general health'}.

Write a brief (3-4 sentences), warm, science-backed explanation of WHY this order maximizes nutrient absorption and health benefits. 
Mention specific mechanisms like glycemic response, enzyme activation, and nutrient synergies.
Use 1-2 emojis. Be concise and actionable."""

        chat = LlmChat(
            api_key=EMERGENT_LLM_KEY,
            session_id=f"seq_{uuid.uuid4().hex[:8]}",
            system_message="You are a molecular nutrition expert. Be concise, scientific, and friendly."
        ).with_model("gemini", "gemini-3-flash-preview")

        response = await chat.send_message(UserMessage(text=prompt))
        return response.strip()
    except Exception as e:
        logger.error(f"AI summary error: {e}")
        return "Follow this science-based sequence to optimize your nutrient absorption. Fiber and vegetables first create a protective matrix, protein and fats second for satiety, and carbohydrates last for minimized glucose response."


# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
# API ENDPOINTS
# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

@router.post("/sequence/optimize")
async def optimize_meal_sequence(request: OptimizeRequest, user: User = Depends(require_user)):
    """Determine the optimal eating order for a set of foods."""

    if not request.foods or len(request.foods) < 2:
        return {"error": "Please provide at least 2 foods to optimize the eating sequence."}

    # Run the optimizer
    result = optimize_sequence(request.foods, request.mode, request.goal)

    # Generate AI summary
    ai_summary = await generate_ai_summary(result["sequence"], request.mode, request.goal)
    result["ai_summary"] = ai_summary

    # Save to history
    await db.sequence_history.insert_one({
        "user_id": user.user_id,
        "foods": [f.dict() for f in request.foods],
        "mode": request.mode,
        "goal": request.goal,
        "result": {
            "sequence": result["sequence"],
            "insights_count": len(result["insights"]),
            "synergies_count": len(result["synergies"]),
            "conflicts_count": len(result["conflicts"]),
        },
        "created_at": datetime.now(timezone.utc),
    })

    return result


@router.get("/sequence/rules")
async def get_sequence_rules():
    """Return the knowledge base rules for the optimizer."""
    return {
        "phases": {str(k): v for k, v in PHASES.items()},
        "synergy_count": len(NUTRIENT_SYNERGIES),
        "conflict_count": len(NUTRIENT_CONFLICTS),
        "categories": list(FOOD_CATEGORIES.keys()),
        "modes": ["health", "performance"],
        "goals": list(PERFORMANCE_ADJUSTMENTS.keys()),
        "synergies": [{"pair": s["pair"], "benefit": s["benefit"], "boost_percent": s["boost_percent"]} for s in NUTRIENT_SYNERGIES],
        "conflicts": [{"pair": c["pair"], "issue": c["issue"], "reduction_percent": c["reduction_percent"]} for c in NUTRIENT_CONFLICTS],
    }


@router.get("/sequence/history")
async def get_sequence_history(user: User = Depends(require_user)):
    """Get user's past sequence optimizations."""
    history = await db.sequence_history.find(
        {"user_id": user.user_id}, {"_id": 0}
    ).sort("created_at", -1).to_list(20)
    return {"history": history}


@router.post("/sequence/from-today")
async def optimize_today_meals(user: User = Depends(require_user), mode: str = "health", goal: Optional[str] = None):
    """Auto-optimize today's logged meals."""
    today = datetime.now(timezone.utc).strftime("%Y-%m-%d")
    meals = await db.meals.find({"user_id": user.user_id, "date": today}, {"_id": 0}).to_list(100)

    if len(meals) < 2:
        return {"error": "You need at least 2 logged meals today to optimize. Log more foods first!"}

    foods = [
        FoodItem(
            name=m.get("food_name", "Unknown"),
            portion_grams=m.get("portion_grams", 100),
            nutrients=m.get("nutrients"),
        )
        for m in meals
    ]

    result = optimize_sequence(foods, mode, goal)
    ai_summary = await generate_ai_summary(result["sequence"], mode, goal)
    result["ai_summary"] = ai_summary
    return result
