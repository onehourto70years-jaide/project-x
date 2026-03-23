from fastapi import FastAPI, APIRouter, HTTPException, Request, Response, Depends
from dotenv import load_dotenv
from starlette.middleware.cors import CORSMiddleware
from motor.motor_asyncio import AsyncIOMotorClient
import os
import logging
from pathlib import Path
from pydantic import BaseModel, Field
from typing import List, Optional, Dict, Any
import uuid
from datetime import datetime, timezone, timedelta
import httpx
import json

ROOT_DIR = Path(__file__).parent
load_dotenv(ROOT_DIR / '.env')

# MongoDB connection
mongo_url = os.environ['MONGO_URL']
client = AsyncIOMotorClient(mongo_url)
db = client[os.environ.get('DB_NAME', 'nutrient_mapper')]

# API Keys
USDA_API_KEY = "RwaqOhfPSJZJVfvVB0jc71rXAS0yjQbtvRSnudXk"
USDA_BASE_URL = "https://api.nal.usda.gov/fdc/v1"
EMERGENT_LLM_KEY = os.environ.get('EMERGENT_LLM_KEY', 'sk-emergent-16f3b56Af3500F2517')

# Create the main app
app = FastAPI(title="NutriMolecule - Personal Health OS")
api_router = APIRouter(prefix="/api")

logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(name)s - %(levelname)s - %(message)s')
logger = logging.getLogger(__name__)

# ================== CONSTANTS ==================

ELEMENTAL_FRACTIONS = {
    "protein": {"C": 0.50, "H": 0.07, "O": 0.22, "N": 0.16, "S": 0.02},
    "carbohydrate": {"C": 0.40, "H": 0.067, "O": 0.533},
    "fat": {"C": 0.76, "H": 0.123, "O": 0.117}
}

ATOMIC_WEIGHTS = {"C": 12.011, "H": 1.008, "O": 15.999, "N": 14.007, "S": 32.065, "Na": 22.990, "K": 39.098, "Ca": 40.078, "Fe": 55.845, "Zn": 65.38, "Mg": 24.305, "P": 30.974}

RETENTION_FACTORS = {
    "boiling": {"vitamin_a": 0.75, "vitamin_c": 0.45, "iron": 0.90, "magnesium": 0.75, "potassium": 0.70, "zinc": 0.85, "calcium": 0.80, "protein": 0.95},
    "steaming": {"vitamin_a": 0.90, "vitamin_c": 0.70, "iron": 0.95, "magnesium": 0.90, "potassium": 0.85, "zinc": 0.95, "calcium": 0.90, "protein": 0.98},
    "frying": {"vitamin_a": 0.80, "vitamin_c": 0.50, "iron": 0.85, "magnesium": 0.85, "potassium": 0.80, "zinc": 0.90, "calcium": 0.85, "protein": 0.92},
    "baking": {"vitamin_a": 0.85, "vitamin_c": 0.55, "iron": 0.90, "magnesium": 0.88, "potassium": 0.82, "zinc": 0.92, "calcium": 0.88, "protein": 0.95},
    "raw": {"vitamin_a": 1.0, "vitamin_c": 1.0, "iron": 1.0, "magnesium": 1.0, "potassium": 1.0, "zinc": 1.0, "calcium": 1.0, "protein": 1.0}
}

SAFE_COOKING_TEMPS = {"poultry": {"fahrenheit": 165, "celsius": 74}, "ground_meat": {"fahrenheit": 160, "celsius": 71}, "fish": {"fahrenheit": 145, "celsius": 63}}

ALLERGENS = ["peanut", "peanuts", "tree nut", "almond", "walnut", "milk", "dairy", "lactose", "cheese", "egg", "eggs", "wheat", "gluten", "soy", "fish", "salmon", "shellfish", "shrimp", "sesame"]

BIOLOGICAL_EFFECTS = {"C": ["Energy metabolism", "Cell structure"], "H": ["Cellular hydration"], "O": ["Cellular respiration"], "N": ["Protein synthesis"], "S": ["Protein structure"], "Fe": ["Oxygen transport"], "Ca": ["Bone health"], "K": ["Heart rhythm"], "Mg": ["Enzyme activation"], "Zn": ["Immune function"]}

DAILY_RECOMMENDED = {"energy_kcal": 2000, "protein_g": 50, "carbohydrate_g": 275, "fat_g": 78, "fiber_g": 28, "vitamin_a_mcg": 900, "vitamin_c_mg": 90, "iron_mg": 18, "calcium_mg": 1000, "magnesium_mg": 400, "potassium_mg": 4700, "zinc_mg": 11}

# ================== PYDANTIC MODELS ==================

class User(BaseModel):
    user_id: str
    email: str
    name: str
    picture: Optional[str] = None
    created_at: datetime
    weight_kg: Optional[float] = 70.0
    activity_level: Optional[str] = "moderate"
    health_goals: Optional[List[str]] = []

class MealEntryCreate(BaseModel):
    fdc_id: Optional[int] = None
    food_name: str
    portion_grams: float
    meal_type: str
    cooking_method: str = "raw"
    nutrients: Dict[str, float] = {}
    elements: Dict[str, float] = {}
    allergens: List[str] = []

class WaterLogCreate(BaseModel):
    amount_ml: int

class RoutineCreate(BaseModel):
    name: str
    type: str
    time_start: str
    time_end: str
    days: List[str] = ["mon", "tue", "wed", "thu", "fri", "sat", "sun"]
    tasks: List[Dict[str, Any]] = []

