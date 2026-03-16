from fastapi import FastAPI, APIRouter, HTTPException, Request, Response, Depends
from fastapi.responses import JSONResponse
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
import re

ROOT_DIR = Path(__file__).parent
load_dotenv(ROOT_DIR / '.env')

# MongoDB connection
mongo_url = os.environ['MONGO_URL']
client = AsyncIOMotorClient(mongo_url)
db = client[os.environ['DB_NAME']]

# API Keys
USDA_API_KEY = os.environ.get('USDA_API_KEY', '')

# Create the main app
app = FastAPI(title="ElementEats - Food Elemental Analyzer")

# Create a router with the /api prefix
api_router = APIRouter(prefix="/api")

# Configure logging
logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(name)s - %(levelname)s - %(message)s')
logger = logging.getLogger(__name__)

# ============== MODELS ==============

class User(BaseModel):
    user_id: str
    email: str
    name: str
    picture: Optional[str] = None
    created_at: datetime

class SessionRequest(BaseModel):
    session_id: str

class IngredientSearch(BaseModel):
    query: str
    page_size: int = 10

class BarcodeSearch(BaseModel):
    barcode: str

class ElementalComposition(BaseModel):
    carbon: float = 0.0
    hydrogen: float = 0.0
    oxygen: float = 0.0
    nitrogen: float = 0.0
    sulfur: float = 0.0
    minerals: Dict[str, float] = {}

class Nutrient(BaseModel):
    name: str
    amount: float
    unit: str
    source: str = "USDA FoodData Central"
    confidence: str = "high"

class Ingredient(BaseModel):
    fdc_id: Optional[int] = None
    name: str
    amount: float = 100.0
    unit: str = "g"
    nutrients: List[Nutrient] = []
    allergens: List[str] = []

class CookingMethod(BaseModel):
    method: str
    retention_factors: Dict[str, float] = {}

class RecipeAnalysis(BaseModel):
    ingredients: List[Ingredient]
    cooking_method: str = "raw"
    servings: int = 1

class RecipeCreate(BaseModel):
    name: str
    ingredients: List[Dict[str, Any]]
    cooking_method: str = "raw"
    servings: int = 1

class SavedRecipe(BaseModel):
    recipe_id: str
    user_id: str
    name: str
    ingredients: List[Dict[str, Any]]
    cooking_method: str
    servings: int
    analysis: Optional[Dict[str, Any]] = None
    created_at: datetime

# ============== ELEMENTAL COMPOSITION CONSTANTS ==============

# Literature-average elemental fractions for macronutrients
PROTEIN_FRACTIONS = {"C": 0.50, "H": 0.07, "O": 0.22, "N": 0.16, "S": 0.02}
CARB_FRACTIONS = {"C": 0.40, "H": 0.067, "O": 0.533}
FAT_FRACTIONS = {"C": 0.76, "H": 0.123, "O": 0.117}

# Atomic weights for molar calculations
ATOMIC_WEIGHTS = {
    "C": 12.011, "H": 1.008, "O": 15.999, "N": 14.007, "S": 32.065,
    "Na": 22.990, "K": 39.098, "Ca": 40.078, "Mg": 24.305, "P": 30.974,
    "Fe": 26.982, "Zn": 65.38, "Cu": 63.546, "Mn": 54.938, "Se": 78.971
}

# USDA Nutrient Retention Factors (percentage retained after cooking)
RETENTION_FACTORS = {
    "raw": {
        "Protein": 1.0, "Vitamin C": 1.0, "Vitamin A": 1.0, "Thiamin": 1.0,
        "Riboflavin": 1.0, "Niacin": 1.0, "Vitamin B-6": 1.0, "Folate": 1.0,
        "Vitamin B-12": 1.0, "Iron": 1.0, "Calcium": 1.0, "Potassium": 1.0,
        "Magnesium": 1.0, "Zinc": 1.0, "Phosphorus": 1.0
    },
    "boiled": {
        "Protein": 0.95, "Vitamin C": 0.45, "Vitamin A": 0.80, "Thiamin": 0.65,
        "Riboflavin": 0.75, "Niacin": 0.70, "Vitamin B-6": 0.55, "Folate": 0.45,
        "Vitamin B-12": 0.70, "Iron": 0.85, "Calcium": 0.85, "Potassium": 0.70,
        "Magnesium": 0.75, "Zinc": 0.85, "Phosphorus": 0.80
    },
    "steamed": {
        "Protein": 0.98, "Vitamin C": 0.75, "Vitamin A": 0.90, "Thiamin": 0.80,
        "Riboflavin": 0.90, "Niacin": 0.85, "Vitamin B-6": 0.75, "Folate": 0.70,
        "Vitamin B-12": 0.85, "Iron": 0.95, "Calcium": 0.95, "Potassium": 0.90,
        "Magnesium": 0.90, "Zinc": 0.95, "Phosphorus": 0.90
    },
    "fried": {
        "Protein": 0.90, "Vitamin C": 0.35, "Vitamin A": 0.70, "Thiamin": 0.55,
        "Riboflavin": 0.65, "Niacin": 0.75, "Vitamin B-6": 0.50, "Folate": 0.40,
        "Vitamin B-12": 0.65, "Iron": 0.90, "Calcium": 0.90, "Potassium": 0.80,
        "Magnesium": 0.85, "Zinc": 0.90, "Phosphorus": 0.85
    },
    "baked": {
        "Protein": 0.95, "Vitamin C": 0.50, "Vitamin A": 0.85, "Thiamin": 0.70,
        "Riboflavin": 0.80, "Niacin": 0.80, "Vitamin B-6": 0.65, "Folate": 0.55,
        "Vitamin B-12": 0.75, "Iron": 0.90, "Calcium": 0.90, "Potassium": 0.85,
        "Magnesium": 0.85, "Zinc": 0.90, "Phosphorus": 0.85
    },
    "grilled": {
        "Protein": 0.92, "Vitamin C": 0.40, "Vitamin A": 0.75, "Thiamin": 0.60,
        "Riboflavin": 0.70, "Niacin": 0.80, "Vitamin B-6": 0.55, "Folate": 0.45,
        "Vitamin B-12": 0.70, "Iron": 0.90, "Calcium": 0.90, "Potassium": 0.80,
        "Magnesium": 0.85, "Zinc": 0.90, "Phosphorus": 0.85
    }
}

# Safe cooking temperatures (°F / °C)
SAFE_TEMPERATURES = {
    "poultry": {"min_temp_f": 165, "min_temp_c": 74, "category": "Poultry (chicken, turkey, duck)"},
    "ground_meat": {"min_temp_f": 160, "min_temp_c": 71, "category": "Ground meats (beef, pork, lamb)"},
    "beef_steak": {"min_temp_f": 145, "min_temp_c": 63, "category": "Beef steaks, roasts (with 3-min rest)"},
    "pork": {"min_temp_f": 145, "min_temp_c": 63, "category": "Pork (chops, roasts, with 3-min rest)"},
    "fish": {"min_temp_f": 145, "min_temp_c": 63, "category": "Fish and shellfish"},
    "eggs": {"min_temp_f": 160, "min_temp_c": 71, "category": "Egg dishes"},
    "leftovers": {"min_temp_f": 165, "min_temp_c": 74, "category": "Leftovers and casseroles"},
    "ham_fresh": {"min_temp_f": 145, "min_temp_c": 63, "category": "Fresh ham (with 3-min rest)"},
    "ham_precooked": {"min_temp_f": 140, "min_temp_c": 60, "category": "Pre-cooked ham (reheating)"}
}

