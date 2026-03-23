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

ROOT_DIR = Path(__file__).parent
load_dotenv(ROOT_DIR / '.env')

# MongoDB connection
mongo_url = os.environ['MONGO_URL']
client = AsyncIOMotorClient(mongo_url)
db = client[os.environ.get('DB_NAME', 'nutrient_mapper')]

# USDA API Configuration
USDA_API_KEY = "RwaqOhfPSJZJVfvVB0jc71rXAS0yjQbtvRSnudXk"
USDA_BASE_URL = "https://api.nal.usda.gov/fdc/v1"

# Emergent LLM Key for AI recommendations
EMERGENT_LLM_KEY = os.environ.get('EMERGENT_LLM_KEY', 'sk-emergent-16f3b56Af3500F2517')

# Create the main app
app = FastAPI(title="Molecular Nutrition Engine")

# Create a router with the /api prefix
api_router = APIRouter(prefix="/api")

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)

# ================== CONSTANTS & DATA ==================

# Elemental fractions from macronutrients (literature averages)
ELEMENTAL_FRACTIONS = {
    "protein": {"C": 0.50, "H": 0.07, "O": 0.22, "N": 0.16, "S": 0.02},
    "carbohydrate": {"C": 0.40, "H": 0.067, "O": 0.533},
    "fat": {"C": 0.76, "H": 0.123, "O": 0.117}
}

# Atomic weights for conversion to moles
ATOMIC_WEIGHTS = {
    "C": 12.011, "H": 1.008, "O": 15.999, "N": 14.007, "S": 32.065,
    "Na": 22.990, "K": 39.098, "Ca": 40.078, "Fe": 55.845, "Zn": 65.38,
    "Mg": 24.305, "P": 30.974, "Cl": 35.453, "Se": 78.971, "Cu": 63.546,
    "Mn": 54.938, "I": 126.904
}

# Cooking retention factors (percentage retained) per cooking method
# Source: USDA/FAO retention factor tables
RETENTION_FACTORS = {
    "boiling": {
        "vitamin_a": 0.75, "vitamin_b1": 0.55, "vitamin_b2": 0.70, "vitamin_b3": 0.65,
        "vitamin_b6": 0.55, "vitamin_b12": 0.80, "vitamin_c": 0.45, "vitamin_d": 0.90,
        "folate": 0.50, "iron": 0.90, "magnesium": 0.75, "potassium": 0.70,
        "zinc": 0.85, "calcium": 0.80, "protein": 0.95
    },
    "steaming": {
        "vitamin_a": 0.90, "vitamin_b1": 0.75, "vitamin_b2": 0.85, "vitamin_b3": 0.80,
        "vitamin_b6": 0.75, "vitamin_b12": 0.90, "vitamin_c": 0.70, "vitamin_d": 0.95,
        "folate": 0.70, "iron": 0.95, "magnesium": 0.90, "potassium": 0.85,
        "zinc": 0.95, "calcium": 0.90, "protein": 0.98
    },
    "frying": {
        "vitamin_a": 0.80, "vitamin_b1": 0.65, "vitamin_b2": 0.75, "vitamin_b3": 0.70,
        "vitamin_b6": 0.65, "vitamin_b12": 0.85, "vitamin_c": 0.50, "vitamin_d": 0.85,
        "folate": 0.60, "iron": 0.85, "magnesium": 0.85, "potassium": 0.80,
        "zinc": 0.90, "calcium": 0.85, "protein": 0.92
    },
    "baking": {
        "vitamin_a": 0.85, "vitamin_b1": 0.70, "vitamin_b2": 0.80, "vitamin_b3": 0.75,
        "vitamin_b6": 0.70, "vitamin_b12": 0.90, "vitamin_c": 0.55, "vitamin_d": 0.90,
        "folate": 0.65, "iron": 0.90, "magnesium": 0.88, "potassium": 0.82,
        "zinc": 0.92, "calcium": 0.88, "protein": 0.95
    },
    "raw": {
        "vitamin_a": 1.0, "vitamin_b1": 1.0, "vitamin_b2": 1.0, "vitamin_b3": 1.0,
        "vitamin_b6": 1.0, "vitamin_b12": 1.0, "vitamin_c": 1.0, "vitamin_d": 1.0,
        "folate": 1.0, "iron": 1.0, "magnesium": 1.0, "potassium": 1.0,
        "zinc": 1.0, "calcium": 1.0, "protein": 1.0
    }
}

# Safe minimum cooking temperatures (°F and °C)
SAFE_COOKING_TEMPS = {
    "poultry": {"fahrenheit": 165, "celsius": 74, "description": "All poultry (chicken, turkey, duck)"},
    "ground_meat": {"fahrenheit": 160, "celsius": 71, "description": "Ground beef, pork, lamb"},
    "beef_steak": {"fahrenheit": 145, "celsius": 63, "description": "Steaks, roasts (rest 3 min)"},
    "pork": {"fahrenheit": 145, "celsius": 63, "description": "Pork chops, roasts (rest 3 min)"},
    "fish": {"fahrenheit": 145, "celsius": 63, "description": "Fish and shellfish"},
    "eggs": {"fahrenheit": 160, "celsius": 71, "description": "Egg dishes"},
    "leftovers": {"fahrenheit": 165, "celsius": 74, "description": "Leftovers and casseroles"}
}