class RecipeCreate(BaseModel):
    name: str
    description: Optional[str] = ""
    ingredients: List[Dict[str, Any]] = []  # [{fdc_id, food_name, portion_grams, cooking_method}]
    servings: int = 1
    prep_time_mins: Optional[int] = 0
    cook_time_mins: Optional[int] = 0
    instructions: Optional[List[str]] = []

class MealPlanCreate(BaseModel):
    date: str  # YYYY-MM-DD
    meal_type: str
    recipe_id: Optional[str] = None
    food_name: Optional[str] = None
    notes: Optional[str] = ""

class FavoriteCreate(BaseModel):
    fdc_id: int
    food_name: str
    default_portion_grams: float = 100
    default_cooking_method: str = "raw"

class AIRecommendationRequest(BaseModel):
    goal: str
    current_foods: Optional[List[str]] = []
    dietary_restrictions: Optional[List[str]] = []

# ================== AUTH HELPERS ==================

async def get_current_user(request: Request) -> Optional[User]:
    session_token = request.cookies.get("session_token")
    if not session_token:
        auth_header = request.headers.get("Authorization")
        if auth_header and auth_header.startswith("Bearer "):
            session_token = auth_header.split(" ")[1]
    if not session_token:
        return None
    session_doc = await db.user_sessions.find_one({"session_token": session_token}, {"_id": 0})
    if not session_doc:
        return None
    expires_at = session_doc.get("expires_at")
    if isinstance(expires_at, str):
        expires_at = datetime.fromisoformat(expires_at)
    if expires_at.tzinfo is None:
        expires_at = expires_at.replace(tzinfo=timezone.utc)
    if expires_at < datetime.now(timezone.utc):
        return None
    user_doc = await db.users.find_one({"user_id": session_doc["user_id"]}, {"_id": 0})
    if not user_doc:
        return None
    return User(**user_doc)

async def require_user(request: Request) -> User:
    user = await get_current_user(request)
    if not user:
        raise HTTPException(status_code=401, detail="Not authenticated")
    return user

# ================== AUTH ENDPOINTS ==================

@api_router.post("/auth/session")
async def create_session(request: Request, response: Response):
    body = await request.json()
    session_id = body.get("session_id")
    if not session_id:
        raise HTTPException(status_code=400, detail="session_id required")
    async with httpx.AsyncClient() as client_http:
        auth_response = await client_http.get("https://demobackend.emergentagent.com/auth/v1/env/oauth/session-data", headers={"X-Session-ID": session_id})
        if auth_response.status_code != 200:
            raise HTTPException(status_code=401, detail="Invalid session")
        user_data = auth_response.json()
    email, name, picture, session_token = user_data.get("email"), user_data.get("name"), user_data.get("picture"), user_data.get("session_token")
    existing_user = await db.users.find_one({"email": email}, {"_id": 0})
    if existing_user:
        user_id = existing_user["user_id"]
        await db.users.update_one({"user_id": user_id}, {"$set": {"name": name, "picture": picture}})
    else:
        user_id = f"user_{uuid.uuid4().hex[:12]}"
        await db.users.insert_one({"user_id": user_id, "email": email, "name": name, "picture": picture, "created_at": datetime.now(timezone.utc), "weight_kg": 70.0, "activity_level": "moderate", "health_goals": []})
        await db.user_settings.insert_one({"user_id": user_id, "daily_water_goal_ml": 2500, "daily_calorie_goal": 2000, "daily_protein_goal": 50, "wake_time": "07:00", "sleep_time": "23:00", "water_reminder_enabled": True, "meal_reminder_enabled": True, "routine_reminder_enabled": True})
    expires_at = datetime.now(timezone.utc) + timedelta(days=7)
    await db.user_sessions.delete_many({"user_id": user_id})
    await db.user_sessions.insert_one({"session_token": session_token, "user_id": user_id, "expires_at": expires_at, "created_at": datetime.now(timezone.utc)})
    response.set_cookie(key="session_token", value=session_token, httponly=True, secure=True, samesite="none", path="/", max_age=7*24*60*60)
    user_doc = await db.users.find_one({"user_id": user_id}, {"_id": 0})
    user_doc["session_token"] = session_token
    return user_doc

@api_router.get("/auth/me")
async def get_me(user: User = Depends(require_user)):
    return {"user_id": user.user_id, "email": user.email, "name": user.name, "picture": user.picture, "weight_kg": user.weight_kg, "activity_level": user.activity_level, "health_goals": user.health_goals}

@api_router.post("/auth/logout")
async def logout(request: Request, response: Response):
    session_token = request.cookies.get("session_token")
    if session_token:
        await db.user_sessions.delete_many({"session_token": session_token})
    response.delete_cookie(key="session_token", path="/")
    return {"message": "Logged out"}

# ================== USER SETTINGS ==================

@api_router.get("/user/settings")
async def get_user_settings(user: User = Depends(require_user)):
    settings = await db.user_settings.find_one({"user_id": user.user_id}, {"_id": 0})
    if not settings:
        settings = {"daily_water_goal_ml": 2500, "daily_calorie_goal": 2000, "daily_protein_goal": 50, "water_reminder_enabled": True, "meal_reminder_enabled": True, "routine_reminder_enabled": True}
    return settings

@api_router.put("/user/settings")
async def update_user_settings(settings: Dict[str, Any], user: User = Depends(require_user)):
    await db.user_settings.update_one({"user_id": user.user_id}, {"$set": settings}, upsert=True)
    return {"message": "Settings updated"}

@api_router.put("/user/profile")
async def update_user_profile(profile: Dict[str, Any], user: User = Depends(require_user)):
    allowed = ["weight_kg", "activity_level", "health_goals", "name"]
    update_data = {k: v for k, v in profile.items() if k in allowed}
    await db.users.update_one({"user_id": user.user_id}, {"$set": update_data})
    return {"message": "Profile updated"}