# Major allergens (FDA top 9 + EU additions)
MAJOR_ALLERGENS = [
    "milk", "dairy", "lactose", "casein", "whey",
    "egg", "eggs",
    "fish", "cod", "salmon", "tuna", "anchovy",
    "shellfish", "shrimp", "crab", "lobster", "clam", "mussel", "oyster", "scallop",
    "tree nuts", "almond", "cashew", "walnut", "pecan", "pistachio", "hazelnut", "macadamia", "brazil nut",
    "peanut", "peanuts",
    "wheat", "gluten",
    "soybean", "soy", "soya",
    "sesame", "sesame seeds",
    "mustard",
    "celery",
    "lupin",
    "molluscs", "sulfites", "sulphites"
]

# ============== AUTH HELPERS ==============

async def get_session_token(request: Request) -> Optional[str]:
    """Extract session token from cookie or Authorization header"""
    # Try cookie first
    token = request.cookies.get("session_token")
    if token:
        return token
    # Fallback to Authorization header
    auth_header = request.headers.get("Authorization")
    if auth_header and auth_header.startswith("Bearer "):
        return auth_header[7:]
    return None

async def get_current_user(request: Request) -> User:
    """Authenticate and return current user"""
    token = await get_session_token(request)
    if not token:
        raise HTTPException(status_code=401, detail="Not authenticated")
    
    # Find session
    session = await db.user_sessions.find_one({"session_token": token}, {"_id": 0})
    if not session:
        raise HTTPException(status_code=401, detail="Invalid session")
    
    # Check expiry
    expires_at = session.get("expires_at")
    if isinstance(expires_at, str):
        expires_at = datetime.fromisoformat(expires_at)
    if expires_at.tzinfo is None:
        expires_at = expires_at.replace(tzinfo=timezone.utc)
    if expires_at < datetime.now(timezone.utc):
        raise HTTPException(status_code=401, detail="Session expired")
    
    # Find user
    user = await db.users.find_one({"user_id": session["user_id"]}, {"_id": 0})
    if not user:
        raise HTTPException(status_code=401, detail="User not found")
    
    if isinstance(user.get("created_at"), str):
        user["created_at"] = datetime.fromisoformat(user["created_at"])
    
    return User(**user)

async def get_optional_user(request: Request) -> Optional[User]:
    """Get current user if authenticated, None otherwise"""
    try:
        return await get_current_user(request)
    except HTTPException:
        return None

# ============== AUTH ENDPOINTS ==============

@api_router.post("/auth/session")
async def exchange_session(request: SessionRequest, response: Response):
    """Exchange session_id for session data from Emergent Auth"""
    async with httpx.AsyncClient() as client:
        try:
            auth_response = await client.get(
                "https://demobackend.emergentagent.com/auth/v1/env/oauth/session-data",
                headers={"X-Session-ID": request.session_id}
            )
            if auth_response.status_code != 200:
                raise HTTPException(status_code=401, detail="Invalid session ID")
            
            data = auth_response.json()
            
            # Check if user exists
            existing_user = await db.users.find_one({"email": data["email"]}, {"_id": 0})
            
            if existing_user:
                user_id = existing_user["user_id"]
                # Update user data
                await db.users.update_one(
                    {"user_id": user_id},
                    {"$set": {"name": data["name"], "picture": data.get("picture")}}
                )
            else:
                # Create new user
                user_id = f"user_{uuid.uuid4().hex[:12]}"
                await db.users.insert_one({
                    "user_id": user_id,
                    "email": data["email"],
                    "name": data["name"],
                    "picture": data.get("picture"),
                    "created_at": datetime.now(timezone.utc).isoformat()
                })
            
            # Create session
            session_token = data.get("session_token", f"sess_{uuid.uuid4().hex}")
            expires_at = datetime.now(timezone.utc) + timedelta(days=7)
            
            await db.user_sessions.insert_one({
                "user_id": user_id,
                "session_token": session_token,
                "expires_at": expires_at.isoformat(),
                "created_at": datetime.now(timezone.utc).isoformat()
            })
            
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
            
            user = await db.users.find_one({"user_id": user_id}, {"_id": 0})
            return user
            
        except httpx.RequestError as e:
            logger.error(f"Auth request failed: {e}")
            raise HTTPException(status_code=500, detail="Authentication service unavailable")

@api_router.get("/auth/me")
async def get_me(user: User = Depends(get_current_user)):
    """Get current authenticated user"""
    return user.model_dump()

@api_router.post("/auth/logout")
async def logout(request: Request, response: Response):
    """Logout user and clear session"""
    token = await get_session_token(request)
    if token:
        await db.user_sessions.delete_one({"session_token": token})
    
    response.delete_cookie(key="session_token", path="/")
    return {"message": "Logged out successfully"}

# ============== USDA API HELPERS ==============

async def search_usda_foods(query: str, page_size: int = 10) -> List[Dict]:
    """Search USDA FoodData Central for foods"""
    async with httpx.AsyncClient() as client:
        try:
            # Build URL manually to avoid encoding issues with dataType
            url = f"https://api.nal.usda.gov/fdc/v1/foods/search?api_key={USDA_API_KEY}&query={query}&pageSize={page_size}"
            response = await client.get(url, timeout=15.0)
            if response.status_code == 200:
                data = response.json()
                return data.get("foods", [])
            else:
                logger.error(f"USDA API error: {response.status_code}")
                return []
        except Exception as e:
            logger.error(f"USDA API request failed: {e}")
            return []

async def get_usda_food_details(fdc_id: int) -> Optional[Dict]:
    """Get detailed nutrient data for a specific food"""
    async with httpx.AsyncClient() as client:
        try:
            response = await client.get(
                f"https://api.nal.usda.gov/fdc/v1/food/{fdc_id}",
                params={"api_key": USDA_API_KEY},
                timeout=15.0
            )
            if response.status_code == 200:
                return response.json()
            return None
        except Exception as e:
            logger.error(f"USDA food details request failed: {e}")
            return None

async def search_open_food_facts(barcode: str) -> Optional[Dict]:
    """Search Open Food Facts by barcode"""
    async with httpx.AsyncClient() as client:
        try:
            response = await client.get(
                f"https://world.openfoodfacts.org/api/v2/product/{barcode}.json",
                timeout=15.0
            )
            if response.status_code == 200:
                data = response.json()
                if data.get("status") == 1:
                    return data.get("product")
            return None
        except Exception as e:
            logger.error(f"Open Food Facts request failed: {e}")
            return None

# ============== CALCULATION HELPERS ==============

def calculate_elemental_composition(nutrients: Dict[str, float]) -> Dict:
    """Calculate elemental composition from macronutrients"""
    protein = nutrients.get("protein", 0)
    carbs = nutrients.get("carbohydrates", 0)
    fat = nutrients.get("fat", 0)
    
    # Calculate elemental contributions from macros
    composition = {
        "carbon": (protein * PROTEIN_FRACTIONS["C"] + 
                   carbs * CARB_FRACTIONS["C"] + 
                   fat * FAT_FRACTIONS["C"]),
        "hydrogen": (protein * PROTEIN_FRACTIONS["H"] + 
                     carbs * CARB_FRACTIONS["H"] + 
                     fat * FAT_FRACTIONS["H"]),
        "oxygen": (protein * PROTEIN_FRACTIONS["O"] + 
                   carbs * CARB_FRACTIONS["O"] + 
                   fat * FAT_FRACTIONS["O"]),
        "nitrogen": protein * PROTEIN_FRACTIONS["N"],
        "sulfur": protein * PROTEIN_FRACTIONS["S"]
    }
    
    # Add minerals directly
    minerals = {}
    mineral_map = {
        "Sodium, Na": "Na",
        "Potassium, K": "K",
        "Calcium, Ca": "Ca",
        "Magnesium, Mg": "Mg",
        "Phosphorus, P": "P",
        "Iron, Fe": "Fe",
        "Zinc, Zn": "Zn",
        "Copper, Cu": "Cu",
        "Manganese, Mn": "Mn",
        "Selenium, Se": "Se"
    }
    
    for full_name, symbol in mineral_map.items():
        if full_name.lower() in nutrients or symbol.lower() in nutrients:
            value = nutrients.get(full_name.lower(), nutrients.get(symbol.lower(), 0))
            minerals[symbol] = value
    
    composition["minerals"] = minerals
    
    # Calculate molar amounts
    total_mass = composition["carbon"] + composition["hydrogen"] + composition["oxygen"] + composition["nitrogen"] + composition["sulfur"]
    
    molar = {}
    for element, mass in composition.items():
        if element != "minerals" and mass > 0:
            symbol = element[0].upper()
            if symbol in ATOMIC_WEIGHTS:
                molar[symbol] = mass / ATOMIC_WEIGHTS[symbol]
    
    composition["molar"] = molar
    composition["total_mass_g"] = total_mass
    
    return composition