# Top allergens
ALLERGENS = [
    "peanut", "peanuts", "tree nut", "tree nuts", "almond", "almonds", "walnut", "walnuts",
    "cashew", "cashews", "pistachio", "pistachios", "hazelnut", "hazelnuts", "pecan", "pecans",
    "milk", "dairy", "lactose", "cheese", "butter", "cream", "whey", "casein",
    "egg", "eggs", "albumin",
    "wheat", "gluten", "flour", "bread", "pasta",
    "soy", "soybean", "soybeans", "tofu", "tempeh",
    "fish", "salmon", "tuna", "cod", "tilapia",
    "shellfish", "shrimp", "crab", "lobster", "clam", "mussel", "oyster",
    "sesame", "sesame seeds",
    "sulfite", "sulfites", "sulphite", "sulphites"
]

# Biological effects mapping
BIOLOGICAL_EFFECTS = {
    "C": ["Energy metabolism", "Cell structure", "Organic compound synthesis"],
    "H": ["Cellular hydration", "Acid-base balance", "Energy carrier (NADH)"],
    "O": ["Cellular respiration", "Water formation", "Oxidation reactions"],
    "N": ["Protein synthesis", "DNA/RNA building", "Neurotransmitter production"],
    "S": ["Protein structure (disulfide bonds)", "Antioxidant function", "Detoxification"],
    "Fe": ["Oxygen transport (hemoglobin)", "Energy production", "Immune function"],
    "Ca": ["Bone health", "Muscle contraction", "Nerve signaling"],
    "K": ["Heart rhythm", "Muscle function", "Fluid balance"],
    "Mg": ["Enzyme activation", "Muscle/nerve function", "Energy production"],
    "Zn": ["Immune function", "Wound healing", "DNA synthesis"],
    "Na": ["Fluid balance", "Nerve transmission", "Muscle contraction"],
    "P": ["Bone formation", "Energy storage (ATP)", "Cell membranes"]
}

# USDA nutrient ID mapping
NUTRIENT_IDS = {
    "energy": 1008, "protein": 1003, "fat": 1004, "carbohydrate": 1005,
    "fiber": 1079, "sugars": 2000, "calcium": 1087, "iron": 1089,
    "magnesium": 1090, "phosphorus": 1091, "potassium": 1092, "sodium": 1093,
    "zinc": 1095, "copper": 1098, "manganese": 1101, "selenium": 1103,
    "vitamin_c": 1162, "vitamin_b1": 1165, "vitamin_b2": 1166, "vitamin_b3": 1167,
    "vitamin_b6": 1175, "folate": 1177, "vitamin_b12": 1178, "vitamin_a": 1106,
    "vitamin_d": 1114, "vitamin_e": 1109, "vitamin_k": 1185
}

# ================== PYDANTIC MODELS ==================

class UserCreate(BaseModel):
    email: str
    name: str
    picture: Optional[str] = None

class User(BaseModel):
    user_id: str
    email: str
    name: str
    picture: Optional[str] = None
    created_at: datetime

class SessionData(BaseModel):
    session_token: str
    user_id: str
    expires_at: datetime

class FoodSearchRequest(BaseModel):
    query: str
    page_size: int = 10

class FoodAnalysisRequest(BaseModel):
    fdc_id: int
    portion_grams: float = 100.0
    cooking_method: str = "raw"

class FoodEntry(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    user_id: str
    fdc_id: int
    food_name: str
    portion_grams: float
    cooking_method: str
    nutrients: Dict[str, float]
    elements: Dict[str, float]
    allergens: List[str]
    timestamp: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))

class FoodEntryCreate(BaseModel):
    fdc_id: int
    food_name: str
    portion_grams: float
    cooking_method: str
    nutrients: Dict[str, float]
    elements: Dict[str, float]
    allergens: List[str]

class AIRecommendationRequest(BaseModel):
    goal: str  # "muscle_gain", "immune_system", "brain_health", "gut_microbiome"
    current_foods: Optional[List[str]] = []
    dietary_restrictions: Optional[List[str]] = []

class DailyLog(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    user_id: str
    date: str  # YYYY-MM-DD format
    total_nutrients: Dict[str, float]
    total_elements: Dict[str, float]
    foods: List[Dict[str, Any]]
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))

# ================== AUTH HELPERS ==================

async def get_current_user(request: Request) -> Optional[User]:
    """Extract and validate user from session token"""
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
    """Require authenticated user"""
    user = await get_current_user(request)
    if not user:
        raise HTTPException(status_code=401, detail="Not authenticated")
    return user

# ================== AUTH ENDPOINTS ==================

