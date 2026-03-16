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
            response = await client.get(
                "https://api.nal.usda.gov/fdc/v1/foods/search",
                params={
                    "api_key": USDA_API_KEY,
                    "query": query,
                    "pageSize": page_size,
                    "dataType": ["Foundation", "SR Legacy", "Survey (FNDDS)"]
                },
                timeout=15.0
            )
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

# ============== ROOT ENDPOINT ==============

@api_router.get("/")
async def root():
    return {"message": "ElementEats API - Food Elemental Analyzer", "version": "1.0.0"}

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