def detect_allergens(ingredients_text: str) -> List[Dict]:
    """Detect allergens in ingredient text"""
    text_lower = ingredients_text.lower()
    detected = []
    
    for allergen in MAJOR_ALLERGENS:
        if allergen in text_lower:
            # Categorize allergen
            category = "other"
            if allergen in ["milk", "dairy", "lactose", "casein", "whey"]:
                category = "dairy"
            elif allergen in ["egg", "eggs"]:
                category = "eggs"
            elif allergen in ["fish", "cod", "salmon", "tuna", "anchovy"]:
                category = "fish"
            elif allergen in ["shellfish", "shrimp", "crab", "lobster", "clam", "mussel", "oyster", "scallop"]:
                category = "shellfish"
            elif allergen in ["tree nuts", "almond", "cashew", "walnut", "pecan", "pistachio", "hazelnut", "macadamia", "brazil nut"]:
                category = "tree_nuts"
            elif allergen in ["peanut", "peanuts"]:
                category = "peanuts"
            elif allergen in ["wheat", "gluten"]:
                category = "wheat"
            elif allergen in ["soybean", "soy", "soya"]:
                category = "soy"
            elif allergen in ["sesame", "sesame seeds"]:
                category = "sesame"
            
            detected.append({
                "allergen": allergen,
                "category": category,
                "source": "ingredient_list"
            })
    
    # Remove duplicates by category
    seen_categories = set()
    unique = []
    for d in detected:
        if d["category"] not in seen_categories:
            seen_categories.add(d["category"])
            unique.append(d)
    
    return unique

def get_safe_temperature(food_type: str) -> Optional[Dict]:
    """Get safe cooking temperature for food type"""
    food_lower = food_type.lower()
    
    # Match food type to temperature category
    if any(x in food_lower for x in ["chicken", "turkey", "duck", "poultry", "fowl"]):
        return SAFE_TEMPERATURES["poultry"]
    elif any(x in food_lower for x in ["ground", "mince", "burger", "meatball"]):
        return SAFE_TEMPERATURES["ground_meat"]
    elif any(x in food_lower for x in ["steak", "roast beef", "beef"]) and "ground" not in food_lower:
        return SAFE_TEMPERATURES["beef_steak"]
    elif any(x in food_lower for x in ["pork", "ham"]):
        if "pre" in food_lower or "cooked" in food_lower:
            return SAFE_TEMPERATURES["ham_precooked"]
        return SAFE_TEMPERATURES["pork"]
    elif any(x in food_lower for x in ["fish", "salmon", "tuna", "cod", "shrimp", "lobster", "crab", "shellfish"]):
        return SAFE_TEMPERATURES["fish"]
    elif any(x in food_lower for x in ["egg", "eggs", "quiche", "frittata"]):
        return SAFE_TEMPERATURES["eggs"]
    elif any(x in food_lower for x in ["leftover", "casserole", "reheat"]):
        return SAFE_TEMPERATURES["leftovers"]
    
    return None

def apply_retention_factors(nutrients: List[Dict], cooking_method: str) -> List[Dict]:
    """Apply nutrient retention factors based on cooking method"""
    factors = RETENTION_FACTORS.get(cooking_method, RETENTION_FACTORS["raw"])
    
    adjusted = []
    for nutrient in nutrients:
        name = nutrient.get("name", "")
        amount = nutrient.get("amount", 0)
        
        # Find matching retention factor
        factor = 1.0
        for key, value in factors.items():
            if key.lower() in name.lower():
                factor = value
                break
        
        adjusted.append({
            **nutrient,
            "amount": round(amount * factor, 2),
            "retention_factor": factor,
            "original_amount": amount
        })
    
    return adjusted

# ============== FOOD ENDPOINTS ==============

@api_router.post("/foods/search")
async def search_foods(search: IngredientSearch):
    """Search for foods in USDA database"""
    foods = await search_usda_foods(search.query, search.page_size)
    
    results = []
    for food in foods:
        nutrients = {}
        for nutrient in food.get("foodNutrients", []):
            name = nutrient.get("nutrientName", "")
            value = nutrient.get("value", 0)
            unit = nutrient.get("unitName", "")
            
            if "Protein" in name:
                nutrients["protein"] = {"amount": value, "unit": unit}
            elif "Carbohydrate" in name:
                nutrients["carbohydrates"] = {"amount": value, "unit": unit}
            elif "Total lipid" in name or "Fat" in name:
                nutrients["fat"] = {"amount": value, "unit": unit}
            elif "Energy" in name and unit == "KCAL":
                nutrients["calories"] = {"amount": value, "unit": "kcal"}
        
        results.append({
            "fdc_id": food.get("fdcId"),
            "description": food.get("description"),
            "brand": food.get("brandOwner"),
            "data_type": food.get("dataType"),
            "nutrients": nutrients,
            "source": "USDA FoodData Central"
        })
    
    return {"foods": results, "count": len(results)}

@api_router.get("/foods/{fdc_id}")
async def get_food_details(fdc_id: int):
    """Get detailed nutrient information for a food"""
    food = await get_usda_food_details(fdc_id)
    if not food:
        raise HTTPException(status_code=404, detail="Food not found")
    
    nutrients = []
    macros = {"protein": 0, "carbohydrates": 0, "fat": 0}
    
    for nutrient in food.get("foodNutrients", []):
        n = nutrient.get("nutrient", {})
        name = n.get("name", "")
        value = nutrient.get("amount", 0)
        unit = n.get("unitName", "")
        
        if value and value > 0:
            nutrients.append({
                "name": name,
                "amount": value,
                "unit": unit,
                "source": "USDA FoodData Central",
                "confidence": "high"
            })
            
            if "Protein" in name:
                macros["protein"] = value
            elif "Carbohydrate" in name:
                macros["carbohydrates"] = value
            elif "Total lipid" in name:
                macros["fat"] = value
    
    # Calculate elemental composition
    elemental = calculate_elemental_composition(macros)
    
    # Detect allergens from description
    description = food.get("description", "")
    ingredients = food.get("ingredients", "")
    allergens = detect_allergens(f"{description} {ingredients}")
    
    # Get safe temperature if applicable
    safe_temp = get_safe_temperature(description)
    
    return {
        "fdc_id": fdc_id,
        "description": food.get("description"),
        "ingredients": food.get("ingredients"),
        "serving_size": food.get("servingSize"),
        "serving_unit": food.get("servingSizeUnit"),
        "nutrients": nutrients,
        "macros": macros,
        "elemental_composition": elemental,
        "allergens": allergens,
        "safe_temperature": safe_temp,
        "source": "USDA FoodData Central"
    }