# ================== USDA FOOD FUNCTIONS ==================

async def search_usda_foods(query: str, page_size: int = 10) -> List[Dict]:
    async with httpx.AsyncClient() as client_http:
        response = await client_http.get(f"{USDA_BASE_URL}/foods/search", params={"api_key": USDA_API_KEY, "query": query, "pageSize": page_size, "dataType": ["Foundation", "SR Legacy", "Survey (FNDDS)"]})
        if response.status_code != 200:
            return []
        return [{"fdc_id": f.get("fdcId"), "description": f.get("description"), "brand_owner": f.get("brandOwner"), "data_type": f.get("dataType")} for f in response.json().get("foods", [])]

async def get_usda_food_details(fdc_id: int) -> Optional[Dict]:
    async with httpx.AsyncClient() as client_http:
        response = await client_http.get(f"{USDA_BASE_URL}/food/{fdc_id}", params={"api_key": USDA_API_KEY})
        return response.json() if response.status_code == 200 else None

def extract_nutrients(food_data: Dict, portion_grams: float = 100.0) -> Dict[str, float]:
    nutrients = {}
    portion_factor = portion_grams / 100.0
    nutrient_mapping = {1008: "energy_kcal", 1003: "protein_g", 1004: "fat_g", 1005: "carbohydrate_g", 1079: "fiber_g", 1087: "calcium_mg", 1089: "iron_mg", 1090: "magnesium_mg", 1092: "potassium_mg", 1093: "sodium_mg", 1095: "zinc_mg", 1162: "vitamin_c_mg", 1106: "vitamin_a_mcg", 1114: "vitamin_d_mcg", 1178: "vitamin_b12_mcg"}
    for fn in food_data.get("foodNutrients", []):
        nutrient_id = fn.get("nutrient", {}).get("id") or fn.get("nutrientId")
        amount = fn.get("amount", 0) or 0
        if nutrient_id in nutrient_mapping:
            nutrients[nutrient_mapping[nutrient_id]] = round(amount * portion_factor, 3)
    return nutrients

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

# ================== FOOD ENDPOINTS ==================

@api_router.post("/foods/search")
async def search_foods(request: Request):
    body = await request.json()
    foods = await search_usda_foods(body.get("query", ""), body.get("page_size", 10))
    return {"foods": foods, "query": body.get("query", "")}

@api_router.post("/foods/analyze")
async def analyze_food(request: Request):
    body = await request.json()
    food_data = await get_usda_food_details(body.get("fdc_id"))
    if not food_data:
        raise HTTPException(status_code=404, detail="Food not found")
    raw_nutrients = extract_nutrients(food_data, body.get("portion_grams", 100))
    cooking_method = body.get("cooking_method", "raw")
    cooked_nutrients = apply_cooking_retention(raw_nutrients, cooking_method)
    elements = calculate_elemental_composition(cooked_nutrients)
    food_name = food_data.get("description", "")
    allergens = detect_allergens(food_name, food_data.get("ingredients", ""))
    bio_effects = {el: BIOLOGICAL_EFFECTS[el] for el in elements["mass_grams"] if el in BIOLOGICAL_EFFECTS and elements["mass_grams"][el] > 0}
    method_scores = {m: sum(f.values())/len(f) for m, f in RETENTION_FACTORS.items() if m != "raw"}
    ranked = sorted(method_scores.items(), key=lambda x: x[1], reverse=True)
    return {"fdc_id": body.get("fdc_id"), "food_name": food_name, "portion_grams": body.get("portion_grams", 100), "cooking_method": cooking_method, "nutrients": {"raw": raw_nutrients, "cooked": cooked_nutrients, "retention_applied": cooking_method != "raw"}, "elements": elements, "allergens": allergens, "biological_effects": bio_effects, "cooking_recommendations": {"recommended_method": ranked[0][0], "method_rankings": [{"method": m, "avg_retention": round(s*100, 1)} for m, s in ranked]}, "data_source": "USDA FoodData Central"}

@api_router.get("/foods/retention-factors")
async def get_retention_factors():
    return {"retention_factors": RETENTION_FACTORS}

@api_router.get("/foods/barcode/{barcode}")
async def lookup_barcode(barcode: str):
    """Look up food by barcode using Open Food Facts"""
    async with httpx.AsyncClient() as client_http:
        response = await client_http.get(f"https://world.openfoodfacts.org/api/v0/product/{barcode}.json")
        if response.status_code != 200:
            raise HTTPException(status_code=404, detail="Product not found")
        data = response.json()
        if data.get("status") != 1:
            raise HTTPException(status_code=404, detail="Product not found")
        product = data.get("product", {})
        nutriments = product.get("nutriments", {})
        return {
            "barcode": barcode,
            "name": product.get("product_name", "Unknown"),
            "brand": product.get("brands", ""),
            "image_url": product.get("image_url", ""),
            "nutrients_per_100g": {
                "energy_kcal": nutriments.get("energy-kcal_100g", 0),
                "protein_g": nutriments.get("proteins_100g", 0),
                "carbohydrate_g": nutriments.get("carbohydrates_100g", 0),
                "fat_g": nutriments.get("fat_100g", 0),
                "fiber_g": nutriments.get("fiber_100g", 0),
                "sodium_mg": nutriments.get("sodium_100g", 0) * 1000 if nutriments.get("sodium_100g") else 0,
            },
            "allergens": product.get("allergens_tags", []),
            "ingredients": product.get("ingredients_text", "")
        }

# ================== MEAL TRACKING ==================