@api_router.post("/auth/session")
async def create_session(request: Request, response: Response):
    """Exchange session_id for session_token"""
    body = await request.json()
    session_id = body.get("session_id")
    
    if not session_id:
        raise HTTPException(status_code=400, detail="session_id required")
    
    # Call Emergent Auth to get user data
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
    
    # Find or create user
    existing_user = await db.users.find_one({"email": email}, {"_id": 0})
    
    if existing_user:
        user_id = existing_user["user_id"]
        # Update user info if changed
        await db.users.update_one(
            {"user_id": user_id},
            {"$set": {"name": name, "picture": picture}}
        )
    else:
        user_id = f"user_{uuid.uuid4().hex[:12]}"
        new_user = {
            "user_id": user_id,
            "email": email,
            "name": name,
            "picture": picture,
            "created_at": datetime.now(timezone.utc)
        }
        await db.users.insert_one(new_user)
    
    # Create session
    expires_at = datetime.now(timezone.utc) + timedelta(days=7)
    session_doc = {
        "session_token": session_token,
        "user_id": user_id,
        "expires_at": expires_at,
        "created_at": datetime.now(timezone.utc)
    }
    
    # Remove old sessions for this user
    await db.user_sessions.delete_many({"user_id": user_id})
    await db.user_sessions.insert_one(session_doc)
    
    # Set cookie
    response.set_cookie(
        key="session_token",
        value=session_token,
        httponly=True,
        secure=True,
        samesite="none",
        path="/",
        max_age=7 * 24 * 60 * 60
    )
    
    user_doc = await db.users.find_one({"user_id": user_id}, {"_id": 0})
    return user_doc

@api_router.get("/auth/me")
async def get_me(user: User = Depends(require_user)):
    """Get current user"""
    return {
        "user_id": user.user_id,
        "email": user.email,
        "name": user.name,
        "picture": user.picture
    }

@api_router.post("/auth/logout")
async def logout(request: Request, response: Response):
    """Logout user"""
    session_token = request.cookies.get("session_token")
    if session_token:
        await db.user_sessions.delete_many({"session_token": session_token})
    
    response.delete_cookie(key="session_token", path="/")
    return {"message": "Logged out"}

# ================== USDA API FUNCTIONS ==================

async def search_usda_foods(query: str, page_size: int = 10) -> List[Dict]:
    """Search USDA FoodData Central"""
    async with httpx.AsyncClient() as client_http:
        response = await client_http.get(
            f"{USDA_BASE_URL}/foods/search",
            params={
                "api_key": USDA_API_KEY,
                "query": query,
                "pageSize": page_size,
                "dataType": ["Foundation", "SR Legacy", "Survey (FNDDS)"]
            }
        )
        
        if response.status_code != 200:
            logger.error(f"USDA API error: {response.status_code} - {response.text}")
            return []
        
        data = response.json()
        foods = data.get("foods", [])
        
        return [{
            "fdc_id": food.get("fdcId"),
            "description": food.get("description"),
            "brand_owner": food.get("brandOwner"),
            "data_type": food.get("dataType"),
            "food_category": food.get("foodCategory")
        } for food in foods]

async def get_usda_food_details(fdc_id: int) -> Optional[Dict]:
    """Get detailed food data from USDA"""
    async with httpx.AsyncClient() as client_http:
        response = await client_http.get(
            f"{USDA_BASE_URL}/food/{fdc_id}",
            params={"api_key": USDA_API_KEY}
        )
        
        if response.status_code != 200:
            logger.error(f"USDA API error: {response.status_code}")
            return None
        
        return response.json()

def extract_nutrients(food_data: Dict, portion_grams: float = 100.0) -> Dict[str, float]:
    """Extract nutrients from USDA food data"""
    nutrients = {}
    portion_factor = portion_grams / 100.0
    
    food_nutrients = food_data.get("foodNutrients", [])
    
    nutrient_mapping = {
        1008: "energy_kcal", 1003: "protein_g", 1004: "fat_g", 1005: "carbohydrate_g",
        1079: "fiber_g", 2000: "sugars_g", 1087: "calcium_mg", 1089: "iron_mg",
        1090: "magnesium_mg", 1091: "phosphorus_mg", 1092: "potassium_mg", 1093: "sodium_mg",
        1095: "zinc_mg", 1098: "copper_mg", 1101: "manganese_mg", 1103: "selenium_mcg",
        1162: "vitamin_c_mg", 1165: "vitamin_b1_mg", 1166: "vitamin_b2_mg", 1167: "vitamin_b3_mg",
        1175: "vitamin_b6_mg", 1177: "folate_mcg", 1178: "vitamin_b12_mcg", 1106: "vitamin_a_mcg",
        1114: "vitamin_d_mcg", 1109: "vitamin_e_mg", 1185: "vitamin_k_mcg"
    }
    
    for fn in food_nutrients:
        nutrient_id = fn.get("nutrient", {}).get("id") or fn.get("nutrientId")
        amount = fn.get("amount", 0) or 0
        
        if nutrient_id in nutrient_mapping:
            nutrients[nutrient_mapping[nutrient_id]] = round(amount * portion_factor, 3)
    
    return nutrients

