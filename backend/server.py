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
from datetime import datetime, timezone, timedelta, date
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
WEATHER_API_KEY = "demo"  # Using demo for weather - can be replaced with actual key

# Create the main app
app = FastAPI(title="NutriMolecule - Personal Health OS")
api_router = APIRouter(prefix="/api")

# Configure logging
logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(name)s - %(levelname)s - %(message)s')
logger = logging.getLogger(__name__)

# ================== CONSTANTS ==================

ELEMENTAL_FRACTIONS = {
    "protein": {"C": 0.50, "H": 0.07, "O": 0.22, "N": 0.16, "S": 0.02},
    "carbohydrate": {"C": 0.40, "H": 0.067, "O": 0.533},
    "fat": {"C": 0.76, "H": 0.123, "O": 0.117}
}

ATOMIC_WEIGHTS = {
    "C": 12.011, "H": 1.008, "O": 15.999, "N": 14.007, "S": 32.065,
    "Na": 22.990, "K": 39.098, "Ca": 40.078, "Fe": 55.845, "Zn": 65.38,
    "Mg": 24.305, "P": 30.974, "Cl": 35.453, "Se": 78.971, "Cu": 63.546
}

RETENTION_FACTORS = {
    "boiling": {"vitamin_a": 0.75, "vitamin_b1": 0.55, "vitamin_b2": 0.70, "vitamin_b3": 0.65, "vitamin_b6": 0.55, "vitamin_b12": 0.80, "vitamin_c": 0.45, "vitamin_d": 0.90, "folate": 0.50, "iron": 0.90, "magnesium": 0.75, "potassium": 0.70, "zinc": 0.85, "calcium": 0.80, "protein": 0.95},
    "steaming": {"vitamin_a": 0.90, "vitamin_b1": 0.75, "vitamin_b2": 0.85, "vitamin_b3": 0.80, "vitamin_b6": 0.75, "vitamin_b12": 0.90, "vitamin_c": 0.70, "vitamin_d": 0.95, "folate": 0.70, "iron": 0.95, "magnesium": 0.90, "potassium": 0.85, "zinc": 0.95, "calcium": 0.90, "protein": 0.98},
    "frying": {"vitamin_a": 0.80, "vitamin_b1": 0.65, "vitamin_b2": 0.75, "vitamin_b3": 0.70, "vitamin_b6": 0.65, "vitamin_b12": 0.85, "vitamin_c": 0.50, "vitamin_d": 0.85, "folate": 0.60, "iron": 0.85, "magnesium": 0.85, "potassium": 0.80, "zinc": 0.90, "calcium": 0.85, "protein": 0.92},
    "baking": {"vitamin_a": 0.85, "vitamin_b1": 0.70, "vitamin_b2": 0.80, "vitamin_b3": 0.75, "vitamin_b6": 0.70, "vitamin_b12": 0.90, "vitamin_c": 0.55, "vitamin_d": 0.90, "folate": 0.65, "iron": 0.90, "magnesium": 0.88, "potassium": 0.82, "zinc": 0.92, "calcium": 0.88, "protein": 0.95},
    "raw": {"vitamin_a": 1.0, "vitamin_b1": 1.0, "vitamin_b2": 1.0, "vitamin_b3": 1.0, "vitamin_b6": 1.0, "vitamin_b12": 1.0, "vitamin_c": 1.0, "vitamin_d": 1.0, "folate": 1.0, "iron": 1.0, "magnesium": 1.0, "potassium": 1.0, "zinc": 1.0, "calcium": 1.0, "protein": 1.0}
}

SAFE_COOKING_TEMPS = {
    "poultry": {"fahrenheit": 165, "celsius": 74, "description": "All poultry"},
    "ground_meat": {"fahrenheit": 160, "celsius": 71, "description": "Ground beef, pork, lamb"},
    "beef_steak": {"fahrenheit": 145, "celsius": 63, "description": "Steaks, roasts"},
    "pork": {"fahrenheit": 145, "celsius": 63, "description": "Pork chops, roasts"},
    "fish": {"fahrenheit": 145, "celsius": 63, "description": "Fish and shellfish"},
    "eggs": {"fahrenheit": 160, "celsius": 71, "description": "Egg dishes"}
}

ALLERGENS = ["peanut", "peanuts", "tree nut", "almond", "walnut", "milk", "dairy", "lactose", "cheese", "egg", "eggs", "wheat", "gluten", "soy", "fish", "salmon", "shellfish", "shrimp", "sesame"]

BIOLOGICAL_EFFECTS = {
    "C": ["Energy metabolism", "Cell structure"], "H": ["Cellular hydration", "Acid-base balance"],
    "O": ["Cellular respiration", "Oxidation reactions"], "N": ["Protein synthesis", "DNA building"],
    "S": ["Protein structure", "Detoxification"], "Fe": ["Oxygen transport", "Energy production"],
    "Ca": ["Bone health", "Muscle contraction"], "K": ["Heart rhythm", "Fluid balance"],
    "Mg": ["Enzyme activation", "Energy production"], "Zn": ["Immune function", "Wound healing"]
}