@api_router.post("/meals")
async def add_meal(meal: MealEntryCreate, user: User = Depends(require_user)):
    meal_entry = {"id": str(uuid.uuid4()), "user_id": user.user_id, **meal.dict(), "timestamp": datetime.now(timezone.utc), "date": datetime.now(timezone.utc).strftime("%Y-%m-%d")}
    await db.meals.insert_one(meal_entry)
    await update_daily_summary(user.user_id, meal_entry["date"])
    return {"message": "Meal added", "meal_id": meal_entry["id"]}

@api_router.get("/meals/today")
async def get_today_meals(user: User = Depends(require_user)):
    today = datetime.now(timezone.utc).strftime("%Y-%m-%d")
    meals = await db.meals.find({"user_id": user.user_id, "date": today}, {"_id": 0}).sort("timestamp", 1).to_list(100)
    return {"meals": meals, "date": today}

@api_router.get("/meals/history")
async def get_meal_history(days: int = 7, user: User = Depends(require_user)):
    start_date = (datetime.now(timezone.utc) - timedelta(days=days)).strftime("%Y-%m-%d")
    meals = await db.meals.find({"user_id": user.user_id, "date": {"$gte": start_date}}, {"_id": 0}).sort("timestamp", -1).to_list(500)
    return {"meals": meals}

@api_router.delete("/meals/{meal_id}")
async def delete_meal(meal_id: str, user: User = Depends(require_user)):
    meal = await db.meals.find_one({"id": meal_id, "user_id": user.user_id})
    if meal:
        await db.meals.delete_one({"id": meal_id})
        await update_daily_summary(user.user_id, meal["date"])
    return {"message": "Meal deleted"}

# ================== WATER TRACKING ==================

@api_router.post("/water")
async def add_water(water: WaterLogCreate, user: User = Depends(require_user)):
    log = {"id": str(uuid.uuid4()), "user_id": user.user_id, "amount_ml": water.amount_ml, "timestamp": datetime.now(timezone.utc), "date": datetime.now(timezone.utc).strftime("%Y-%m-%d")}
    await db.water_logs.insert_one(log)
    await update_daily_summary(user.user_id, log["date"])
    return {"message": "Water logged", "log_id": log["id"], "amount_ml": water.amount_ml}

@api_router.get("/water/today")
async def get_today_water(user: User = Depends(require_user)):
    today = datetime.now(timezone.utc).strftime("%Y-%m-%d")
    logs = await db.water_logs.find({"user_id": user.user_id, "date": today}, {"_id": 0}).to_list(100)
    total = sum(log["amount_ml"] for log in logs)
    settings = await db.user_settings.find_one({"user_id": user.user_id}, {"_id": 0}) or {}
    goal = settings.get("daily_water_goal_ml", 2500)
    return {"logs": logs, "total_ml": total, "goal_ml": goal, "percentage": round((total / goal) * 100, 1) if goal > 0 else 0}

@api_router.get("/water/history")
async def get_water_history(days: int = 7, user: User = Depends(require_user)):
    start_date = (datetime.now(timezone.utc) - timedelta(days=days)).strftime("%Y-%m-%d")
    pipeline = [{"$match": {"user_id": user.user_id, "date": {"$gte": start_date}}}, {"$group": {"_id": "$date", "total_ml": {"$sum": "$amount_ml"}}}, {"$sort": {"_id": -1}}]
    history = await db.water_logs.aggregate(pipeline).to_list(30)
    return {"history": [{"date": h["_id"], "total_ml": h["total_ml"]} for h in history]}

@api_router.get("/water/smart-goal")
async def get_smart_water_goal(user: User = Depends(require_user)):
    base_ml = user.weight_kg * 33
    activity_mult = {"sedentary": 0.9, "light": 1.0, "moderate": 1.1, "active": 1.2, "very_active": 1.3}.get(user.activity_level, 1.0)
    return {"recommended_ml": int(base_ml * activity_mult), "weight_kg": user.weight_kg, "activity_level": user.activity_level}

# ================== FAVORITES ==================

@api_router.post("/favorites")
async def add_favorite(fav: FavoriteCreate, user: User = Depends(require_user)):
    existing = await db.favorites.find_one({"user_id": user.user_id, "fdc_id": fav.fdc_id})
    if existing:
        return {"message": "Already in favorites", "favorite_id": existing.get("id")}
    favorite = {"id": str(uuid.uuid4()), "user_id": user.user_id, **fav.dict(), "created_at": datetime.now(timezone.utc)}
    await db.favorites.insert_one(favorite)
    return {"message": "Added to favorites", "favorite_id": favorite["id"]}

@api_router.get("/favorites")
async def get_favorites(user: User = Depends(require_user)):
    favorites = await db.favorites.find({"user_id": user.user_id}, {"_id": 0}).sort("created_at", -1).to_list(100)
    return {"favorites": favorites}

@api_router.delete("/favorites/{fdc_id}")
async def remove_favorite(fdc_id: int, user: User = Depends(require_user)):
    await db.favorites.delete_one({"user_id": user.user_id, "fdc_id": fdc_id})
    return {"message": "Removed from favorites"}

@api_router.get("/foods/recent")
async def get_recent_foods(limit: int = 20, user: User = Depends(require_user)):
    meals = await db.meals.find({"user_id": user.user_id}, {"_id": 0, "food_name": 1, "fdc_id": 1, "portion_grams": 1, "cooking_method": 1, "timestamp": 1}).sort("timestamp", -1).limit(limit * 3).to_list(limit * 3)
    seen = set()
    unique = []
    for m in meals:
        key = m.get("fdc_id") or m.get("food_name")
        if key not in seen:
            seen.add(key)
            unique.append(m)
        if len(unique) >= limit:
            break
    return {"recent_foods": unique}