def calculate_elemental_composition(nutrients: Dict[str, float], portion_grams: float = 100.0) -> Dict[str, Any]:
    """Calculate elemental composition from macronutrients and minerals"""
    elements = {
        "C": 0.0, "H": 0.0, "O": 0.0, "N": 0.0, "S": 0.0,
        "Ca": 0.0, "Fe": 0.0, "Mg": 0.0, "P": 0.0, "K": 0.0,
        "Na": 0.0, "Zn": 0.0, "Cu": 0.0, "Mn": 0.0, "Se": 0.0
    }
    
    # Calculate C, H, O, N, S from macronutrients
    protein_g = nutrients.get("protein_g", 0)
    carb_g = nutrients.get("carbohydrate_g", 0)
    fat_g = nutrients.get("fat_g", 0)
    
    # From protein
    for element, fraction in ELEMENTAL_FRACTIONS["protein"].items():
        elements[element] += protein_g * fraction
    
    # From carbohydrates
    for element, fraction in ELEMENTAL_FRACTIONS["carbohydrate"].items():
        elements[element] += carb_g * fraction
    
    # From fats
    for element, fraction in ELEMENTAL_FRACTIONS["fat"].items():
        elements[element] += fat_g * fraction
    
    # Add direct mineral values (convert mg to g)
    mineral_mapping = {
        "calcium_mg": "Ca", "iron_mg": "Fe", "magnesium_mg": "Mg",
        "phosphorus_mg": "P", "potassium_mg": "K", "sodium_mg": "Na",
        "zinc_mg": "Zn", "copper_mg": "Cu", "manganese_mg": "Mn"
    }
    
    for nutrient_key, element in mineral_mapping.items():
        if nutrient_key in nutrients:
            elements[element] = nutrients[nutrient_key] / 1000  # mg to g
    
    # Selenium (mcg to g)
    if "selenium_mcg" in nutrients:
        elements["Se"] = nutrients["selenium_mcg"] / 1000000
    
    # Round all values
    elements = {k: round(v, 6) for k, v in elements.items()}
    
    # Calculate atomic counts (moles * Avogadro's number, simplified to millimoles)
    atomic_counts = {}
    for element, mass_g in elements.items():
        if element in ATOMIC_WEIGHTS and mass_g > 0:
            moles = mass_g / ATOMIC_WEIGHTS[element]
            atomic_counts[element] = round(moles * 1000, 4)  # millimoles
    
    return {
        "mass_grams": elements,
        "millimoles": atomic_counts,
        "confidence": "high" if protein_g > 0 or carb_g > 0 or fat_g > 0 else "estimated"
    }

def apply_cooking_retention(nutrients: Dict[str, float], cooking_method: str) -> Dict[str, float]:
    """Apply cooking retention factors to nutrients"""
    if cooking_method not in RETENTION_FACTORS:
        cooking_method = "raw"
    
    factors = RETENTION_FACTORS[cooking_method]
    cooked_nutrients = nutrients.copy()
    
    # Apply retention factors to vitamins and minerals
    retention_mapping = {
        "vitamin_a_mcg": "vitamin_a", "vitamin_c_mg": "vitamin_c",
        "vitamin_b1_mg": "vitamin_b1", "vitamin_b2_mg": "vitamin_b2",
        "vitamin_b3_mg": "vitamin_b3", "vitamin_b6_mg": "vitamin_b6",
        "vitamin_b12_mcg": "vitamin_b12", "vitamin_d_mcg": "vitamin_d",
        "folate_mcg": "folate", "iron_mg": "iron", "magnesium_mg": "magnesium",
        "potassium_mg": "potassium", "zinc_mg": "zinc", "calcium_mg": "calcium",
        "protein_g": "protein"
    }
    
    for nutrient_key, factor_key in retention_mapping.items():
        if nutrient_key in cooked_nutrients and factor_key in factors:
            cooked_nutrients[nutrient_key] = round(
                cooked_nutrients[nutrient_key] * factors[factor_key], 3
            )
    
    return cooked_nutrients

def detect_allergens(food_name: str, ingredients: Optional[str] = None) -> List[str]:
    """Detect allergens in food name and ingredients"""
    detected = []
    text_to_check = food_name.lower()
    if ingredients:
        text_to_check += " " + ingredients.lower()
    
    for allergen in ALLERGENS:
        if allergen in text_to_check:
            # Categorize allergen
            category = allergen
            if allergen in ["peanut", "peanuts"]:
                category = "peanuts"
            elif allergen in ["milk", "dairy", "lactose", "cheese", "butter", "cream", "whey", "casein"]:
                category = "dairy"
            elif allergen in ["egg", "eggs", "albumin"]:
                category = "eggs"
            elif allergen in ["wheat", "gluten", "flour", "bread", "pasta"]:
                category = "wheat/gluten"
            elif allergen in ["soy", "soybean", "soybeans", "tofu", "tempeh"]:
                category = "soy"
            elif allergen in ["fish", "salmon", "tuna", "cod", "tilapia"]:
                category = "fish"
            elif allergen in ["shellfish", "shrimp", "crab", "lobster", "clam", "mussel", "oyster"]:
                category = "shellfish"
            elif allergen in ["sesame", "sesame seeds"]:
                category = "sesame"
            elif "nut" in allergen and allergen != "peanut" and allergen != "peanuts":
                category = "tree nuts"
            
            if category not in detected:
                detected.append(category)
    
    return detected