# Daily recommended values for deficiency detection
DAILY_RECOMMENDED = {
    "energy_kcal": 2000, "protein_g": 50, "carbohydrate_g": 275, "fat_g": 78, "fiber_g": 28,
    "vitamin_a_mcg": 900, "vitamin_c_mg": 90, "vitamin_d_mcg": 20, "vitamin_b12_mcg": 2.4,
    "iron_mg": 18, "calcium_mg": 1000, "magnesium_mg": 400, "potassium_mg": 4700, "zinc_mg": 11
}

# ================== PYDANTIC MODELS ==================

class User(BaseModel):
    user_id: str
    email: str
    name: str
    picture: Optional[str] = None
    created_at: datetime
    weight_kg: Optional[float] = 70.0
    activity_level: Optional[str] = "moderate"  # sedentary, light, moderate, active, very_active
    health_goals: Optional[List[str]] = []  # muscle_gain, weight_loss, energy, immune

class UserSettings(BaseModel):
    daily_water_goal_ml: int = 2500
    daily_calorie_goal: int = 2000
    daily_protein_goal: int = 50
    wake_time: str = "07:00"
    sleep_time: str = "23:00"
    reminder_interval_hours: int = 2

class FoodSearchRequest(BaseModel):
    query: str
    page_size: int = 10

class FoodAnalysisRequest(BaseModel):
    fdc_id: int
    portion_grams: float = 100.0
    cooking_method: str = "raw"