@api_router.post("/foods/barcode")
async def search_by_barcode(search: BarcodeSearch):
    """Search for food by barcode using Open Food Facts"""
    product = await search_open_food_facts(search.barcode)
    if not product:
        raise HTTPException(status_code=404, detail="Product not found")
    
    nutriments = product.get("nutriments", {})
    
    macros = {
        "protein": nutriments.get("proteins_100g", 0),
        "carbohydrates": nutriments.get("carbohydrates_100g", 0),
        "fat": nutriments.get("fat_100g", 0)
    }
    
    nutrients = [
        {"name": "Protein", "amount": macros["protein"], "unit": "g", "source": "Open Food Facts", "confidence": "high"},
        {"name": "Carbohydrates", "amount": macros["carbohydrates"], "unit": "g", "source": "Open Food Facts", "confidence": "high"},
        {"name": "Fat", "amount": macros["fat"], "unit": "g", "source": "Open Food Facts", "confidence": "high"},
        {"name": "Energy", "amount": nutriments.get("energy-kcal_100g", 0), "unit": "kcal", "source": "Open Food Facts", "confidence": "high"},
        {"name": "Fiber", "amount": nutriments.get("fiber_100g", 0), "unit": "g", "source": "Open Food Facts", "confidence": "high"},
        {"name": "Sodium, Na", "amount": nutriments.get("sodium_100g", 0) * 1000, "unit": "mg", "source": "Open Food Facts", "confidence": "high"},
        {"name": "Sugars", "amount": nutriments.get("sugars_100g", 0), "unit": "g", "source": "Open Food Facts", "confidence": "high"},
    ]
    
    # Filter out zero values
    nutrients = [n for n in nutrients if n["amount"] > 0]
    
    # Calculate elemental composition
    elemental = calculate_elemental_composition(macros)
    
    # Detect allergens
    ingredients_text = product.get("ingredients_text", "")
    allergens_tags = product.get("allergens_tags", [])
    allergen_text = " ".join([a.replace("en:", "") for a in allergens_tags])
    allergens = detect_allergens(f"{ingredients_text} {allergen_text}")
    
    return {
        "barcode": search.barcode,
        "name": product.get("product_name"),
        "brand": product.get("brands"),
        "image_url": product.get("image_url"),
        "ingredients_text": ingredients_text,
        "nutrients": nutrients,
        "macros": macros,
        "elemental_composition": elemental,
        "allergens": allergens,
        "allergens_from_label": product.get("allergens_tags", []),
        "source": "Open Food Facts"
    }

# ============== ANALYSIS ENDPOINTS ==============

@api_router.post("/analyze")
async def analyze_recipe(analysis: RecipeAnalysis):
    """Analyze a recipe for elemental composition, nutrients, and cooking recommendations"""
    total_nutrients = []
    total_macros = {"protein": 0, "carbohydrates": 0, "fat": 0}
    all_allergens = []
    safe_temps = []
    ingredients_analyzed = []
    
    for ingredient in analysis.ingredients:
        if ingredient.fdc_id:
            # Fetch from USDA
            food = await get_usda_food_details(ingredient.fdc_id)
            if food:
                amount_factor = ingredient.amount / 100.0  # Nutrients are per 100g
                
                for nutrient in food.get("foodNutrients", []):
                    n = nutrient.get("nutrient", {})
                    name = n.get("name", "")
                    value = (nutrient.get("amount", 0) or 0) * amount_factor
                    unit = n.get("unitName", "")
                    
                    if value > 0:
                        total_nutrients.append({
                            "name": name,
                            "amount": value,
                            "unit": unit,
                            "ingredient": ingredient.name,
                            "source": "USDA FoodData Central",
                            "confidence": "high"
                        })
                        
                        if "Protein" in name:
                            total_macros["protein"] += value
                        elif "Carbohydrate" in name:
                            total_macros["carbohydrates"] += value
                        elif "Total lipid" in name:
                            total_macros["fat"] += value
                
                # Detect allergens
                desc = food.get("description", "")
                ing = food.get("ingredients", "")
                allergens = detect_allergens(f"{desc} {ing}")
                for a in allergens:
                    a["ingredient"] = ingredient.name
                all_allergens.extend(allergens)
                
                # Check safe temperature
                temp = get_safe_temperature(desc)
                if temp:
                    safe_temps.append({**temp, "ingredient": ingredient.name})
                
                ingredients_analyzed.append({
                    "name": ingredient.name,
                    "fdc_id": ingredient.fdc_id,
                    "amount": ingredient.amount,
                    "unit": ingredient.unit,
                    "source": "USDA FoodData Central"
                })
    
    # Aggregate nutrients by name
    nutrient_totals = {}
    for n in total_nutrients:
        key = n["name"]
        if key not in nutrient_totals:
            nutrient_totals[key] = {
                "name": key,
                "amount": 0,
                "unit": n["unit"],
                "sources": [],
                "confidence": "high"
            }
        nutrient_totals[key]["amount"] += n["amount"]
        nutrient_totals[key]["sources"].append(n["ingredient"])
    
    aggregated_nutrients = list(nutrient_totals.values())
    
    # Apply retention factors
    cooked_nutrients = apply_retention_factors(aggregated_nutrients, analysis.cooking_method)
    
    # Calculate elemental composition
    elemental = calculate_elemental_composition(total_macros)
    
    # Remove duplicate allergens
    seen_allergens = set()
    unique_allergens = []
    for a in all_allergens:
        key = a["category"]
        if key not in seen_allergens:
            seen_allergens.add(key)
            unique_allergens.append(a)
    
    # Determine highest safe temperature needed
    max_temp = None
    if safe_temps:
        max_temp = max(safe_temps, key=lambda x: x["min_temp_f"])
    
    # Calculate per-serving values
    servings = analysis.servings or 1
    per_serving_macros = {k: round(v / servings, 2) for k, v in total_macros.items()}
    
    return {
        "ingredients": ingredients_analyzed,
        "cooking_method": analysis.cooking_method,
        "servings": servings,
        "total_macros": total_macros,
        "per_serving_macros": per_serving_macros,
        "elemental_composition": elemental,
        "nutrients_raw": aggregated_nutrients,
        "nutrients_cooked": cooked_nutrients,
        "retention_factors": RETENTION_FACTORS.get(analysis.cooking_method, {}),
        "allergens": unique_allergens,
        "safe_temperature": max_temp,
        "cooking_recommendations": get_cooking_recommendations(analysis.cooking_method, unique_allergens, max_temp)
    }

def get_cooking_recommendations(method: str, allergens: List, safe_temp: Optional[Dict]) -> Dict:
    """Generate cooking recommendations"""
    recommendations = {
        "best_methods_for_nutrients": [],
        "temperature_notes": [],
        "allergen_warnings": []
    }
    
    # Best methods for nutrient preservation
    if method == "boiled":
        recommendations["best_methods_for_nutrients"] = [
            "Consider steaming instead - retains more water-soluble vitamins (Vitamin C, B vitamins)",
            "If boiling, use minimal water and cooking time",
            "Save cooking water for soups/stocks to recapture leached nutrients"
        ]
    elif method == "fried":
        recommendations["best_methods_for_nutrients"] = [
            "Frying significantly reduces Vitamin C and folate content",
            "Consider baking or air-frying as alternatives",
            "Use oils with high smoke points to minimize oxidation"
        ]
    elif method == "steamed":
        recommendations["best_methods_for_nutrients"] = [
            "Excellent choice for preserving water-soluble vitamins",
            "Maintains most mineral content",
            "Short cooking times optimize nutrient retention"
        ]
    elif method == "baked":
        recommendations["best_methods_for_nutrients"] = [
            "Good for preserving most nutrients",
            "Use covered dishes to reduce moisture loss",
            "Lower temperatures for longer times can improve retention"
        ]
    
    # Temperature notes
    if safe_temp:
        recommendations["temperature_notes"] = [
            f"Minimum safe internal temperature: {safe_temp['min_temp_f']}°F ({safe_temp['min_temp_c']}°C)",
            f"Category: {safe_temp['category']}",
            "Use a food thermometer to verify internal temperature"
        ]
    
    # Allergen warnings
    if allergens:
        warnings = [f"Contains: {', '.join([a['category'] for a in allergens])}"]
        recommendations["allergen_warnings"] = warnings
    
    return recommendations