# ================== RECIPES ==================

@api_router.post("/recipes")
async def create_recipe(recipe: RecipeCreate, user: User = Depends(require_user)):
    # Calculate combined nutrition
    total_nutrients = {}
    total_elements = {}
    all_allergens = []
    
    for ingredient in recipe.ingredients:
        if ingredient.get("fdc_id"):
            food_data = await get_usda_food_details(ingredient["fdc_id"])
            if food_data:
                nutrients = extract_nutrients(food_data, ingredient.get("portion_grams", 100))
                cooked = apply_cooking_retention(nutrients, ingredient.get("cooking_method", "raw"))
                elements = calculate_elemental_composition(cooked)
                allergens = detect_allergens(food_data.get("description", ""), food_data.get("ingredients", ""))
                
                for k, v in cooked.items():
                    total_nutrients[k] = total_nutrients.get(k, 0) + v
                for k, v in elements["mass_grams"].items():
                    total_elements[k] = total_elements.get(k, 0) + v
                all_allergens.extend(allergens)
    
    # Per serving
    servings = recipe.servings or 1
    per_serving_nutrients = {k: round(v / servings, 2) for k, v in total_nutrients.items()}
    per_serving_elements = {k: round(v / servings, 6) for k, v in total_elements.items()}
    
    recipe_doc = {
        "id": str(uuid.uuid4()),
        "user_id": user.user_id,
        **recipe.dict(),
        "total_nutrients": total_nutrients,
        "total_elements": total_elements,
        "per_serving_nutrients": per_serving_nutrients,
        "per_serving_elements": per_serving_elements,
        "allergens": list(set(all_allergens)),
        "created_at": datetime.now(timezone.utc)
    }
    await db.recipes.insert_one(recipe_doc)
    return {"message": "Recipe created", "recipe_id": recipe_doc["id"], "per_serving_nutrients": per_serving_nutrients}

@api_router.get("/recipes")
async def get_recipes(user: User = Depends(require_user)):
    recipes = await db.recipes.find({"user_id": user.user_id}, {"_id": 0}).sort("created_at", -1).to_list(100)
    return {"recipes": recipes}

@api_router.get("/recipes/{recipe_id}")
async def get_recipe(recipe_id: str, user: User = Depends(require_user)):
    recipe = await db.recipes.find_one({"id": recipe_id, "user_id": user.user_id}, {"_id": 0})
    if not recipe:
        raise HTTPException(status_code=404, detail="Recipe not found")
    return recipe

@api_router.delete("/recipes/{recipe_id}")
async def delete_recipe(recipe_id: str, user: User = Depends(require_user)):
    await db.recipes.delete_one({"id": recipe_id, "user_id": user.user_id})
    return {"message": "Recipe deleted"}

# ================== MEAL PLANNING ==================

@api_router.post("/meal-plans")
async def create_meal_plan(plan: MealPlanCreate, user: User = Depends(require_user)):
    plan_doc = {"id": str(uuid.uuid4()), "user_id": user.user_id, **plan.dict(), "created_at": datetime.now(timezone.utc)}
    await db.meal_plans.insert_one(plan_doc)
    return {"message": "Meal plan created", "plan_id": plan_doc["id"]}

@api_router.get("/meal-plans")
async def get_meal_plans(start_date: Optional[str] = None, end_date: Optional[str] = None, user: User = Depends(require_user)):
    if not start_date:
        start_date = datetime.now(timezone.utc).strftime("%Y-%m-%d")
    if not end_date:
        end_date = (datetime.now(timezone.utc) + timedelta(days=7)).strftime("%Y-%m-%d")
    plans = await db.meal_plans.find({"user_id": user.user_id, "date": {"$gte": start_date, "$lte": end_date}}, {"_id": 0}).sort("date", 1).to_list(100)
    # Group by date
    by_date = {}
    for plan in plans:
        date = plan["date"]
        if date not in by_date:
            by_date[date] = []
        by_date[date].append(plan)
    return {"meal_plans": by_date, "start_date": start_date, "end_date": end_date}

@api_router.delete("/meal-plans/{plan_id}")
async def delete_meal_plan(plan_id: str, user: User = Depends(require_user)):
    await db.meal_plans.delete_one({"id": plan_id, "user_id": user.user_id})
    return {"message": "Meal plan deleted"}

@api_router.post("/meal-plans/{plan_id}/log")
async def log_meal_from_plan(plan_id: str, user: User = Depends(require_user)):
    """Convert a meal plan item to an actual meal entry"""
    plan = await db.meal_plans.find_one({"id": plan_id, "user_id": user.user_id})
    if not plan:
        raise HTTPException(status_code=404, detail="Meal plan not found")
    
    if plan.get("recipe_id"):
        recipe = await db.recipes.find_one({"id": plan["recipe_id"]})
        if recipe:
            meal_entry = {
                "id": str(uuid.uuid4()),
                "user_id": user.user_id,
                "food_name": recipe["name"],
                "portion_grams": 100,
                "meal_type": plan["meal_type"],
                "cooking_method": "raw",
                "nutrients": recipe.get("per_serving_nutrients", {}),
                "elements": recipe.get("per_serving_elements", {}),
                "allergens": recipe.get("allergens", []),
                "timestamp": datetime.now(timezone.utc),
                "date": datetime.now(timezone.utc).strftime("%Y-%m-%d")
            }
            await db.meals.insert_one(meal_entry)
            await update_daily_summary(user.user_id, meal_entry["date"])
            return {"message": "Meal logged from plan", "meal_id": meal_entry["id"]}
    
    return {"message": "No recipe associated with this plan"}

# ================== ROUTINES ==================

