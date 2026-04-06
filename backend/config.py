"""NutriOS Configuration — env vars, constants, logging."""
import os
import logging
from pathlib import Path
from dotenv import load_dotenv

ROOT_DIR = Path(__file__).parent
load_dotenv(ROOT_DIR / '.env')

# ── Logging ──
logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(name)s - %(levelname)s - %(message)s')
logger = logging.getLogger('nutrios')

# ── API Keys ──
MONGO_URL = os.environ['MONGO_URL']
DB_NAME = os.environ.get('DB_NAME', 'nutrient_mapper')
USDA_API_KEY = os.environ.get('USDA_API_KEY', '')
USDA_BASE_URL = "https://api.nal.usda.gov/fdc/v1"
EMERGENT_LLM_KEY = os.environ.get('EMERGENT_LLM_KEY', '')
STRIPE_API_KEY = os.environ.get('STRIPE_API_KEY', '')
RESEND_API_KEY = os.environ.get('RESEND_API_KEY', '')
SENDER_EMAIL = os.environ.get('SENDER_EMAIL', 'onboarding@resend.dev')

# ── Payment Constants ──
TRIAL_DAYS = 17
MONTHLY_PRICE_EUR = 2.99
ANNUAL_PRICE_EUR = 29.99

# ── Elemental / Nutrition Constants ──
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

IDEAL_ELEMENTAL_BALANCE = {
    "C": {"min_pct": 45, "max_pct": 55, "ideal_pct": 50, "role": "Energy backbone"},
    "H": {"min_pct": 6, "max_pct": 10, "ideal_pct": 7.5, "role": "Hydration & bonding"},
    "O": {"min_pct": 20, "max_pct": 35, "ideal_pct": 28, "role": "Cellular respiration"},
    "N": {"min_pct": 3, "max_pct": 8, "ideal_pct": 5, "role": "Protein synthesis"},
    "S": {"min_pct": 0.2, "max_pct": 1.5, "ideal_pct": 0.8, "role": "Protein structure & detox"},
}