# ============== RECIPE ENDPOINTS ==============

@api_router.get("/recipes")
async def get_recipes(user: User = Depends(get_current_user)):
    """Get all saved recipes for current user"""
    recipes = await db.recipes.find({"user_id": user.user_id}, {"_id": 0}).to_list(100)
    return {"recipes": recipes}

@api_router.post("/recipes")
async def create_recipe(recipe: RecipeCreate, user: User = Depends(get_current_user)):
    """Save a new recipe"""
    recipe_id = f"recipe_{uuid.uuid4().hex[:12]}"
    
    doc = {
        "recipe_id": recipe_id,
        "user_id": user.user_id,
        "name": recipe.name,
        "ingredients": recipe.ingredients,
        "cooking_method": recipe.cooking_method,
        "servings": recipe.servings,
        "created_at": datetime.now(timezone.utc).isoformat()
    }
    
    await db.recipes.insert_one(doc)
    if "_id" in doc:
        del doc["_id"]
    
    return doc

@api_router.get("/recipes/{recipe_id}")
async def get_recipe(recipe_id: str, user: User = Depends(get_current_user)):
    """Get a specific recipe"""
    recipe = await db.recipes.find_one(
        {"recipe_id": recipe_id, "user_id": user.user_id},
        {"_id": 0}
    )
    if not recipe:
        raise HTTPException(status_code=404, detail="Recipe not found")
    return recipe

@api_router.delete("/recipes/{recipe_id}")
async def delete_recipe(recipe_id: str, user: User = Depends(get_current_user)):
    """Delete a recipe"""
    result = await db.recipes.delete_one({"recipe_id": recipe_id, "user_id": user.user_id})
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Recipe not found")
    return {"message": "Recipe deleted"}

# ============== REFERENCE ENDPOINTS ==============

@api_router.get("/reference/cooking-methods")
async def get_cooking_methods():
    """Get available cooking methods and their retention factors"""
    return {
        "methods": list(RETENTION_FACTORS.keys()),
        "retention_factors": RETENTION_FACTORS
    }

@api_router.get("/reference/safe-temperatures")
async def get_safe_temperatures():
    """Get safe cooking temperature guidelines"""
    return {"temperatures": SAFE_TEMPERATURES}

@api_router.get("/reference/allergens")
async def get_allergen_list():
    """Get list of tracked allergens"""
    return {"allergens": MAJOR_ALLERGENS}

@api_router.get("/reference/elements")
async def get_element_info():
    """Get elemental calculation reference data"""
    return {
        "atomic_weights": ATOMIC_WEIGHTS,
        "macronutrient_fractions": {
            "protein": PROTEIN_FRACTIONS,
            "carbohydrates": CARB_FRACTIONS,
            "fat": FAT_FRACTIONS
        }
    }

# ============== HEALTH & FITNESS MODELS ==============

class UserGoals(BaseModel):
    calories: int = 2000
    protein: int = 150  # grams
    carbs: int = 200  # grams
    fat: int = 65  # grams
    water: int = 8  # glasses (8oz each)
    steps: int = 10000
    net_carbs_mode: bool = False
    goal_type: str = "maintenance"  # maintenance, weight_loss, weight_gain, muscle_gain

class GoalsUpdate(BaseModel):
    calories: Optional[int] = None
    protein: Optional[int] = None
    carbs: Optional[int] = None
    fat: Optional[int] = None
    water: Optional[int] = None
    steps: Optional[int] = None
    net_carbs_mode: Optional[bool] = None
    goal_type: Optional[str] = None

class FoodLogEntry(BaseModel):
    name: str
    calories: float
    protein: float = 0
    carbs: float = 0
    fat: float = 0
    fiber: float = 0
    amount: float = 1
    unit: str = "serving"
    meal_type: str = "snack"  # breakfast, lunch, dinner, snack
    fdc_id: Optional[int] = None

class WaterLogEntry(BaseModel):
    glasses: int = 1
    notes: Optional[str] = None

class WorkoutEntry(BaseModel):
    workout_type: str
    name: str
    duration_minutes: int
    calories_burned: int = 0
    notes: Optional[str] = None
    exercises: Optional[List[Dict[str, Any]]] = None

class WeightEntry(BaseModel):
    weight: float
    unit: str = "kg"
    notes: Optional[str] = None

class StepsEntry(BaseModel):
    steps: int
    source: str = "manual"  # manual, google_fit, apple_health, fitbit, samsung_health

class MealPlanEntry(BaseModel):
    day_of_week: int  # 0=Monday, 6=Sunday
    meal_type: str  # breakfast, lunch, dinner, snack
    recipe_id: Optional[str] = None
    food_name: Optional[str] = None
    calories: Optional[float] = None
    notes: Optional[str] = None

class ConnectedApp(BaseModel):
    provider: str  # google_fit, apple_health, fitbit, samsung_health
    access_token: str
    refresh_token: Optional[str] = None
    expires_at: Optional[datetime] = None

# ============== HELPER FUNCTIONS ==============

def get_date_str(date: Optional[datetime] = None) -> str:
    """Get date string in YYYY-MM-DD format"""
    if date is None:
        date = datetime.now(timezone.utc)
    return date.strftime("%Y-%m-%d")

async def get_or_create_daily_log(user_id: str, date_str: str) -> Dict:
    """Get or create a daily log entry"""
    log = await db.daily_logs.find_one(
        {"user_id": user_id, "date": date_str},
        {"_id": 0}
    )
    if not log:
        log = {
            "log_id": f"log_{uuid.uuid4().hex[:12]}",
            "user_id": user_id,
            "date": date_str,
            "food_entries": [],
            "water_glasses": 0,
            "water_entries": [],
            "workouts": [],
            "steps": 0,
            "steps_entries": [],
            "weight": None,
            "created_at": datetime.now(timezone.utc).isoformat()
        }
        await db.daily_logs.insert_one(log)
        if "_id" in log:
            del log["_id"]
    return log

async def calculate_daily_totals(log: Dict) -> Dict:
    """Calculate totals from food entries"""
    totals = {
        "calories": 0,
        "protein": 0,
        "carbs": 0,
        "fat": 0,
        "fiber": 0,
        "net_carbs": 0
    }
    for entry in log.get("food_entries", []):
        totals["calories"] += entry.get("calories", 0)
        totals["protein"] += entry.get("protein", 0)
        totals["carbs"] += entry.get("carbs", 0)
        totals["fat"] += entry.get("fat", 0)
        totals["fiber"] += entry.get("fiber", 0)
    
    totals["net_carbs"] = max(0, totals["carbs"] - totals["fiber"])
    return totals

# ============== GOALS ENDPOINTS ==============

@api_router.get("/goals")
async def get_user_goals(user: User = Depends(get_current_user)):
    """Get user's daily goals"""
    goals = await db.user_goals.find_one({"user_id": user.user_id}, {"_id": 0})
    if not goals:
        # Return defaults
        return UserGoals().model_dump()
    return goals

@api_router.put("/goals")
async def update_user_goals(updates: GoalsUpdate, user: User = Depends(get_current_user)):
    """Update user's daily goals"""
    # Get existing or create defaults
    existing = await db.user_goals.find_one({"user_id": user.user_id})
    
    update_data = {k: v for k, v in updates.model_dump().items() if v is not None}
    
    if existing:
        await db.user_goals.update_one(
            {"user_id": user.user_id},
            {"$set": update_data}
        )
    else:
        defaults = UserGoals().model_dump()
        defaults.update(update_data)
        defaults["user_id"] = user.user_id
        await db.user_goals.insert_one(defaults)
    
    return await db.user_goals.find_one({"user_id": user.user_id}, {"_id": 0})