def get_biological_effects(elements: Dict[str, float]) -> Dict[str, List[str]]:
    """Get biological effects for significant elements"""
    effects = {}
    for element, amount in elements.items():
        if amount > 0 and element in BIOLOGICAL_EFFECTS:
            effects[element] = BIOLOGICAL_EFFECTS[element]
    return effects

def recommend_cooking_method(food_category: Optional[str], food_name: str) -> Dict[str, Any]:
    """Recommend optimal cooking method for nutrient preservation"""
    food_lower = food_name.lower()
    
    # Determine food type for safety requirements
    food_type = None
    if any(x in food_lower for x in ["chicken", "turkey", "duck", "poultry"]):
        food_type = "poultry"
    elif any(x in food_lower for x in ["ground beef", "ground pork", "ground lamb", "hamburger"]):
        food_type = "ground_meat"
    elif any(x in food_lower for x in ["beef", "steak", "roast"]) and "ground" not in food_lower:
        food_type = "beef_steak"
    elif any(x in food_lower for x in ["pork", "ham"]) and "ground" not in food_lower:
        food_type = "pork"
    elif any(x in food_lower for x in ["fish", "salmon", "tuna", "cod", "shrimp", "crab", "lobster"]):
        food_type = "fish"
    elif any(x in food_lower for x in ["egg"]):
        food_type = "eggs"
    
    # Safety requirements
    safety = SAFE_COOKING_TEMPS.get(food_type, None)
    
    # Rank cooking methods by nutrient retention
    method_scores = {}
    for method, factors in RETENTION_FACTORS.items():
        if method != "raw":
            avg_retention = sum(factors.values()) / len(factors)
            method_scores[method] = avg_retention
    
    ranked_methods = sorted(method_scores.items(), key=lambda x: x[1], reverse=True)
    
    return {
        "recommended_method": ranked_methods[0][0] if ranked_methods else "steaming",
        "method_rankings": [{"method": m, "avg_retention": round(s * 100, 1)} for m, s in ranked_methods],
        "safety_requirements": safety,
        "tips": [
            "Steaming preserves water-soluble vitamins better than boiling",
            "Shorter cooking times help retain more nutrients",
            "Lower temperatures preserve heat-sensitive vitamins",
            "Adding acidic ingredients (lemon, vinegar) can help preserve vitamin C"
        ]
    }

# ================== FOOD API ENDPOINTS ==================

@api_router.post("/foods/search")
async def search_foods(request: FoodSearchRequest):
    """Search for foods in USDA database"""
    foods = await search_usda_foods(request.query, request.page_size)
    return {"foods": foods, "query": request.query}

@api_router.post("/foods/analyze")
async def analyze_food(request: FoodAnalysisRequest):
    """Get complete elemental and nutritional analysis of a food"""
    food_data = await get_usda_food_details(request.fdc_id)
    
    if not food_data:
        raise HTTPException(status_code=404, detail="Food not found")
    
    # Extract raw nutrients
    raw_nutrients = extract_nutrients(food_data, request.portion_grams)
    
    # Apply cooking retention
    cooked_nutrients = apply_cooking_retention(raw_nutrients, request.cooking_method)
    
    # Calculate elemental composition
    elements = calculate_elemental_composition(cooked_nutrients, request.portion_grams)
    
    # Detect allergens
    food_name = food_data.get("description", "")
    ingredients = food_data.get("ingredients", "")
    allergens = detect_allergens(food_name, ingredients)
    
    # Get biological effects
    bio_effects = get_biological_effects(elements["mass_grams"])
    
    # Get cooking recommendations
    cooking_rec = recommend_cooking_method(
        food_data.get("foodCategory"),
        food_name
    )
    
    return {
        "fdc_id": request.fdc_id,
        "food_name": food_name,
        "portion_grams": request.portion_grams,
        "cooking_method": request.cooking_method,
        "nutrients": {
            "raw": raw_nutrients,
            "cooked": cooked_nutrients,
            "retention_applied": request.cooking_method != "raw"
        },
        "elements": elements,
        "allergens": allergens,
        "biological_effects": bio_effects,
        "cooking_recommendations": cooking_rec,
        "data_source": "USDA FoodData Central",
        "confidence": elements["confidence"]
    }

@api_router.get("/foods/retention-factors")
async def get_retention_factors():
    """Get all cooking retention factors"""
    return {
        "retention_factors": RETENTION_FACTORS,
        "cooking_methods": list(RETENTION_FACTORS.keys()),
        "source": "USDA/FAO retention factor tables"
    }