@api_router.post("/routines")
async def create_routine(routine: RoutineCreate, user: User = Depends(require_user)):
    routine_doc = {"id": str(uuid.uuid4()), "user_id": user.user_id, **routine.dict(), "is_active": True, "created_at": datetime.now(timezone.utc)}
    await db.routines.insert_one(routine_doc)
    return {"message": "Routine created", "routine_id": routine_doc["id"]}

@api_router.get("/routines")
async def get_routines(user: User = Depends(require_user)):
    routines = await db.routines.find({"user_id": user.user_id, "is_active": True}, {"_id": 0}).to_list(50)
    return {"routines": routines}

@api_router.put("/routines/{routine_id}")
async def update_routine(routine_id: str, update_data: Dict[str, Any], user: User = Depends(require_user)):
    await db.routines.update_one({"id": routine_id, "user_id": user.user_id}, {"$set": update_data})
    return {"message": "Routine updated"}

@api_router.delete("/routines/{routine_id}")
async def delete_routine(routine_id: str, user: User = Depends(require_user)):
    await db.routines.update_one({"id": routine_id, "user_id": user.user_id}, {"$set": {"is_active": False}})
    return {"message": "Routine deleted"}

@api_router.post("/routines/{routine_id}/tasks/{task_id}/complete")
async def complete_task(routine_id: str, task_id: str, user: User = Depends(require_user)):
    today = datetime.now(timezone.utc).strftime("%Y-%m-%d")
    await db.task_completions.insert_one({"id": str(uuid.uuid4()), "user_id": user.user_id, "routine_id": routine_id, "task_id": task_id, "date": today, "timestamp": datetime.now(timezone.utc)})
    await update_daily_summary(user.user_id, today)
    return {"message": "Task completed"}

@api_router.get("/routines/today")
async def get_today_routines(user: User = Depends(require_user)):
    today = datetime.now(timezone.utc).strftime("%Y-%m-%d")
    day_of_week = datetime.now(timezone.utc).strftime("%a").lower()
    routines = await db.routines.find({"user_id": user.user_id, "is_active": True, "days": day_of_week}, {"_id": 0}).to_list(20)
    completions = await db.task_completions.find({"user_id": user.user_id, "date": today}, {"_id": 0}).to_list(200)
    completed_task_ids = {c["task_id"] for c in completions}
    for routine in routines:
        for task in routine.get("tasks", []):
            task["completed"] = task.get("id", "") in completed_task_ids
    return {"routines": routines, "date": today}

@api_router.get("/routines/streak")
async def get_routine_streak(user: User = Depends(require_user)):
    streak = 0
    current_date = datetime.now(timezone.utc).date()
    for i in range(365):
        check_date = (current_date - timedelta(days=i)).strftime("%Y-%m-%d")
        summary = await db.daily_summaries.find_one({"user_id": user.user_id, "date": check_date}, {"_id": 0})
        if summary and summary.get("routines_completed", 0) > 0 and summary.get("routines_completed") >= summary.get("routines_total", 1):
            streak += 1
        elif i > 0:
            break
    return {"streak_days": streak}

# ================== PROGRESS & CHARTS ==================

@api_router.get("/progress/nutrition")
async def get_nutrition_progress(days: int = 7, user: User = Depends(require_user)):
    """Get nutrition data for charts"""
    start_date = (datetime.now(timezone.utc) - timedelta(days=days)).strftime("%Y-%m-%d")
    summaries = await db.daily_summaries.find({"user_id": user.user_id, "date": {"$gte": start_date}}, {"_id": 0}).sort("date", 1).to_list(days)
    
    chart_data = []
    for s in summaries:
        chart_data.append({
            "date": s["date"],
            "calories": s.get("total_calories", 0),
            "protein": s.get("total_protein", 0),
            "carbs": s.get("total_carbs", 0),
            "fat": s.get("total_fat", 0)
        })
    
    # Fill missing dates with zeros
    all_dates = []
    for i in range(days):
        date = (datetime.now(timezone.utc) - timedelta(days=days-1-i)).strftime("%Y-%m-%d")
        all_dates.append(date)
    
    existing_dates = {d["date"] for d in chart_data}
    for date in all_dates:
        if date not in existing_dates:
            chart_data.append({"date": date, "calories": 0, "protein": 0, "carbs": 0, "fat": 0})
    
    chart_data.sort(key=lambda x: x["date"])
    
    return {"chart_data": chart_data, "days": days}

@api_router.get("/progress/water")
async def get_water_progress(days: int = 7, user: User = Depends(require_user)):
    """Get water intake data for charts"""
    start_date = (datetime.now(timezone.utc) - timedelta(days=days)).strftime("%Y-%m-%d")
    pipeline = [
        {"$match": {"user_id": user.user_id, "date": {"$gte": start_date}}},
        {"$group": {"_id": "$date", "total_ml": {"$sum": "$amount_ml"}}},
        {"$sort": {"_id": 1}}
    ]
    data = await db.water_logs.aggregate(pipeline).to_list(days)
    settings = await db.user_settings.find_one({"user_id": user.user_id}, {"_id": 0}) or {}
    goal = settings.get("daily_water_goal_ml", 2500)
    
    chart_data = [{"date": d["_id"], "amount_ml": d["total_ml"], "goal_ml": goal, "percentage": round((d["total_ml"] / goal) * 100, 1)} for d in data]
    
    return {"chart_data": chart_data, "goal_ml": goal, "days": days}