# ============== FOOD LOG ENDPOINTS ==============

@api_router.get("/food-log")
async def get_food_log(date: Optional[str] = None, user: User = Depends(get_current_user)):
    """Get food log for a specific date"""
    date_str = date or get_date_str()
    log = await get_or_create_daily_log(user.user_id, date_str)
    totals = await calculate_daily_totals(log)
    goals = await db.user_goals.find_one({"user_id": user.user_id}, {"_id": 0})
    if not goals:
        goals = UserGoals().model_dump()
    
    return {
        "date": date_str,
        "entries": log.get("food_entries", []),
        "totals": totals,
        "goals": goals,
        "by_meal": {
            "breakfast": [e for e in log.get("food_entries", []) if e.get("meal_type") == "breakfast"],
            "lunch": [e for e in log.get("food_entries", []) if e.get("meal_type") == "lunch"],
            "dinner": [e for e in log.get("food_entries", []) if e.get("meal_type") == "dinner"],
            "snack": [e for e in log.get("food_entries", []) if e.get("meal_type") == "snack"]
        }
    }

@api_router.post("/food-log")
async def add_food_entry(entry: FoodLogEntry, date: Optional[str] = None, user: User = Depends(get_current_user)):
    """Add a food entry to the log"""
    date_str = date or get_date_str()
    await get_or_create_daily_log(user.user_id, date_str)
    
    food_entry = {
        "entry_id": f"food_{uuid.uuid4().hex[:8]}",
        **entry.model_dump(),
        "logged_at": datetime.now(timezone.utc).isoformat()
    }
    
    await db.daily_logs.update_one(
        {"user_id": user.user_id, "date": date_str},
        {"$push": {"food_entries": food_entry}}
    )
    
    return food_entry

@api_router.delete("/food-log/{entry_id}")
async def delete_food_entry(entry_id: str, date: Optional[str] = None, user: User = Depends(get_current_user)):
    """Delete a food entry"""
    date_str = date or get_date_str()
    
    result = await db.daily_logs.update_one(
        {"user_id": user.user_id, "date": date_str},
        {"$pull": {"food_entries": {"entry_id": entry_id}}}
    )
    
    if result.modified_count == 0:
        raise HTTPException(status_code=404, detail="Entry not found")
    
    return {"message": "Entry deleted"}

# ============== WATER TRACKING ENDPOINTS ==============

@api_router.get("/water-log")
async def get_water_log(date: Optional[str] = None, user: User = Depends(get_current_user)):
    """Get water intake for a specific date"""
    date_str = date or get_date_str()
    log = await get_or_create_daily_log(user.user_id, date_str)
    goals = await db.user_goals.find_one({"user_id": user.user_id}, {"_id": 0})
    water_goal = goals.get("water", 8) if goals else 8
    
    return {
        "date": date_str,
        "glasses": log.get("water_glasses", 0),
        "goal": water_goal,
        "entries": log.get("water_entries", []),
        "percentage": min(100, (log.get("water_glasses", 0) / water_goal) * 100)
    }

@api_router.post("/water-log")
async def add_water_entry(entry: WaterLogEntry, date: Optional[str] = None, user: User = Depends(get_current_user)):
    """Add water intake"""
    date_str = date or get_date_str()
    await get_or_create_daily_log(user.user_id, date_str)
    
    water_entry = {
        "entry_id": f"water_{uuid.uuid4().hex[:8]}",
        "glasses": entry.glasses,
        "notes": entry.notes,
        "logged_at": datetime.now(timezone.utc).isoformat()
    }
    
    await db.daily_logs.update_one(
        {"user_id": user.user_id, "date": date_str},
        {
            "$inc": {"water_glasses": entry.glasses},
            "$push": {"water_entries": water_entry}
        }
    )
    
    log = await db.daily_logs.find_one(
        {"user_id": user.user_id, "date": date_str},
        {"_id": 0}
    )
    
    return {
        "entry": water_entry,
        "total_glasses": log.get("water_glasses", 0)
    }

@api_router.post("/water-log/quick")
async def quick_add_water(glasses: int = 1, date: Optional[str] = None, user: User = Depends(get_current_user)):
    """Quick add water (1 glass default)"""
    entry = WaterLogEntry(glasses=glasses)
    return await add_water_entry(entry, date, user)

# ============== WORKOUT ENDPOINTS ==============

@api_router.get("/workouts")
async def get_workouts(date: Optional[str] = None, user: User = Depends(get_current_user)):
    """Get workouts for a specific date"""
    date_str = date or get_date_str()
    log = await get_or_create_daily_log(user.user_id, date_str)
    
    total_calories = sum(w.get("calories_burned", 0) for w in log.get("workouts", []))
    total_duration = sum(w.get("duration_minutes", 0) for w in log.get("workouts", []))
    
    return {
        "date": date_str,
        "workouts": log.get("workouts", []),
        "total_calories_burned": total_calories,
        "total_duration_minutes": total_duration
    }

@api_router.post("/workouts")
async def add_workout(workout: WorkoutEntry, date: Optional[str] = None, user: User = Depends(get_current_user)):
    """Add a workout entry"""
    date_str = date or get_date_str()
    await get_or_create_daily_log(user.user_id, date_str)
    
    workout_entry = {
        "workout_id": f"workout_{uuid.uuid4().hex[:8]}",
        **workout.model_dump(),
        "logged_at": datetime.now(timezone.utc).isoformat()
    }
    
    await db.daily_logs.update_one(
        {"user_id": user.user_id, "date": date_str},
        {"$push": {"workouts": workout_entry}}
    )
    
    return workout_entry

@api_router.delete("/workouts/{workout_id}")
async def delete_workout(workout_id: str, date: Optional[str] = None, user: User = Depends(get_current_user)):
    """Delete a workout"""
    date_str = date or get_date_str()
    
    result = await db.daily_logs.update_one(
        {"user_id": user.user_id, "date": date_str},
        {"$pull": {"workouts": {"workout_id": workout_id}}}
    )
    
    if result.modified_count == 0:
        raise HTTPException(status_code=404, detail="Workout not found")
    
    return {"message": "Workout deleted"}

# ============== WEIGHT TRACKING ENDPOINTS ==============

@api_router.get("/weight")
async def get_weight_history(days: int = 30, user: User = Depends(get_current_user)):
    """Get weight history for past N days"""
    entries = await db.weight_logs.find(
        {"user_id": user.user_id},
        {"_id": 0}
    ).sort("date", -1).limit(days).to_list(days)
    
    return {
        "entries": entries,
        "latest": entries[0] if entries else None,
        "trend": calculate_weight_trend(entries) if len(entries) >= 2 else None
    }

def calculate_weight_trend(entries: List[Dict]) -> Dict:
    """Calculate weight trend from entries"""
    if len(entries) < 2:
        return None
    
    latest = entries[0].get("weight", 0)
    oldest = entries[-1].get("weight", 0)
    change = latest - oldest
    
    return {
        "change": round(change, 2),
        "direction": "up" if change > 0 else "down" if change < 0 else "stable",
        "percentage": round((change / oldest) * 100, 2) if oldest > 0 else 0
    }

@api_router.post("/weight")
async def log_weight(entry: WeightEntry, date: Optional[str] = None, user: User = Depends(get_current_user)):
    """Log weight for a date"""
    date_str = date or get_date_str()
    
    weight_doc = {
        "weight_id": f"weight_{uuid.uuid4().hex[:8]}",
        "user_id": user.user_id,
        "date": date_str,
        "weight": entry.weight,
        "unit": entry.unit,
        "notes": entry.notes,
        "logged_at": datetime.now(timezone.utc).isoformat()
    }
    
    # Upsert - update if exists for date, insert if not
    await db.weight_logs.update_one(
        {"user_id": user.user_id, "date": date_str},
        {"$set": weight_doc},
        upsert=True
    )
    
    # Also update daily log
    await db.daily_logs.update_one(
        {"user_id": user.user_id, "date": date_str},
        {"$set": {"weight": entry.weight}}
    )
    
    return weight_doc