@api_router.get("/foods/safe-temps")
async def get_safe_temperatures():
    """Get safe cooking temperatures"""
    return {
        "temperatures": SAFE_COOKING_TEMPS,
        "source": "USDA Food Safety Guidelines"
    }

# ================== AI RECOMMENDATIONS ==================

@api_router.post("/ai/recommendations")
async def get_ai_recommendations(request: AIRecommendationRequest):
    """Get AI-powered food combination recommendations"""
    from emergentintegrations.llm.chat import LlmChat, UserMessage
    
    goal_descriptions = {
        "muscle_gain": "building muscle mass, requiring high nitrogen balance, complete proteins, and B vitamins",
        "immune_system": "boosting immune function, requiring vitamin C, zinc, vitamin D, and antioxidants",
        "brain_health": "improving cognitive function, requiring omega-3 fatty acids, B vitamins, and magnesium",
        "gut_microbiome": "supporting gut health, requiring fiber, prebiotics, probiotics, and fermented foods",
        "energy": "increasing energy levels, requiring B vitamins, iron, complex carbohydrates, and magnesium",
        "inflammation": "reducing inflammation, requiring omega-3s, antioxidants, and anti-inflammatory compounds"
    }
    
    goal_desc = goal_descriptions.get(request.goal, request.goal)
    
    restrictions_text = ""
    if request.dietary_restrictions:
        restrictions_text = f"\nDietary restrictions to avoid: {', '.join(request.dietary_restrictions)}"
    
    current_foods_text = ""
    if request.current_foods:
        current_foods_text = f"\nCurrently consuming: {', '.join(request.current_foods)}"
    
    prompt = f"""As a molecular nutrition expert, recommend the best food combinations for {goal_desc}.
{restrictions_text}{current_foods_text}

Provide exactly 5 food recommendations. For each food, explain:
1. Key nutrients and elements it provides
2. How it supports the health goal
3. Best cooking method to preserve nutrients
4. Synergistic foods to combine with

Format your response as a JSON array with this structure:
[
  {{
    "food": "Food name",
    "key_nutrients": ["nutrient1", "nutrient2"],
    "key_elements": ["element1", "element2"],
    "health_benefit": "Brief explanation",
    "best_cooking": "cooking method",
    "synergistic_foods": ["food1", "food2"]
  }}
]

Only respond with the JSON array, no additional text."""

    try:
        chat = LlmChat(
            api_key=EMERGENT_LLM_KEY,
            session_id=f"nutrition_{uuid.uuid4().hex[:8]}",
            system_message="You are a molecular nutrition expert who understands food chemistry, elemental composition, and nutrient synergies. Always respond with valid JSON."
        ).with_model("gemini", "gemini-3-flash-preview")
        
        response = await chat.send_message(UserMessage(text=prompt))
        
        # Parse JSON response
        import json
        # Clean response if needed
        response_text = response.strip()
        if response_text.startswith("```"):
            response_text = response_text.split("```")[1]
            if response_text.startswith("json"):
                response_text = response_text[4:]
        
        recommendations = json.loads(response_text)
        
        return {
            "goal": request.goal,
            "recommendations": recommendations,
            "dietary_restrictions": request.dietary_restrictions,
            "ai_model": "gemini-3-flash-preview"
        }
    except Exception as e:
        logger.error(f"AI recommendation error: {str(e)}")
        # Fallback recommendations based on goal
        fallback = {
            "muscle_gain": [
                {"food": "Salmon", "key_nutrients": ["protein", "omega-3"], "key_elements": ["N", "P"], "health_benefit": "Complete protein with anti-inflammatory fats", "best_cooking": "baking", "synergistic_foods": ["quinoa", "spinach"]},
                {"food": "Eggs", "key_nutrients": ["protein", "vitamin D"], "key_elements": ["N", "S"], "health_benefit": "High biological value protein", "best_cooking": "boiling", "synergistic_foods": ["avocado", "whole grain toast"]},
                {"food": "Chicken Breast", "key_nutrients": ["protein", "B vitamins"], "key_elements": ["N", "P"], "health_benefit": "Lean protein for muscle synthesis", "best_cooking": "baking", "synergistic_foods": ["brown rice", "broccoli"]},
                {"food": "Greek Yogurt", "key_nutrients": ["protein", "calcium"], "key_elements": ["N", "Ca"], "health_benefit": "Casein protein for sustained release", "best_cooking": "raw", "synergistic_foods": ["berries", "nuts"]},
                {"food": "Quinoa", "key_nutrients": ["complete protein", "fiber"], "key_elements": ["N", "Mg"], "health_benefit": "Plant-based complete protein", "best_cooking": "boiling", "synergistic_foods": ["black beans", "vegetables"]}
            ],
            "immune_system": [
                {"food": "Citrus Fruits", "key_nutrients": ["vitamin C", "fiber"], "key_elements": ["C", "K"], "health_benefit": "Powerful antioxidant support", "best_cooking": "raw", "synergistic_foods": ["spinach", "bell peppers"]},
                {"food": "Garlic", "key_nutrients": ["allicin", "selenium"], "key_elements": ["S", "Se"], "health_benefit": "Natural antimicrobial properties", "best_cooking": "raw", "synergistic_foods": ["onions", "ginger"]},
                {"food": "Spinach", "key_nutrients": ["vitamin C", "iron"], "key_elements": ["Fe", "Mg"], "health_benefit": "Nutrient-dense immune support", "best_cooking": "steaming", "synergistic_foods": ["lemon", "olive oil"]},
                {"food": "Almonds", "key_nutrients": ["vitamin E", "zinc"], "key_elements": ["Zn", "Mg"], "health_benefit": "Antioxidant and immune modulation", "best_cooking": "raw", "synergistic_foods": ["yogurt", "berries"]},
                {"food": "Turmeric", "key_nutrients": ["curcumin", "iron"], "key_elements": ["Fe", "Mn"], "health_benefit": "Anti-inflammatory immune support", "best_cooking": "raw", "synergistic_foods": ["black pepper", "ginger"]}
            ],
            "brain_health": [
                {"food": "Fatty Fish", "key_nutrients": ["omega-3", "vitamin D"], "key_elements": ["P", "Se"], "health_benefit": "DHA for brain cell membranes", "best_cooking": "baking", "synergistic_foods": ["leafy greens", "olive oil"]},
                {"food": "Blueberries", "key_nutrients": ["anthocyanins", "vitamin C"], "key_elements": ["K", "Mn"], "health_benefit": "Antioxidants cross blood-brain barrier", "best_cooking": "raw", "synergistic_foods": ["walnuts", "dark chocolate"]},
                {"food": "Walnuts", "key_nutrients": ["omega-3", "vitamin E"], "key_elements": ["Mg", "P"], "health_benefit": "Brain-shaped for brain health", "best_cooking": "raw", "synergistic_foods": ["berries", "oatmeal"]},
                {"food": "Dark Chocolate", "key_nutrients": ["flavonoids", "iron"], "key_elements": ["Fe", "Mg"], "health_benefit": "Improves blood flow to brain", "best_cooking": "raw", "synergistic_foods": ["berries", "nuts"]},
                {"food": "Eggs", "key_nutrients": ["choline", "B vitamins"], "key_elements": ["P", "Se"], "health_benefit": "Choline for neurotransmitter synthesis", "best_cooking": "boiling", "synergistic_foods": ["avocado", "leafy greens"]}
            ]
        }
        
        return {
            "goal": request.goal,
            "recommendations": fallback.get(request.goal, fallback["immune_system"]),
            "dietary_restrictions": request.dietary_restrictions,
            "ai_model": "fallback",
            "note": "Using pre-computed recommendations"
        }