# ── Molecular Optimization Profiles ──
GOAL_PROFILES = {
    "muscle_gain": {
        "name": "Muscle Growth",
        "description": "Optimize nitrogen balance and protein synthesis for lean muscle mass",
        "priority_elements": {"N": 2.0, "S": 1.5, "Zn": 1.8, "Mg": 1.5, "Fe": 1.3, "K": 1.2, "Ca": 1.2},
        "priority_nutrients": {"protein_g": 2.0, "iron_mg": 1.5, "zinc_mg": 1.8, "magnesium_mg": 1.5, "potassium_mg": 1.2, "calcium_mg": 1.2, "vitamin_b6_mg": 1.5},
        "ideal_macro_ratio": {"protein": 0.35, "carbs": 0.40, "fat": 0.25},
        "key_foods": ["chicken breast", "salmon", "eggs", "greek yogurt", "quinoa", "lentils", "beef", "tofu", "almonds", "sweet potato"],
        "synergy_pairs": [
            {"foods": ["chicken", "brown rice"], "reason": "Complete amino acid profile with sustained energy"},
            {"foods": ["salmon", "spinach"], "reason": "Omega-3 + Iron + Magnesium for recovery"},
            {"foods": ["eggs", "avocado"], "reason": "Complete protein + healthy fats for hormone synthesis"},
            {"foods": ["beef", "broccoli"], "reason": "Iron + Vitamin C for maximum iron absorption"},
        ],
    },
    "brain_health": {
        "name": "Brain Function",
        "description": "Enhance cognitive performance with omega-3, B vitamins, and key minerals",
        "priority_elements": {"Mg": 2.0, "Zn": 1.8, "Fe": 1.5, "K": 1.5, "P": 1.5, "Ca": 1.2},
        "priority_nutrients": {"magnesium_mg": 2.0, "zinc_mg": 1.5, "iron_mg": 1.3, "potassium_mg": 1.5, "vitamin_c_mg": 1.3, "vitamin_a_mcg": 1.3},
        "ideal_macro_ratio": {"protein": 0.25, "carbs": 0.45, "fat": 0.30},
        "key_foods": ["salmon", "walnuts", "blueberries", "spinach", "dark chocolate", "turmeric", "avocado", "eggs", "sardines", "olive oil"],
        "synergy_pairs": [
            {"foods": ["salmon", "walnuts"], "reason": "DHA + ALA omega-3 synergy for neuroprotection"},
            {"foods": ["spinach", "eggs"], "reason": "Folate + Choline for neurotransmitter synthesis"},
            {"foods": ["dark chocolate", "blueberries"], "reason": "Flavonoids synergy for cerebral blood flow"},
            {"foods": ["turmeric", "olive oil"], "reason": "Curcumin + fat for brain anti-inflammatory absorption"},
        ],
    },
    "immune_system": {
        "name": "Immune Defense",
        "description": "Strengthen immune response with zinc, vitamin C, and antioxidants",
        "priority_elements": {"Zn": 2.5, "Fe": 1.8, "Ca": 1.3, "Mg": 1.5, "K": 1.2},
        "priority_nutrients": {"zinc_mg": 2.5, "vitamin_c_mg": 2.0, "iron_mg": 1.8, "vitamin_a_mcg": 1.8, "magnesium_mg": 1.3},
        "ideal_macro_ratio": {"protein": 0.30, "carbs": 0.45, "fat": 0.25},
        "key_foods": ["citrus fruits", "garlic", "ginger", "spinach", "yogurt", "almonds", "bell peppers", "broccoli", "shellfish", "sunflower seeds"],
        "synergy_pairs": [
            {"foods": ["citrus", "spinach"], "reason": "Vitamin C enhances iron absorption for immune cells"},
            {"foods": ["garlic", "ginger"], "reason": "Allicin + Gingerol dual antimicrobial action"},
            {"foods": ["yogurt", "berries"], "reason": "Probiotics + antioxidants for gut-immune axis"},
            {"foods": ["bell peppers", "almonds"], "reason": "Vitamin C + Vitamin E antioxidant synergy"},
        ],
    },
    "gut_microbiome": {
        "name": "Gut Health",
        "description": "Nourish beneficial bacteria with fiber, prebiotics, and fermented foods",
        "priority_elements": {"Mg": 1.8, "K": 1.5, "Ca": 1.5, "Zn": 1.3, "Fe": 1.2},
        "priority_nutrients": {"fiber_g": 2.5, "magnesium_mg": 1.5, "potassium_mg": 1.5, "calcium_mg": 1.5, "zinc_mg": 1.3},
        "ideal_macro_ratio": {"protein": 0.20, "carbs": 0.55, "fat": 0.25},
        "key_foods": ["yogurt", "kefir", "sauerkraut", "kimchi", "oats", "bananas", "garlic", "onions", "asparagus", "lentils"],
        "synergy_pairs": [
            {"foods": ["yogurt", "banana"], "reason": "Probiotics + prebiotic fiber feeds beneficial bacteria"},
            {"foods": ["oats", "berries"], "reason": "Beta-glucan + polyphenols for microbiome diversity"},
            {"foods": ["garlic", "lentils"], "reason": "Inulin + resistant starch for short-chain fatty acids"},
            {"foods": ["kimchi", "brown rice"], "reason": "Fermented cultures + fiber for gut lining repair"},
        ],
    },
    "longevity": {
        "name": "Longevity & Anti-Aging",
        "description": "Reduce inflammation and oxidative stress for healthy aging",
        "priority_elements": {"Mg": 2.0, "Zn": 1.5, "K": 1.8, "Ca": 1.5, "Fe": 1.0},
        "priority_nutrients": {"magnesium_mg": 2.0, "potassium_mg": 1.8, "vitamin_c_mg": 1.5, "vitamin_a_mcg": 1.5, "zinc_mg": 1.5, "fiber_g": 1.8},
        "ideal_macro_ratio": {"protein": 0.20, "carbs": 0.50, "fat": 0.30},
        "key_foods": ["olive oil", "salmon", "blueberries", "nuts", "leafy greens", "beans", "green tea", "tomatoes", "sweet potatoes", "avocado"],
        "synergy_pairs": [
            {"foods": ["olive oil", "tomatoes"], "reason": "Fat + lycopene synergy for cardiovascular protection"},
            {"foods": ["salmon", "leafy greens"], "reason": "Omega-3 + folate for DNA repair and telomere health"},
            {"foods": ["blueberries", "nuts"], "reason": "Anthocyanins + Vitamin E antioxidant cascade"},
            {"foods": ["green tea", "lemon"], "reason": "Catechins + Vitamin C for enhanced antioxidant stability"},
        ],
    },
    "reduce_inflammation": {
        "name": "Anti-Inflammation",
        "description": "Target inflammatory markers with omega-3, antioxidants, and key minerals",
        "priority_elements": {"Mg": 2.0, "Zn": 1.5, "K": 1.5, "Fe": 1.0, "Ca": 1.2},
        "priority_nutrients": {"magnesium_mg": 2.0, "vitamin_c_mg": 1.8, "zinc_mg": 1.5, "potassium_mg": 1.5, "vitamin_a_mcg": 1.5},
        "ideal_macro_ratio": {"protein": 0.25, "carbs": 0.45, "fat": 0.30},
        "key_foods": ["salmon", "turmeric", "ginger", "olive oil", "walnuts", "berries", "leafy greens", "tomatoes", "green tea", "avocado"],
        "synergy_pairs": [
            {"foods": ["turmeric", "black pepper"], "reason": "Piperine increases curcumin absorption 2000%"},
            {"foods": ["salmon", "olive oil"], "reason": "EPA/DHA + oleic acid dual anti-inflammatory pathway"},
            {"foods": ["ginger", "green tea"], "reason": "Gingerol + EGCG synergistic COX-2 inhibition"},
            {"foods": ["walnuts", "berries"], "reason": "ALA omega-3 + polyphenols reduce CRP markers"},
        ],
    },
}

