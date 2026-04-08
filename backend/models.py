"""NutriOS Pydantic Models with auto-sanitization."""
from pydantic import BaseModel, validator
from typing import List, Optional, Dict, Any
from datetime import datetime
from security import sanitize


# ── Base model that auto-sanitizes all string fields ──
class SanitizedModel(BaseModel):
    """Base model that sanitizes all str fields on assignment."""

    class Config:
        # Run validators on assignment (not just creation)
        validate_assignment = True

    @validator("*", pre=True, always=True)
    def _sanitize_strings(cls, v):
        if isinstance(v, str):
            return sanitize(v)
        if isinstance(v, list):
            return [sanitize(i) if isinstance(i, str) else i for i in v]
        return v


# ── Auth / User ──
class User(BaseModel):
    """User identity — not sanitized (system-populated)."""
    user_id: str
    email: str
    name: str
    picture: Optional[str] = None
    created_at: datetime = None
    weight_kg: Optional[float] = 70.0
    activity_level: Optional[str] = "moderate"
    health_goals: Optional[List[str]] = []


# ── Meals ──
class MealEntryCreate(SanitizedModel):
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


# ── Routines ──
class RoutineCreate(SanitizedModel):
    name: str
    type: str
    time_start: str
    time_end: str
    days: List[str] = ["mon", "tue", "wed", "thu", "fri", "sat", "sun"]
    tasks: List[Dict[str, Any]] = []


# ── Recipes ──
class RecipeCreate(SanitizedModel):
    name: str
    description: Optional[str] = ""
    ingredients: List[Dict[str, Any]] = []
    servings: int = 1
    prep_time_mins: Optional[int] = 0
    cook_time_mins: Optional[int] = 0
    instructions: Optional[List[str]] = []


# ── Meal Plans ──
class MealPlanCreate(SanitizedModel):
    date: str
    meal_type: str
    recipe_id: Optional[str] = None
    food_name: Optional[str] = None
    notes: Optional[str] = ""


# ── Favorites ──
class FavoriteCreate(SanitizedModel):
    fdc_id: int
    food_name: str
    default_portion_grams: float = 100
    default_cooking_method: str = "raw"


# ── AI ──
class AIRecommendationRequest(SanitizedModel):
    goal: str
    current_foods: Optional[List[str]] = []
    dietary_restrictions: Optional[List[str]] = []


class AIChatRequest(SanitizedModel):
    message: str
    conversation_history: str = ""
    nutrition_context: str = ""