class MealEntry(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    user_id: str
    fdc_id: Optional[int] = None
    food_name: str
    portion_grams: float
    meal_type: str  # breakfast, lunch, dinner, snack
    cooking_method: str = "raw"
    nutrients: Dict[str, float] = {}
    elements: Dict[str, float] = {}
    allergens: List[str] = []
    timestamp: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
    date: str = Field(default_factory=lambda: datetime.now(timezone.utc).strftime("%Y-%m-%d"))

class MealEntryCreate(BaseModel):
    fdc_id: Optional[int] = None
    food_name: str
    portion_grams: float
    meal_type: str
    cooking_method: str = "raw"
    nutrients: Dict[str, float] = {}
    elements: Dict[str, float] = {}
    allergens: List[str] = []

class WaterLog(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    user_id: str
    amount_ml: int
    timestamp: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
    date: str = Field(default_factory=lambda: datetime.now(timezone.utc).strftime("%Y-%m-%d"))

class WaterLogCreate(BaseModel):
    amount_ml: int

class Routine(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    user_id: str
    name: str
    type: str  # morning, work, workout, evening, custom
    time_start: str  # HH:MM format
    time_end: str
    days: List[str] = ["mon", "tue", "wed", "thu", "fri", "sat", "sun"]
    tasks: List[Dict[str, Any]] = []
    is_active: bool = True
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))

class RoutineCreate(BaseModel):
    name: str
    type: str
    time_start: str
    time_end: str
    days: List[str] = ["mon", "tue", "wed", "thu", "fri", "sat", "sun"]
    tasks: List[Dict[str, Any]] = []

class TaskCompletion(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    user_id: str
    routine_id: str
    task_id: str
    completed: bool = True
    timestamp: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
    date: str = Field(default_factory=lambda: datetime.now(timezone.utc).strftime("%Y-%m-%d"))

class DailySummary(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    user_id: str
    date: str
    total_calories: float = 0
    total_protein: float = 0
    total_carbs: float = 0
    total_fat: float = 0
    total_water_ml: int = 0
    meals_count: int = 0
    nutrients: Dict[str, float] = {}
    elements: Dict[str, float] = {}
    deficiencies: List[str] = []
    routines_completed: int = 0
    routines_total: int = 0
    streak_days: int = 0
    insights: List[Dict[str, Any]] = []

class AIInsight(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    user_id: str
    date: str
    category: str  # nutrition, hydration, routine, prediction
    title: str
    message: str
    priority: str = "normal"  # low, normal, high, urgent
    action_type: Optional[str] = None  # drink_water, eat_protein, complete_task
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
    is_read: bool = False

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
        auth_response = await client_http.get(
            "https://demobackend.emergentagent.com/auth/v1/env/oauth/session-data",
            headers={"X-Session-ID": session_id}
        )
        
        if auth_response.status_code != 200:
            raise HTTPException(status_code=401, detail="Invalid session")
        
        user_data = auth_response.json()
    
    email = user_data.get("email")
    name = user_data.get("name")
    picture = user_data.get("picture")
    session_token = user_data.get("session_token")
    
    existing_user = await db.users.find_one({"email": email}, {"_id": 0})
    
    if existing_user:
        user_id = existing_user["user_id"]
        await db.users.update_one({"user_id": user_id}, {"$set": {"name": name, "picture": picture}})
    else:
        user_id = f"user_{uuid.uuid4().hex[:12]}"
        new_user = {
            "user_id": user_id, "email": email, "name": name, "picture": picture,
            "created_at": datetime.now(timezone.utc), "weight_kg": 70.0,
            "activity_level": "moderate", "health_goals": []
        }
        await db.users.insert_one(new_user)
        
        # Create default settings
        default_settings = {
            "user_id": user_id, "daily_water_goal_ml": 2500, "daily_calorie_goal": 2000,
            "daily_protein_goal": 50, "wake_time": "07:00", "sleep_time": "23:00",
            "reminder_interval_hours": 2
        }
        await db.user_settings.insert_one(default_settings)
    
    expires_at = datetime.now(timezone.utc) + timedelta(days=7)
    session_doc = {"session_token": session_token, "user_id": user_id, "expires_at": expires_at, "created_at": datetime.now(timezone.utc)}
    
    await db.user_sessions.delete_many({"user_id": user_id})
    await db.user_sessions.insert_one(session_doc)
    
    response.set_cookie(key="session_token", value=session_token, httponly=True, secure=True, samesite="none", path="/", max_age=7*24*60*60)
    
    user_doc = await db.users.find_one({"user_id": user_id}, {"_id": 0})
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

@api_router.put("/user/settings")
async def update_user_settings(settings: Dict[str, Any], user: User = Depends(require_user)):
    await db.user_settings.update_one({"user_id": user.user_id}, {"$set": settings}, upsert=True)
    return {"message": "Settings updated"}

@api_router.get("/user/settings")
async def get_user_settings(user: User = Depends(require_user)):
    settings = await db.user_settings.find_one({"user_id": user.user_id}, {"_id": 0})
    if not settings:
        settings = {"daily_water_goal_ml": 2500, "daily_calorie_goal": 2000, "daily_protein_goal": 50}
    return settings

@api_router.put("/user/profile")
async def update_user_profile(profile: Dict[str, Any], user: User = Depends(require_user)):
    allowed = ["weight_kg", "activity_level", "health_goals"]
    update_data = {k: v for k, v in profile.items() if k in allowed}
    await db.users.update_one({"user_id": user.user_id}, {"$set": update_data})
    return {"message": "Profile updated"}

# ================== USDA FOOD FUNCTIONS ==================

async def search_usda_foods(query: str, page_size: int = 10) -> List[Dict]:
    async with httpx.AsyncClient() as client_http:
        response = await client_http.get(
            f"{USDA_BASE_URL}/foods/search",
            params={"api_key": USDA_API_KEY, "query": query, "pageSize": page_size, "dataType": ["Foundation", "SR Legacy", "Survey (FNDDS)"]}
        )
        if response.status_code != 200:
            return []
        data = response.json()
        return [{"fdc_id": f.get("fdcId"), "description": f.get("description"), "brand_owner": f.get("brandOwner"), "data_type": f.get("dataType"), "food_category": f.get("foodCategory")} for f in data.get("foods", [])]

async def get_usda_food_details(fdc_id: int) -> Optional[Dict]:
    async with httpx.AsyncClient() as client_http:
        response = await client_http.get(f"{USDA_BASE_URL}/food/{fdc_id}", params={"api_key": USDA_API_KEY})
        if response.status_code != 200:
            return None
        return response.json()

def extract_nutrients(food_data: Dict, portion_grams: float = 100.0) -> Dict[str, float]:
    nutrients = {}
    portion_factor = portion_grams / 100.0
    nutrient_mapping = {1008: "energy_kcal", 1003: "protein_g", 1004: "fat_g", 1005: "carbohydrate_g", 1079: "fiber_g", 2000: "sugars_g", 1087: "calcium_mg", 1089: "iron_mg", 1090: "magnesium_mg", 1091: "phosphorus_mg", 1092: "potassium_mg", 1093: "sodium_mg", 1095: "zinc_mg", 1162: "vitamin_c_mg", 1165: "vitamin_b1_mg", 1166: "vitamin_b2_mg", 1167: "vitamin_b3_mg", 1175: "vitamin_b6_mg", 1177: "folate_mcg", 1178: "vitamin_b12_mcg", 1106: "vitamin_a_mcg", 1114: "vitamin_d_mcg"}
    for fn in food_data.get("foodNutrients", []):
        nutrient_id = fn.get("nutrient", {}).get("id") or fn.get("nutrientId")
        amount = fn.get("amount", 0) or 0
        if nutrient_id in nutrient_mapping:
            nutrients[nutrient_mapping[nutrient_id]] = round(amount * portion_factor, 3)
    return nutrients

def calculate_elemental_composition(nutrients: Dict[str, float]) -> Dict[str, Any]:
    elements = {"C": 0.0, "H": 0.0, "O": 0.0, "N": 0.0, "S": 0.0, "Ca": 0.0, "Fe": 0.0, "Mg": 0.0, "P": 0.0, "K": 0.0, "Na": 0.0, "Zn": 0.0}
    protein_g = nutrients.get("protein_g", 0)
    carb_g = nutrients.get("carbohydrate_g", 0)
    fat_g = nutrients.get("fat_g", 0)
    for element, fraction in ELEMENTAL_FRACTIONS["protein"].items():
        elements[element] += protein_g * fraction
    for element, fraction in ELEMENTAL_FRACTIONS["carbohydrate"].items():
        elements[element] += carb_g * fraction
    for element, fraction in ELEMENTAL_FRACTIONS["fat"].items():
        elements[element] += fat_g * fraction
    mineral_mapping = {"calcium_mg": "Ca", "iron_mg": "Fe", "magnesium_mg": "Mg", "phosphorus_mg": "P", "potassium_mg": "K", "sodium_mg": "Na", "zinc_mg": "Zn"}
    for nutrient_key, element in mineral_mapping.items():
        if nutrient_key in nutrients:
            elements[element] = nutrients[nutrient_key] / 1000
    elements = {k: round(v, 6) for k, v in elements.items()}
    millimoles = {el: round((mass / ATOMIC_WEIGHTS.get(el, 1)) * 1000, 4) for el, mass in elements.items() if mass > 0 and el in ATOMIC_WEIGHTS}
    return {"mass_grams": elements, "millimoles": millimoles, "confidence": "high" if protein_g > 0 or carb_g > 0 or fat_g > 0 else "estimated"}

def apply_cooking_retention(nutrients: Dict[str, float], cooking_method: str) -> Dict[str, float]:
    if cooking_method not in RETENTION_FACTORS:
        cooking_method = "raw"
    factors = RETENTION_FACTORS[cooking_method]
    cooked_nutrients = nutrients.copy()
    retention_mapping = {"vitamin_a_mcg": "vitamin_a", "vitamin_c_mg": "vitamin_c", "vitamin_b1_mg": "vitamin_b1", "vitamin_b2_mg": "vitamin_b2", "vitamin_b3_mg": "vitamin_b3", "vitamin_b6_mg": "vitamin_b6", "vitamin_b12_mcg": "vitamin_b12", "vitamin_d_mcg": "vitamin_d", "folate_mcg": "folate", "iron_mg": "iron", "magnesium_mg": "magnesium", "potassium_mg": "potassium", "zinc_mg": "zinc", "calcium_mg": "calcium", "protein_g": "protein"}
    for nutrient_key, factor_key in retention_mapping.items():
        if nutrient_key in cooked_nutrients and factor_key in factors:
            cooked_nutrients[nutrient_key] = round(cooked_nutrients[nutrient_key] * factors[factor_key], 3)
    return cooked_nutrients

def detect_allergens(food_name: str, ingredients: Optional[str] = None) -> List[str]:
    detected = []
    text = food_name.lower() + (" " + ingredients.lower() if ingredients else "")
    categories = {"peanut": "peanuts", "milk": "dairy", "dairy": "dairy", "egg": "eggs", "wheat": "wheat/gluten", "gluten": "wheat/gluten", "soy": "soy", "fish": "fish", "shellfish": "shellfish", "sesame": "sesame"}
    for allergen in ALLERGENS:
        if allergen in text:
            cat = categories.get(allergen, allergen)
            if cat not in detected:
                detected.append(cat)
    return detected

# ================== FOOD ENDPOINTS ==================

@api_router.post("/foods/search")
async def search_foods(request: FoodSearchRequest):
    foods = await search_usda_foods(request.query, request.page_size)
    return {"foods": foods, "query": request.query}

@api_router.post("/foods/analyze")
async def analyze_food(request: FoodAnalysisRequest):
    food_data = await get_usda_food_details(request.fdc_id)
    if not food_data:
        raise HTTPException(status_code=404, detail="Food not found")
    
    raw_nutrients = extract_nutrients(food_data, request.portion_grams)
    cooked_nutrients = apply_cooking_retention(raw_nutrients, request.cooking_method)
    elements = calculate_elemental_composition(cooked_nutrients)
    food_name = food_data.get("description", "")
    allergens = detect_allergens(food_name, food_data.get("ingredients", ""))
    bio_effects = {el: BIOLOGICAL_EFFECTS[el] for el in elements["mass_grams"] if el in BIOLOGICAL_EFFECTS and elements["mass_grams"][el] > 0}
    
    method_scores = {m: sum(f.values())/len(f) for m, f in RETENTION_FACTORS.items() if m != "raw"}
    ranked_methods = sorted(method_scores.items(), key=lambda x: x[1], reverse=True)
    
    return {
        "fdc_id": request.fdc_id, "food_name": food_name, "portion_grams": request.portion_grams, "cooking_method": request.cooking_method,
        "nutrients": {"raw": raw_nutrients, "cooked": cooked_nutrients, "retention_applied": request.cooking_method != "raw"},
        "elements": elements, "allergens": allergens, "biological_effects": bio_effects,
        "cooking_recommendations": {"recommended_method": ranked_methods[0][0], "method_rankings": [{"method": m, "avg_retention": round(s*100, 1)} for m, s in ranked_methods]},
        "data_source": "USDA FoodData Central", "confidence": elements["confidence"]
    }

@api_router.get("/foods/retention-factors")
async def get_retention_factors():
    return {"retention_factors": RETENTION_FACTORS, "cooking_methods": list(RETENTION_FACTORS.keys())}

@api_router.get("/foods/safe-temps")
async def get_safe_temperatures():
    return {"temperatures": SAFE_COOKING_TEMPS}

# ================== MEAL TRACKING ENDPOINTS ==================

@api_router.post("/meals")
async def add_meal(meal: MealEntryCreate, user: User = Depends(require_user)):
    meal_entry = MealEntry(user_id=user.user_id, **meal.dict())
    await db.meals.insert_one(meal_entry.dict())
    await update_daily_summary(user.user_id, meal_entry.date)
    return {"message": "Meal added", "meal_id": meal_entry.id}

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

# ================== WATER TRACKING ENDPOINTS ==================

@api_router.post("/water")
async def add_water(water: WaterLogCreate, user: User = Depends(require_user)):
    water_log = WaterLog(user_id=user.user_id, amount_ml=water.amount_ml)
    await db.water_logs.insert_one(water_log.dict())
    await update_daily_summary(user.user_id, water_log.date)
    return {"message": "Water logged", "log_id": water_log.id, "amount_ml": water.amount_ml}

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
    pipeline = [
        {"$match": {"user_id": user.user_id, "date": {"$gte": start_date}}},
        {"$group": {"_id": "$date", "total_ml": {"$sum": "$amount_ml"}}},
        {"$sort": {"_id": -1}}
    ]
    history = await db.water_logs.aggregate(pipeline).to_list(30)
    return {"history": [{"date": h["_id"], "total_ml": h["total_ml"]} for h in history]}

@api_router.get("/water/smart-goal")
async def get_smart_water_goal(user: User = Depends(require_user)):
    """Calculate dynamic water goal based on weight, activity, and weather"""
    # Base calculation: 30-35ml per kg body weight
    base_ml = user.weight_kg * 33
    
    # Activity multiplier
    activity_multipliers = {"sedentary": 0.9, "light": 1.0, "moderate": 1.1, "active": 1.2, "very_active": 1.3}
    activity_mult = activity_multipliers.get(user.activity_level, 1.0)
    
    # Weather adjustment (simplified - in production, use actual weather API)
    weather_mult = 1.0  # Would be higher in hot weather
    
    recommended = int(base_ml * activity_mult * weather_mult)
    
    return {
        "recommended_ml": recommended,
        "base_ml": int(base_ml),
        "weight_kg": user.weight_kg,
        "activity_level": user.activity_level,
        "factors": {"activity_multiplier": activity_mult, "weather_multiplier": weather_mult}
    }

# ================== ROUTINE ENDPOINTS ==================

@api_router.post("/routines")
async def create_routine(routine: RoutineCreate, user: User = Depends(require_user)):
    routine_obj = Routine(user_id=user.user_id, **routine.dict())
    await db.routines.insert_one(routine_obj.dict())
    return {"message": "Routine created", "routine_id": routine_obj.id}

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
    completion = TaskCompletion(user_id=user.user_id, routine_id=routine_id, task_id=task_id, date=today)
    await db.task_completions.insert_one(completion.dict())
    await update_daily_summary(user.user_id, today)
    return {"message": "Task completed"}

@api_router.get("/routines/today")
async def get_today_routines(user: User = Depends(require_user)):
    today = datetime.now(timezone.utc).strftime("%Y-%m-%d")
    day_of_week = datetime.now(timezone.utc).strftime("%a").lower()
    
    routines = await db.routines.find({"user_id": user.user_id, "is_active": True, "days": day_of_week}, {"_id": 0}).to_list(20)
    completions = await db.task_completions.find({"user_id": user.user_id, "date": today}, {"_id": 0}).to_list(200)
    completed_task_ids = {c["task_id"] for c in completions}
    
    # Enrich routines with completion status
    for routine in routines:
        for task in routine.get("tasks", []):
            task["completed"] = task.get("id", "") in completed_task_ids
    
    return {"routines": routines, "date": today}

@api_router.get("/routines/streak")
async def get_routine_streak(user: User = Depends(require_user)):
    """Calculate current streak of completing all routines"""
    streak = 0
    current_date = datetime.now(timezone.utc).date()
    
    for i in range(365):  # Check up to a year
        check_date = (current_date - timedelta(days=i)).strftime("%Y-%m-%d")
        summary = await db.daily_summaries.find_one({"user_id": user.user_id, "date": check_date}, {"_id": 0})
        
        if summary and summary.get("routines_completed", 0) > 0 and summary.get("routines_completed") >= summary.get("routines_total", 1):
            streak += 1
        elif i > 0:  # Don't break on today
            break
    
    return {"streak_days": streak}

# ================== DASHBOARD & SUMMARY ==================

async def update_daily_summary(user_id: str, date: str):
    """Update daily summary with latest data"""
    # Get meals
    meals = await db.meals.find({"user_id": user_id, "date": date}, {"_id": 0}).to_list(100)
    total_nutrients = {}
    total_elements = {}
    
    for meal in meals:
        for key, value in meal.get("nutrients", {}).items():
            total_nutrients[key] = total_nutrients.get(key, 0) + value
        for key, value in meal.get("elements", {}).items():
            total_elements[key] = total_elements.get(key, 0) + value
    
    # Get water
    water_logs = await db.water_logs.find({"user_id": user_id, "date": date}, {"_id": 0}).to_list(100)
    total_water = sum(log["amount_ml"] for log in water_logs)
    
    # Get routine completions
    day_of_week = datetime.strptime(date, "%Y-%m-%d").strftime("%a").lower()
    routines = await db.routines.find({"user_id": user_id, "is_active": True, "days": day_of_week}, {"_id": 0}).to_list(20)
    completions = await db.task_completions.find({"user_id": user_id, "date": date}, {"_id": 0}).to_list(200)
    
    total_tasks = sum(len(r.get("tasks", [])) for r in routines)
    completed_tasks = len(completions)
    
    # Detect deficiencies
    deficiencies = []
    for nutrient, recommended in DAILY_RECOMMENDED.items():
        current = total_nutrients.get(nutrient, 0)
        if current < recommended * 0.5:  # Less than 50% of recommended
            deficiencies.append(nutrient)
    
    summary = {
        "user_id": user_id, "date": date,
        "total_calories": total_nutrients.get("energy_kcal", 0),
        "total_protein": total_nutrients.get("protein_g", 0),
        "total_carbs": total_nutrients.get("carbohydrate_g", 0),
        "total_fat": total_nutrients.get("fat_g", 0),
        "total_water_ml": total_water,
        "meals_count": len(meals),
        "nutrients": total_nutrients,
        "elements": total_elements,
        "deficiencies": deficiencies,
        "routines_completed": completed_tasks,
        "routines_total": total_tasks
    }
    
    await db.daily_summaries.update_one({"user_id": user_id, "date": date}, {"$set": summary}, upsert=True)
    return summary

@api_router.get("/dashboard")
async def get_dashboard(user: User = Depends(require_user)):
    """Get unified dashboard data - one glance = full status"""
    today = datetime.now(timezone.utc).strftime("%Y-%m-%d")
    
    # Get or create today's summary
    summary = await db.daily_summaries.find_one({"user_id": user.user_id, "date": today}, {"_id": 0})
    if not summary:
        summary = await update_daily_summary(user.user_id, today)
    
    # Get settings
    settings = await db.user_settings.find_one({"user_id": user.user_id}, {"_id": 0}) or {}
    
    # Get today's meals
    meals = await db.meals.find({"user_id": user.user_id, "date": today}, {"_id": 0}).sort("timestamp", -1).limit(5).to_list(5)
    
    # Get today's water
    water_data = await get_today_water.__wrapped__(user)
    
    # Get today's routines
    routines_data = await get_today_routines.__wrapped__(user)
    
    # Get streak
    streak_data = await get_routine_streak.__wrapped__(user)
    
    # Get recent insights
    insights = await db.insights.find({"user_id": user.user_id, "date": today}, {"_id": 0}).sort("created_at", -1).limit(5).to_list(5)
    
    # Calculate progress percentages
    calorie_goal = settings.get("daily_calorie_goal", 2000)
    protein_goal = settings.get("daily_protein_goal", 50)
    water_goal = settings.get("daily_water_goal_ml", 2500)
    
    return {
        "date": today,
        "user": {"name": user.name, "weight_kg": user.weight_kg, "activity_level": user.activity_level},
        "nutrition": {
            "calories": {"current": summary.get("total_calories", 0), "goal": calorie_goal, "percentage": min(100, round((summary.get("total_calories", 0) / calorie_goal) * 100, 1))},
            "protein": {"current": summary.get("total_protein", 0), "goal": protein_goal, "percentage": min(100, round((summary.get("total_protein", 0) / protein_goal) * 100, 1))},
            "carbs": {"current": summary.get("total_carbs", 0)},
            "fat": {"current": summary.get("total_fat", 0)},
            "deficiencies": summary.get("deficiencies", []),
            "meals_count": summary.get("meals_count", 0)
        },
        "hydration": {
            "current_ml": water_data["total_ml"],
            "goal_ml": water_goal,
            "percentage": water_data["percentage"],
            "logs_count": len(water_data["logs"])
        },
        "routines": {
            "completed": summary.get("routines_completed", 0),
            "total": summary.get("routines_total", 0),
            "percentage": round((summary.get("routines_completed", 0) / max(summary.get("routines_total", 1), 1)) * 100, 1),
            "streak_days": streak_data["streak_days"],
            "today_routines": routines_data["routines"]
        },
        "elements": summary.get("elements", {}),
        "recent_meals": meals,
        "insights": insights
    }

# ================== AI INSIGHTS ENGINE ==================

@api_router.post("/ai/recommendations")
async def get_ai_recommendations(request: AIRecommendationRequest):
    from emergentintegrations.llm.chat import LlmChat, UserMessage
    
    goal_descriptions = {
        "muscle_gain": "building muscle mass with high protein and nitrogen balance",
        "immune_system": "boosting immune function with vitamin C, zinc, and antioxidants",
        "brain_health": "improving cognitive function with omega-3s and B vitamins",
        "gut_microbiome": "supporting gut health with fiber and probiotics",
        "energy": "increasing energy with B vitamins, iron, and complex carbs",
        "weight_loss": "healthy weight loss with high protein and fiber"
    }
    
    goal_desc = goal_descriptions.get(request.goal, request.goal)
    restrictions_text = f"\nAvoid: {', '.join(request.dietary_restrictions)}" if request.dietary_restrictions else ""
    
    prompt = f"""As a molecular nutrition expert, recommend 5 foods for {goal_desc}.{restrictions_text}

For each food provide:
1. Key nutrients and elements
2. Health benefit
3. Best cooking method
4. Synergistic foods

Respond as JSON array:
[{{"food": "name", "key_nutrients": ["n1", "n2"], "key_elements": ["e1"], "health_benefit": "explanation", "best_cooking": "method", "synergistic_foods": ["f1", "f2"]}}]

Only respond with JSON array."""

    try:
        chat = LlmChat(api_key=EMERGENT_LLM_KEY, session_id=f"nutrition_{uuid.uuid4().hex[:8]}", system_message="You are a molecular nutrition expert. Always respond with valid JSON.").with_model("gemini", "gemini-3-flash-preview")
        response = await chat.send_message(UserMessage(text=prompt))
        
        response_text = response.strip()
        if response_text.startswith("```"):
            response_text = response_text.split("```")[1]
            if response_text.startswith("json"):
                response_text = response_text[4:]
        
        recommendations = json.loads(response_text)
        return {"goal": request.goal, "recommendations": recommendations, "ai_model": "gemini-3-flash-preview"}
    except Exception as e:
        logger.error(f"AI recommendation error: {str(e)}")
        # Fallback recommendations
        fallback = {
            "muscle_gain": [{"food": "Salmon", "key_nutrients": ["protein", "omega-3"], "key_elements": ["N", "P"], "health_benefit": "Complete protein with anti-inflammatory fats", "best_cooking": "baking", "synergistic_foods": ["quinoa", "spinach"]}],
            "immune_system": [{"food": "Citrus Fruits", "key_nutrients": ["vitamin C", "fiber"], "key_elements": ["C", "K"], "health_benefit": "Powerful antioxidant support", "best_cooking": "raw", "synergistic_foods": ["spinach", "bell peppers"]}],
            "brain_health": [{"food": "Fatty Fish", "key_nutrients": ["omega-3", "vitamin D"], "key_elements": ["P", "Se"], "health_benefit": "DHA for brain cell membranes", "best_cooking": "baking", "synergistic_foods": ["leafy greens", "olive oil"]}]
        }
        return {"goal": request.goal, "recommendations": fallback.get(request.goal, fallback["immune_system"]), "ai_model": "fallback"}

@api_router.post("/ai/generate-insights")
async def generate_daily_insights(user: User = Depends(require_user)):
    """Generate AI-powered daily insights based on user data"""
    from emergentintegrations.llm.chat import LlmChat, UserMessage
    
    today = datetime.now(timezone.utc).strftime("%Y-%m-%d")
    
    # Get dashboard data
    summary = await db.daily_summaries.find_one({"user_id": user.user_id, "date": today}, {"_id": 0})
    settings = await db.user_settings.find_one({"user_id": user.user_id}, {"_id": 0}) or {}
    
    if not summary:
        summary = {"total_calories": 0, "total_protein": 0, "total_water_ml": 0, "deficiencies": [], "routines_completed": 0, "routines_total": 0}
    
    calorie_goal = settings.get("daily_calorie_goal", 2000)
    protein_goal = settings.get("daily_protein_goal", 50)
    water_goal = settings.get("daily_water_goal_ml", 2500)
    
    prompt = f"""Analyze this user's daily health data and generate 3-5 actionable insights:

Nutrition:
- Calories: {summary.get('total_calories', 0)}/{calorie_goal} kcal
- Protein: {summary.get('total_protein', 0)}/{protein_goal}g
- Deficiencies detected: {', '.join(summary.get('deficiencies', [])) or 'None'}

Hydration:
- Water: {summary.get('total_water_ml', 0)}/{water_goal}ml

Routines:
- Completed: {summary.get('routines_completed', 0)}/{summary.get('routines_total', 0)} tasks

User goals: {', '.join(user.health_goals) if user.health_goals else 'general health'}
Activity level: {user.activity_level}

Generate insights as JSON array:
[{{"category": "nutrition|hydration|routine|prediction", "title": "short title", "message": "actionable insight", "priority": "low|normal|high", "action_type": "drink_water|eat_protein|complete_task|null"}}]

Only respond with JSON array."""

    try:
        chat = LlmChat(api_key=EMERGENT_LLM_KEY, session_id=f"insights_{uuid.uuid4().hex[:8]}", system_message="You are a health insights AI. Generate actionable, personalized health insights. Always respond with valid JSON.").with_model("gemini", "gemini-3-flash-preview")
        response = await chat.send_message(UserMessage(text=prompt))
        
        response_text = response.strip()
        if response_text.startswith("```"):
            response_text = response_text.split("```")[1]
            if response_text.startswith("json"):
                response_text = response_text[4:]
        
        insights_data = json.loads(response_text)
        
        # Save insights to database
        for insight_data in insights_data:
            insight = AIInsight(user_id=user.user_id, date=today, **insight_data)
            await db.insights.insert_one(insight.dict())
        
        return {"insights": insights_data, "date": today}
    except Exception as e:
        logger.error(f"Insight generation error: {str(e)}")
        # Generate basic insights
        basic_insights = []
        
        if summary.get("total_water_ml", 0) < water_goal * 0.5:
            basic_insights.append({"category": "hydration", "title": "Low Hydration Alert", "message": f"You've only had {summary.get('total_water_ml', 0)}ml of water. Drink more to maintain energy levels.", "priority": "high", "action_type": "drink_water"})
        
        if summary.get("total_protein", 0) < protein_goal * 0.5:
            basic_insights.append({"category": "nutrition", "title": "Protein Intake Low", "message": f"Your protein intake is at {summary.get('total_protein', 0):.1f}g. Add a protein-rich meal for muscle maintenance.", "priority": "normal", "action_type": "eat_protein"})
        
        if summary.get("deficiencies"):
            basic_insights.append({"category": "nutrition", "title": "Nutrient Deficiency Detected", "message": f"You're low on: {', '.join(summary.get('deficiencies', [])[:3])}. Consider foods rich in these nutrients.", "priority": "normal", "action_type": None})
        
        return {"insights": basic_insights, "date": today, "source": "fallback"}

@api_router.get("/ai/insights")
async def get_insights(user: User = Depends(require_user)):
    """Get recent AI insights"""
    today = datetime.now(timezone.utc).strftime("%Y-%m-%d")
    insights = await db.insights.find({"user_id": user.user_id, "date": today}, {"_id": 0}).sort("created_at", -1).to_list(10)
    return {"insights": insights}

@api_router.post("/ai/predictive-recommendations")
async def get_predictive_recommendations(user: User = Depends(require_user)):
    """Get predictive recommendations based on patterns"""
    from emergentintegrations.llm.chat import LlmChat, UserMessage
    
    # Get last 7 days of data
    end_date = datetime.now(timezone.utc).strftime("%Y-%m-%d")
    start_date = (datetime.now(timezone.utc) - timedelta(days=7)).strftime("%Y-%m-%d")
    
    summaries = await db.daily_summaries.find({"user_id": user.user_id, "date": {"$gte": start_date, "$lte": end_date}}, {"_id": 0}).to_list(7)
    
    # Calculate averages
    if not summaries:
        return {"recommendations": [], "message": "Not enough data for predictions. Log more meals and activities."}
    
    avg_calories = sum(s.get("total_calories", 0) for s in summaries) / len(summaries)
    avg_protein = sum(s.get("total_protein", 0) for s in summaries) / len(summaries)
    avg_water = sum(s.get("total_water_ml", 0) for s in summaries) / len(summaries)
    routine_completion_rate = sum(s.get("routines_completed", 0) for s in summaries) / max(sum(s.get("routines_total", 1) for s in summaries), 1)
    
    prompt = f"""Based on this user's 7-day health patterns, provide predictive recommendations:

Weekly Averages:
- Calories: {avg_calories:.0f}/day
- Protein: {avg_protein:.1f}g/day
- Water: {avg_water:.0f}ml/day
- Routine completion: {routine_completion_rate*100:.0f}%

User profile:
- Weight: {user.weight_kg}kg
- Activity: {user.activity_level}
- Goals: {', '.join(user.health_goals) if user.health_goals else 'general health'}

Generate 3 predictive recommendations as JSON:
[{{"type": "meal_timing|hydration|routine|exercise", "title": "recommendation", "description": "detailed advice", "optimal_time": "time or time range", "expected_benefit": "what user will gain"}}]

Only respond with JSON array."""

    try:
        chat = LlmChat(api_key=EMERGENT_LLM_KEY, session_id=f"predict_{uuid.uuid4().hex[:8]}", system_message="You are a predictive health AI. Analyze patterns and provide forward-looking recommendations.").with_model("gemini", "gemini-3-flash-preview")
        response = await chat.send_message(UserMessage(text=prompt))
        
        response_text = response.strip()
        if response_text.startswith("```"):
            response_text = response_text.split("```")[1]
            if response_text.startswith("json"):
                response_text = response_text[4:]
        
        recommendations = json.loads(response_text)
        return {"recommendations": recommendations, "weekly_stats": {"avg_calories": avg_calories, "avg_protein": avg_protein, "avg_water": avg_water, "routine_completion": routine_completion_rate}}
    except Exception as e:
        logger.error(f"Predictive recommendation error: {str(e)}")
        return {"recommendations": [
            {"type": "meal_timing", "title": "Optimal Eating Window", "description": "Based on your activity level, eating your main meal 1-2 hours before workouts can improve energy.", "optimal_time": "12:00-13:00", "expected_benefit": "Better workout performance"},
            {"type": "hydration", "title": "Pre-routine Hydration", "description": "Drink 500ml water 30 minutes before your morning routine for better focus.", "optimal_time": "06:30", "expected_benefit": "Improved morning energy"}
        ]}

# ================== UTILITY ENDPOINTS ==================

@api_router.get("/")
async def root():
    return {"message": "NutriMolecule - Personal Health OS", "version": "2.0.0", "status": "healthy"}

@api_router.get("/elements/info")
async def get_elements_info():
    return {"elements": ATOMIC_WEIGHTS, "biological_effects": BIOLOGICAL_EFFECTS, "elemental_fractions": ELEMENTAL_FRACTIONS}

@api_router.get("/allergens/list")
async def get_allergens_list():
    return {"allergen_categories": ["peanuts", "tree nuts", "dairy", "eggs", "wheat/gluten", "soy", "fish", "shellfish", "sesame"]}

@api_router.get("/recommended-values")
async def get_recommended_values():
    return {"daily_recommended": DAILY_RECOMMENDED}

# Include router
app.include_router(api_router)

app.add_middleware(CORSMiddleware, allow_credentials=True, allow_origins=["*"], allow_methods=["*"], allow_headers=["*"])

@app.on_event("shutdown")
async def shutdown_db_client():
    client.close()