# ============== STEPS TRACKING ENDPOINTS ==============

@api_router.get("/steps")
async def get_steps(date: Optional[str] = None, user: User = Depends(get_current_user)):
    """Get steps for a specific date"""
    date_str = date or get_date_str()
    log = await get_or_create_daily_log(user.user_id, date_str)
    goals = await db.user_goals.find_one({"user_id": user.user_id}, {"_id": 0})
    steps_goal = goals.get("steps", 10000) if goals else 10000
    
    return {
        "date": date_str,
        "steps": log.get("steps", 0),
        "goal": steps_goal,
        "entries": log.get("steps_entries", []),
        "percentage": min(100, (log.get("steps", 0) / steps_goal) * 100)
    }

@api_router.post("/steps")
async def log_steps(entry: StepsEntry, date: Optional[str] = None, user: User = Depends(get_current_user)):
    """Log steps for a date"""
    date_str = date or get_date_str()
    await get_or_create_daily_log(user.user_id, date_str)
    
    steps_entry = {
        "entry_id": f"steps_{uuid.uuid4().hex[:8]}",
        "steps": entry.steps,
        "source": entry.source,
        "logged_at": datetime.now(timezone.utc).isoformat()
    }
    
    # For manual entries, add to total. For synced, replace total
    if entry.source == "manual":
        await db.daily_logs.update_one(
            {"user_id": user.user_id, "date": date_str},
            {
                "$inc": {"steps": entry.steps},
                "$push": {"steps_entries": steps_entry}
            }
        )
    else:
        await db.daily_logs.update_one(
            {"user_id": user.user_id, "date": date_str},
            {
                "$set": {"steps": entry.steps},
                "$push": {"steps_entries": steps_entry}
            }
        )
    
    log = await db.daily_logs.find_one(
        {"user_id": user.user_id, "date": date_str},
        {"_id": 0}
    )
    
    return {
        "entry": steps_entry,
        "total_steps": log.get("steps", 0)
    }

# ============== DASHBOARD / DAILY SUMMARY ==============

@api_router.get("/dashboard")
async def get_dashboard(date: Optional[str] = None, user: User = Depends(get_current_user)):
    """Get comprehensive dashboard data for a date"""
    date_str = date or get_date_str()
    log = await get_or_create_daily_log(user.user_id, date_str)
    goals = await db.user_goals.find_one({"user_id": user.user_id}, {"_id": 0})
    if not goals:
        goals = UserGoals().model_dump()
    
    # Calculate nutrition totals
    nutrition = await calculate_daily_totals(log)
    
    # Get workout stats
    total_calories_burned = sum(w.get("calories_burned", 0) for w in log.get("workouts", []))
    
    # Calculate net calories
    net_calories = nutrition["calories"] - total_calories_burned
    
    # Get recent weight
    weight_entry = await db.weight_logs.find_one(
        {"user_id": user.user_id},
        {"_id": 0},
        sort=[("date", -1)]
    )
    
    return {
        "date": date_str,
        "goals": goals,
        "nutrition": {
            "consumed": nutrition,
            "remaining": {
                "calories": goals["calories"] - nutrition["calories"],
                "protein": goals["protein"] - nutrition["protein"],
                "carbs": goals["carbs"] - nutrition["carbs"],
                "fat": goals["fat"] - nutrition["fat"]
            },
            "percentages": {
                "calories": min(100, (nutrition["calories"] / goals["calories"]) * 100) if goals["calories"] > 0 else 0,
                "protein": min(100, (nutrition["protein"] / goals["protein"]) * 100) if goals["protein"] > 0 else 0,
                "carbs": min(100, (nutrition["carbs"] / goals["carbs"]) * 100) if goals["carbs"] > 0 else 0,
                "fat": min(100, (nutrition["fat"] / goals["fat"]) * 100) if goals["fat"] > 0 else 0
            }
        },
        "water": {
            "glasses": log.get("water_glasses", 0),
            "goal": goals["water"],
            "percentage": min(100, (log.get("water_glasses", 0) / goals["water"]) * 100) if goals["water"] > 0 else 0
        },
        "exercise": {
            "workouts_count": len(log.get("workouts", [])),
            "calories_burned": total_calories_burned,
            "total_duration": sum(w.get("duration_minutes", 0) for w in log.get("workouts", []))
        },
        "steps": {
            "count": log.get("steps", 0),
            "goal": goals["steps"],
            "percentage": min(100, (log.get("steps", 0) / goals["steps"]) * 100) if goals["steps"] > 0 else 0
        },
        "net_calories": net_calories,
        "weight": weight_entry.get("weight") if weight_entry else None,
        "meals": {
            "breakfast": len([e for e in log.get("food_entries", []) if e.get("meal_type") == "breakfast"]),
            "lunch": len([e for e in log.get("food_entries", []) if e.get("meal_type") == "lunch"]),
            "dinner": len([e for e in log.get("food_entries", []) if e.get("meal_type") == "dinner"]),
            "snack": len([e for e in log.get("food_entries", []) if e.get("meal_type") == "snack"])
        }
    }

# ============== PROGRESS / HISTORY ENDPOINTS ==============

@api_router.get("/progress")
async def get_progress(days: int = 7, user: User = Depends(get_current_user)):
    """Get progress over past N days"""
    today = datetime.now(timezone.utc)
    dates = [(today - timedelta(days=i)).strftime("%Y-%m-%d") for i in range(days)]
    
    logs = await db.daily_logs.find(
        {"user_id": user.user_id, "date": {"$in": dates}},
        {"_id": 0}
    ).to_list(days)
    
    logs_by_date = {log["date"]: log for log in logs}
    
    # Get weight history
    weights = await db.weight_logs.find(
        {"user_id": user.user_id, "date": {"$in": dates}},
        {"_id": 0}
    ).to_list(days)
    weights_by_date = {w["date"]: w["weight"] for w in weights}
    
    # Build daily summaries
    daily_data = []
    for date_str in reversed(dates):  # oldest first for charts
        log = logs_by_date.get(date_str, {})
        totals = await calculate_daily_totals(log) if log else {"calories": 0, "protein": 0, "carbs": 0, "fat": 0}
        
        daily_data.append({
            "date": date_str,
            "calories": totals["calories"],
            "protein": totals["protein"],
            "carbs": totals["carbs"],
            "fat": totals["fat"],
            "water": log.get("water_glasses", 0),
            "steps": log.get("steps", 0),
            "workouts": len(log.get("workouts", [])),
            "weight": weights_by_date.get(date_str)
        })
    
    # Calculate averages
    non_zero_days = [d for d in daily_data if d["calories"] > 0]
    avg_calories = sum(d["calories"] for d in non_zero_days) / len(non_zero_days) if non_zero_days else 0
    
    return {
        "period_days": days,
        "daily_data": daily_data,
        "averages": {
            "calories": round(avg_calories, 0),
            "protein": round(sum(d["protein"] for d in non_zero_days) / len(non_zero_days), 1) if non_zero_days else 0,
            "carbs": round(sum(d["carbs"] for d in non_zero_days) / len(non_zero_days), 1) if non_zero_days else 0,
            "fat": round(sum(d["fat"] for d in non_zero_days) / len(non_zero_days), 1) if non_zero_days else 0,
            "water": round(sum(d["water"] for d in daily_data) / len(daily_data), 1),
            "steps": round(sum(d["steps"] for d in daily_data) / len(daily_data), 0)
        },
        "weight_trend": calculate_weight_trend(weights) if len(weights) >= 2 else None
    }