# ── Badge Definitions ──
BADGE_DEFINITIONS = [
    {"id": "first_meal", "name": "First Bite", "description": "Log your first meal", "icon": "restaurant", "color": "#4ecdc4", "condition": "meals_logged >= 1"},
    {"id": "meal_streak_3", "name": "Consistent Eater", "description": "Log meals for 3 days straight", "icon": "flame", "color": "#ff6b6b", "condition": "streak >= 3"},
    {"id": "meal_streak_7", "name": "Week Warrior", "description": "7-day logging streak", "icon": "trophy", "color": "#ffd93d", "condition": "streak >= 7"},
    {"id": "meal_streak_30", "name": "Monthly Master", "description": "30-day logging streak", "icon": "medal", "color": "#a29bfe", "condition": "streak >= 30"},
    {"id": "hydration_hero", "name": "Hydration Hero", "description": "Hit water goal 5 times", "icon": "water", "color": "#00d4ff", "condition": "water_goals_met >= 5"},
    {"id": "protein_pro", "name": "Protein Pro", "description": "Hit protein goal 5 times", "icon": "barbell", "color": "#00ff88", "condition": "protein_goals_met >= 5"},
    {"id": "element_explorer", "name": "Element Explorer", "description": "Log 10 different foods", "icon": "flask", "color": "#fd79a8", "condition": "unique_foods >= 10"},
    {"id": "recipe_creator", "name": "Recipe Creator", "description": "Create your first recipe", "icon": "book", "color": "#e17055", "condition": "recipes_created >= 1"},
    {"id": "routine_master", "name": "Routine Master", "description": "Complete all routines for a day", "icon": "checkmark-done", "color": "#6c5ce7", "condition": "routines_completed_days >= 1"},
    {"id": "century_meals", "name": "Century Club", "description": "Log 100 meals total", "icon": "star", "color": "#ffeaa7", "condition": "meals_logged >= 100"},
]