@api_router.get("/progress/routines")
async def get_routines_progress(days: int = 7, user: User = Depends(require_user)):
    """Get routine completion data for charts"""
    start_date = (datetime.now(timezone.utc) - timedelta(days=days)).strftime("%Y-%m-%d")
    summaries = await db.daily_summaries.find({"user_id": user.user_id, "date": {"$gte": start_date}}, {"_id": 0}).sort("date", 1).to_list(days)
    
    chart_data = []
    for s in summaries:
        completed = s.get("routines_completed", 0)
        total = s.get("routines_total", 0)
        chart_data.append({
            "date": s["date"],
            "completed": completed,
            "total": total,
            "percentage": round((completed / total) * 100, 1) if total > 0 else 0
        })
    
    return {"chart_data": chart_data, "days": days}

@api_router.get("/progress/elements")
async def get_elements_progress(days: int = 7, user: User = Depends(require_user)):
    """Get elemental intake data for charts"""
    start_date = (datetime.now(timezone.utc) - timedelta(days=days)).strftime("%Y-%m-%d")
    summaries = await db.daily_summaries.find({"user_id": user.user_id, "date": {"$gte": start_date}}, {"_id": 0}).sort("date", 1).to_list(days)
    
    chart_data = []
    for s in summaries:
        elements = s.get("elements", {})
        chart_data.append({
            "date": s["date"],
            "C": elements.get("C", 0),
            "H": elements.get("H", 0),
            "O": elements.get("O", 0),
            "N": elements.get("N", 0),
            "Fe": elements.get("Fe", 0),
            "Ca": elements.get("Ca", 0),
            "Mg": elements.get("Mg", 0)
        })
    
    return {"chart_data": chart_data, "days": days}

# ================== DASHBOARD & SUMMARY ==================

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
    day_of_week = datetime.strptime(date, "%Y-%m-%d").strftime("%a").lower()
    routines = await db.routines.find({"user_id": user_id, "is_active": True, "days": day_of_week}, {"_id": 0}).to_list(20)
    completions = await db.task_completions.find({"user_id": user_id, "date": date}, {"_id": 0}).to_list(200)
    total_tasks = sum(len(r.get("tasks", [])) for r in routines)
    deficiencies = [n for n, rec in DAILY_RECOMMENDED.items() if total_nutrients.get(n, 0) < rec * 0.5]
    summary = {"user_id": user_id, "date": date, "total_calories": total_nutrients.get("energy_kcal", 0), "total_protein": total_nutrients.get("protein_g", 0), "total_carbs": total_nutrients.get("carbohydrate_g", 0), "total_fat": total_nutrients.get("fat_g", 0), "total_water_ml": total_water, "meals_count": len(meals), "nutrients": total_nutrients, "elements": total_elements, "deficiencies": deficiencies, "routines_completed": len(completions), "routines_total": total_tasks}
    await db.daily_summaries.update_one({"user_id": user_id, "date": date}, {"$set": summary}, upsert=True)
    return summary

@api_router.get("/dashboard")
async def get_dashboard(user: User = Depends(require_user)):
    today = datetime.now(timezone.utc).strftime("%Y-%m-%d")
    summary = await db.daily_summaries.find_one({"user_id": user.user_id, "date": today}, {"_id": 0})
    if not summary:
        summary = await update_daily_summary(user.user_id, today)
    settings = await db.user_settings.find_one({"user_id": user.user_id}, {"_id": 0}) or {}
    meals = await db.meals.find({"user_id": user.user_id, "date": today}, {"_id": 0}).sort("timestamp", -1).limit(5).to_list(5)
    water_logs = await db.water_logs.find({"user_id": user.user_id, "date": today}, {"_id": 0}).to_list(100)
    total_water = sum(log["amount_ml"] for log in water_logs)
    day_of_week = datetime.now(timezone.utc).strftime("%a").lower()
    routines = await db.routines.find({"user_id": user.user_id, "is_active": True, "days": day_of_week}, {"_id": 0}).to_list(20)
    completions = await db.task_completions.find({"user_id": user.user_id, "date": today}, {"_id": 0}).to_list(200)
    completed_task_ids = {c["task_id"] for c in completions}
    for routine in routines:
        for task in routine.get("tasks", []):
            task["completed"] = task.get("id", "") in completed_task_ids
    # Calculate streak
    streak = 0
    current_date = datetime.now(timezone.utc).date()
    for i in range(365):
        check_date = (current_date - timedelta(days=i)).strftime("%Y-%m-%d")
        s = await db.daily_summaries.find_one({"user_id": user.user_id, "date": check_date}, {"_id": 0})
        if s and s.get("routines_completed", 0) > 0 and s.get("routines_completed") >= s.get("routines_total", 1):
            streak += 1
        elif i > 0:
            break
    insights = await db.insights.find({"user_id": user.user_id, "date": today}, {"_id": 0}).sort("created_at", -1).limit(5).to_list(5)
    calorie_goal, protein_goal, water_goal = settings.get("daily_calorie_goal", 2000), settings.get("daily_protein_goal", 50), settings.get("daily_water_goal_ml", 2500)
    return {
        "date": today,
        "user": {"name": user.name, "weight_kg": user.weight_kg, "activity_level": user.activity_level},
        "nutrition": {"calories": {"current": summary.get("total_calories", 0), "goal": calorie_goal, "percentage": min(100, round((summary.get("total_calories", 0) / calorie_goal) * 100, 1))}, "protein": {"current": summary.get("total_protein", 0), "goal": protein_goal, "percentage": min(100, round((summary.get("total_protein", 0) / protein_goal) * 100, 1))}, "carbs": {"current": summary.get("total_carbs", 0)}, "fat": {"current": summary.get("total_fat", 0)}, "deficiencies": summary.get("deficiencies", []), "meals_count": summary.get("meals_count", 0)},
        "hydration": {"current_ml": total_water, "goal_ml": water_goal, "percentage": round((total_water / water_goal) * 100, 1) if water_goal > 0 else 0, "logs_count": len(water_logs)},
        "routines": {"completed": summary.get("routines_completed", 0), "total": summary.get("routines_total", 0), "percentage": round((summary.get("routines_completed", 0) / max(summary.get("routines_total", 1), 1)) * 100, 1), "streak_days": streak, "today_routines": routines},
        "elements": summary.get("elements", {}),
        "recent_meals": meals,
        "insights": insights
    }