# ============== MEAL PLANNER ENDPOINTS ==============

@api_router.get("/meal-plan")
async def get_meal_plan(week_start: Optional[str] = None, user: User = Depends(get_current_user)):
    """Get meal plan for a week"""
    if week_start:
        start_date = datetime.strptime(week_start, "%Y-%m-%d")
    else:
        today = datetime.now(timezone.utc)
        start_date = today - timedelta(days=today.weekday())  # Monday of current week
    
    week_start_str = start_date.strftime("%Y-%m-%d")
    
    plan = await db.meal_plans.find_one(
        {"user_id": user.user_id, "week_start": week_start_str},
        {"_id": 0}
    )
    
    if not plan:
        # Create empty plan
        plan = {
            "plan_id": f"plan_{uuid.uuid4().hex[:12]}",
            "user_id": user.user_id,
            "week_start": week_start_str,
            "meals": [],
            "created_at": datetime.now(timezone.utc).isoformat()
        }
        await db.meal_plans.insert_one(plan)
        if "_id" in plan:
            del plan["_id"]
    
    return plan

@api_router.post("/meal-plan")
async def add_meal_to_plan(entry: MealPlanEntry, week_start: Optional[str] = None, user: User = Depends(get_current_user)):
    """Add a meal to the weekly plan"""
    if week_start:
        start_date = datetime.strptime(week_start, "%Y-%m-%d")
    else:
        today = datetime.now(timezone.utc)
        start_date = today - timedelta(days=today.weekday())
    
    week_start_str = start_date.strftime("%Y-%m-%d")
    
    # Ensure plan exists
    existing = await db.meal_plans.find_one({"user_id": user.user_id, "week_start": week_start_str})
    if not existing:
        await db.meal_plans.insert_one({
            "plan_id": f"plan_{uuid.uuid4().hex[:12]}",
            "user_id": user.user_id,
            "week_start": week_start_str,
            "meals": [],
            "created_at": datetime.now(timezone.utc).isoformat()
        })
    
    meal_entry = {
        "meal_id": f"meal_{uuid.uuid4().hex[:8]}",
        **entry.model_dump(),
        "added_at": datetime.now(timezone.utc).isoformat()
    }
    
    await db.meal_plans.update_one(
        {"user_id": user.user_id, "week_start": week_start_str},
        {"$push": {"meals": meal_entry}}
    )
    
    return meal_entry

@api_router.delete("/meal-plan/{meal_id}")
async def delete_meal_from_plan(meal_id: str, week_start: Optional[str] = None, user: User = Depends(get_current_user)):
    """Remove a meal from the plan"""
    if week_start:
        start_date = datetime.strptime(week_start, "%Y-%m-%d")
    else:
        today = datetime.now(timezone.utc)
        start_date = today - timedelta(days=today.weekday())
    
    week_start_str = start_date.strftime("%Y-%m-%d")
    
    result = await db.meal_plans.update_one(
        {"user_id": user.user_id, "week_start": week_start_str},
        {"$pull": {"meals": {"meal_id": meal_id}}}
    )
    
    if result.modified_count == 0:
        raise HTTPException(status_code=404, detail="Meal not found")
    
    return {"message": "Meal removed from plan"}

# ============== CONNECTED APPS / FITNESS INTEGRATIONS ==============

# OAuth URLs for fitness providers (these would need real client IDs in production)
FITNESS_PROVIDERS = {
    "google_fit": {
        "name": "Google Fit",
        "auth_url": "https://accounts.google.com/o/oauth2/v2/auth",
        "token_url": "https://oauth2.googleapis.com/token",
        "scopes": ["https://www.googleapis.com/auth/fitness.activity.read", 
                   "https://www.googleapis.com/auth/fitness.body.read",
                   "https://www.googleapis.com/auth/fitness.heart_rate.read"]
    },
    "fitbit": {
        "name": "Fitbit",
        "auth_url": "https://www.fitbit.com/oauth2/authorize",
        "token_url": "https://api.fitbit.com/oauth2/token",
        "scopes": ["activity", "heartrate", "weight", "profile"]
    },
    "apple_health": {
        "name": "Apple Health",
        "note": "Requires iOS app with HealthKit integration"
    },
    "samsung_health": {
        "name": "Samsung Health",
        "note": "Requires Samsung Health SDK integration"
    }
}

@api_router.get("/connected-apps")
async def get_connected_apps(user: User = Depends(get_current_user)):
    """Get list of connected fitness apps"""
    connections = await db.connected_apps.find(
        {"user_id": user.user_id},
        {"_id": 0, "access_token": 0, "refresh_token": 0}  # Don't expose tokens
    ).to_list(10)
    
    return {
        "connected": connections,
        "available": FITNESS_PROVIDERS
    }

@api_router.post("/connected-apps/{provider}/connect")
async def connect_fitness_app(provider: str, tokens: ConnectedApp, user: User = Depends(get_current_user)):
    """Store connection tokens for a fitness provider"""
    if provider not in FITNESS_PROVIDERS:
        raise HTTPException(status_code=400, detail="Unknown provider")
    
    connection = {
        "connection_id": f"conn_{uuid.uuid4().hex[:12]}",
        "user_id": user.user_id,
        "provider": provider,
        "provider_name": FITNESS_PROVIDERS[provider]["name"],
        "access_token": tokens.access_token,
        "refresh_token": tokens.refresh_token,
        "expires_at": tokens.expires_at.isoformat() if tokens.expires_at else None,
        "connected_at": datetime.now(timezone.utc).isoformat()
    }
    
    # Upsert - one connection per provider per user
    await db.connected_apps.update_one(
        {"user_id": user.user_id, "provider": provider},
        {"$set": connection},
        upsert=True
    )
    
    return {"message": f"Connected to {FITNESS_PROVIDERS[provider]['name']}", "provider": provider}

@api_router.delete("/connected-apps/{provider}")
async def disconnect_fitness_app(provider: str, user: User = Depends(get_current_user)):
    """Disconnect a fitness provider"""
    result = await db.connected_apps.delete_one(
        {"user_id": user.user_id, "provider": provider}
    )
    
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Connection not found")
    
    return {"message": f"Disconnected from {provider}"}

# ============== WORKOUT TYPES REFERENCE ==============

WORKOUT_TYPES = [
    {"type": "cardio", "name": "Cardio", "examples": ["Running", "Cycling", "Swimming", "HIIT", "Jump Rope"]},
    {"type": "strength", "name": "Strength Training", "examples": ["Weight Lifting", "Bodyweight", "Resistance Bands"]},
    {"type": "flexibility", "name": "Flexibility", "examples": ["Yoga", "Stretching", "Pilates"]},
    {"type": "sports", "name": "Sports", "examples": ["Basketball", "Soccer", "Tennis", "Golf"]},
    {"type": "walking", "name": "Walking", "examples": ["Casual Walk", "Power Walking", "Hiking"]},
    {"type": "other", "name": "Other", "examples": ["Dancing", "Martial Arts", "CrossFit"]}
]

@api_router.get("/reference/workout-types")
async def get_workout_types():
    """Get available workout types"""
    return {"workout_types": WORKOUT_TYPES}

# ============== ROOT ENDPOINT ==============

@api_router.get("/")
async def root():
    return {"message": "ElementEats API - Food Elemental Analyzer & Health Tracker", "version": "2.0.0"}

# Include router and setup middleware
app.include_router(api_router)

app.add_middleware(
    CORSMiddleware,
    allow_credentials=True,
    allow_origins=os.environ.get('CORS_ORIGINS', '*').split(','),
    allow_methods=["*"],
    allow_headers=["*"],
)

@app.on_event("shutdown")
async def shutdown_db_client():
    client.close()