# ================== TRACKING ENDPOINTS ==================

@api_router.post("/tracking/entry")
async def add_food_entry(entry: FoodEntryCreate, user: User = Depends(require_user)):
    """Add a food entry to user's log"""
    food_entry = FoodEntry(
        user_id=user.user_id,
        fdc_id=entry.fdc_id,
        food_name=entry.food_name,
        portion_grams=entry.portion_grams,
        cooking_method=entry.cooking_method,
        nutrients=entry.nutrients,
        elements=entry.elements,
        allergens=entry.allergens
    )
    
    await db.food_entries.insert_one(food_entry.dict())
    
    # Update daily log
    today = datetime.now(timezone.utc).strftime("%Y-%m-%d")
    daily_log = await db.daily_logs.find_one(
        {"user_id": user.user_id, "date": today},
        {"_id": 0}
    )
    
    if daily_log:
        # Update existing log
        new_nutrients = daily_log.get("total_nutrients", {})
        new_elements = daily_log.get("total_elements", {})
        
        for key, value in entry.nutrients.items():
            new_nutrients[key] = new_nutrients.get(key, 0) + value
        
        for key, value in entry.elements.items():
            new_elements[key] = new_elements.get(key, 0) + value
        
        await db.daily_logs.update_one(
            {"user_id": user.user_id, "date": today},
            {
                "$set": {"total_nutrients": new_nutrients, "total_elements": new_elements},
                "$push": {"foods": {"food_name": entry.food_name, "portion_grams": entry.portion_grams, "timestamp": datetime.now(timezone.utc)}}
            }
        )
    else:
        # Create new daily log
        new_log = DailyLog(
            user_id=user.user_id,
            date=today,
            total_nutrients=entry.nutrients,
            total_elements=entry.elements,
            foods=[{"food_name": entry.food_name, "portion_grams": entry.portion_grams, "timestamp": datetime.now(timezone.utc)}]
        )
        await db.daily_logs.insert_one(new_log.dict())
    
    return {"message": "Entry added", "entry_id": food_entry.id}