# ================== AI ENDPOINTS ==================

@api_router.post("/ai/recommendations")
async def get_ai_recommendations(request: AIRecommendationRequest):
    from emergentintegrations.llm.chat import LlmChat, UserMessage
    goal_descriptions = {"muscle_gain": "building muscle", "immune_system": "immune function", "brain_health": "cognitive function", "gut_microbiome": "gut health", "energy": "energy levels", "weight_loss": "weight loss"}
    prompt = f"""Recommend 5 foods for {goal_descriptions.get(request.goal, request.goal)}.
For each: food name, key_nutrients (list), key_elements (list), health_benefit, best_cooking, synergistic_foods (list).
Respond as JSON array only: [{{"food": "", "key_nutrients": [], "key_elements": [], "health_benefit": "", "best_cooking": "", "synergistic_foods": []}}]"""
    try:
        chat = LlmChat(api_key=EMERGENT_LLM_KEY, session_id=f"rec_{uuid.uuid4().hex[:8]}", system_message="You are a molecular nutrition expert. Respond only with valid JSON.").with_model("gemini", "gemini-3-flash-preview")
        response = await chat.send_message(UserMessage(text=prompt))
        response_text = response.strip()
        if "```" in response_text:
            response_text = response_text.split("```")[1].replace("json", "").strip()
        return {"goal": request.goal, "recommendations": json.loads(response_text), "ai_model": "gemini-3-flash-preview"}
    except Exception as e:
        logger.error(f"AI error: {e}")
        fallback = [{"food": "Salmon", "key_nutrients": ["protein", "omega-3"], "key_elements": ["N", "P"], "health_benefit": "Complete protein", "best_cooking": "baking", "synergistic_foods": ["spinach"]}]
        return {"goal": request.goal, "recommendations": fallback, "ai_model": "fallback"}

@api_router.post("/ai/generate-insights")
async def generate_daily_insights(user: User = Depends(require_user)):
    from emergentintegrations.llm.chat import LlmChat, UserMessage
    today = datetime.now(timezone.utc).strftime("%Y-%m-%d")
    summary = await db.daily_summaries.find_one({"user_id": user.user_id, "date": today}, {"_id": 0}) or {}
    settings = await db.user_settings.find_one({"user_id": user.user_id}, {"_id": 0}) or {}
    prompt = f"""Analyze user data and generate 3-5 insights:
Calories: {summary.get('total_calories', 0)}/{settings.get('daily_calorie_goal', 2000)}
Protein: {summary.get('total_protein', 0)}/{settings.get('daily_protein_goal', 50)}g
Water: {summary.get('total_water_ml', 0)}/{settings.get('daily_water_goal_ml', 2500)}ml
Deficiencies: {summary.get('deficiencies', [])}
Respond as JSON: [{{"category": "nutrition|hydration|routine", "title": "", "message": "", "priority": "low|normal|high"}}]"""
    try:
        chat = LlmChat(api_key=EMERGENT_LLM_KEY, session_id=f"ins_{uuid.uuid4().hex[:8]}", system_message="Generate health insights as JSON.").with_model("gemini", "gemini-3-flash-preview")
        response = await chat.send_message(UserMessage(text=prompt))
        response_text = response.strip()
        if "```" in response_text:
            response_text = response_text.split("```")[1].replace("json", "").strip()
        insights = json.loads(response_text)
        for ins in insights:
            await db.insights.insert_one({"id": str(uuid.uuid4()), "user_id": user.user_id, "date": today, **ins, "created_at": datetime.now(timezone.utc)})
        return {"insights": insights, "date": today}
    except Exception as e:
        logger.error(f"Insight error: {e}")
        return {"insights": [{"category": "nutrition", "title": "Track More", "message": "Log more meals to get personalized insights", "priority": "normal"}]}

@api_router.get("/ai/insights")
async def get_insights(user: User = Depends(require_user)):
    today = datetime.now(timezone.utc).strftime("%Y-%m-%d")
    insights = await db.insights.find({"user_id": user.user_id, "date": today}, {"_id": 0}).sort("created_at", -1).to_list(10)
    return {"insights": insights}

@api_router.post("/ai/predictive-recommendations")
async def get_predictive_recommendations(user: User = Depends(require_user)):
    return {"recommendations": [{"type": "meal_timing", "title": "Optimal Eating Window", "description": "Eat main meal 1-2 hours before workouts", "optimal_time": "12:00-13:00", "expected_benefit": "Better energy"}]}

# ================== UTILITY ==================

@api_router.get("/")
async def root():
    return {"message": "NutriMolecule - Personal Health OS", "version": "3.0.0", "status": "healthy"}

@api_router.get("/elements/info")
async def get_elements_info():
    return {"elements": ATOMIC_WEIGHTS, "biological_effects": BIOLOGICAL_EFFECTS}

@api_router.get("/recommended-values")
async def get_recommended_values():
    return {"daily_recommended": DAILY_RECOMMENDED}

app.include_router(api_router)
app.add_middleware(CORSMiddleware, allow_credentials=True, allow_origins=["*"], allow_methods=["*"], allow_headers=["*"])

@app.on_event("shutdown")
async def shutdown_db_client():
    client.close()