@api_router.get("/tracking/daily")
async def get_daily_log(date: Optional[str] = None, user: User = Depends(require_user)):
    """Get daily nutrition log"""
    if not date:
        date = datetime.now(timezone.utc).strftime("%Y-%m-%d")
    
    daily_log = await db.daily_logs.find_one(
        {"user_id": user.user_id, "date": date},
        {"_id": 0}
    )
    
    if not daily_log:
        return {
            "date": date,
            "total_nutrients": {},
            "total_elements": {},
            "foods": [],
            "message": "No entries for this date"
        }
    
    return daily_log

@api_router.get("/tracking/weekly")
async def get_weekly_log(user: User = Depends(require_user)):
    """Get weekly nutrition summary"""
    end_date = datetime.now(timezone.utc)
    start_date = end_date - timedelta(days=7)
    
    logs = await db.daily_logs.find(
        {
            "user_id": user.user_id,
            "date": {
                "$gte": start_date.strftime("%Y-%m-%d"),
                "$lte": end_date.strftime("%Y-%m-%d")
            }
        },
        {"_id": 0}
    ).to_list(100)
    
    # Aggregate totals
    total_nutrients = {}
    total_elements = {}
    daily_breakdown = []
    
    for log in logs:
        daily_breakdown.append({
            "date": log["date"],
            "nutrients": log.get("total_nutrients", {}),
            "elements": log.get("total_elements", {}),
            "food_count": len(log.get("foods", []))
        })
        
        for key, value in log.get("total_nutrients", {}).items():
            total_nutrients[key] = total_nutrients.get(key, 0) + value
        
        for key, value in log.get("total_elements", {}).items():
            total_elements[key] = total_elements.get(key, 0) + value
    
    return {
        "period": "weekly",
        "start_date": start_date.strftime("%Y-%m-%d"),
        "end_date": end_date.strftime("%Y-%m-%d"),
        "total_nutrients": total_nutrients,
        "total_elements": total_elements,
        "daily_breakdown": daily_breakdown,
        "days_logged": len(logs)
    }

@api_router.get("/tracking/monthly")
async def get_monthly_log(month: Optional[int] = None, year: Optional[int] = None, user: User = Depends(require_user)):
    """Get monthly nutrition summary"""
    now = datetime.now(timezone.utc)
    if not month:
        month = now.month
    if not year:
        year = now.year
    
    start_date = f"{year}-{month:02d}-01"
    if month == 12:
        end_date = f"{year + 1}-01-01"
    else:
        end_date = f"{year}-{month + 1:02d}-01"
    
    logs = await db.daily_logs.find(
        {
            "user_id": user.user_id,
            "date": {"$gte": start_date, "$lt": end_date}
        },
        {"_id": 0}
    ).to_list(100)
    
    # Aggregate
    total_nutrients = {}
    total_elements = {}
    
    for log in logs:
        for key, value in log.get("total_nutrients", {}).items():
            total_nutrients[key] = total_nutrients.get(key, 0) + value
        for key, value in log.get("total_elements", {}).items():
            total_elements[key] = total_elements.get(key, 0) + value
    
    # Calculate averages
    avg_nutrients = {k: round(v / max(len(logs), 1), 2) for k, v in total_nutrients.items()}
    avg_elements = {k: round(v / max(len(logs), 1), 6) for k, v in total_elements.items()}
    
    return {
        "period": "monthly",
        "month": month,
        "year": year,
        "total_nutrients": total_nutrients,
        "total_elements": total_elements,
        "average_daily_nutrients": avg_nutrients,
        "average_daily_elements": avg_elements,
        "days_logged": len(logs)
    }

@api_router.get("/tracking/history")
async def get_food_history(limit: int = 20, user: User = Depends(require_user)):
    """Get recent food entries"""
    entries = await db.food_entries.find(
        {"user_id": user.user_id},
        {"_id": 0}
    ).sort("timestamp", -1).limit(limit).to_list(limit)
    
    return {"entries": entries, "count": len(entries)}

# ================== UTILITY ENDPOINTS ==================

@api_router.get("/")
async def root():
    """API health check"""
    return {
        "message": "Molecular Nutrition Engine API",
        "version": "1.0.0",
        "status": "healthy"
    }

@api_router.get("/elements/info")
async def get_elements_info():
    """Get information about tracked elements"""
    return {
        "elements": ATOMIC_WEIGHTS,
        "biological_effects": BIOLOGICAL_EFFECTS,
        "elemental_fractions": ELEMENTAL_FRACTIONS
    }

@api_router.get("/allergens/list")
async def get_allergens_list():
    """Get list of tracked allergens"""
    categories = [
        "peanuts", "tree nuts", "dairy", "eggs", "wheat/gluten",
        "soy", "fish", "shellfish", "sesame", "sulfites"
    ]
    return {"allergen_categories": categories, "all_keywords": ALLERGENS}

# Include the router
app.include_router(api_router)

# CORS middleware
app.add_middleware(
    CORSMiddleware,
    allow_credentials=True,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

@app.on_event("shutdown")
async def shutdown_db_client():
    client.close()
