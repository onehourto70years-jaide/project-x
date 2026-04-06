"""NutriOS Pydantic Models."""
from pydantic import BaseModel
from typing import List, Optional, Dict, Any
from datetime import datetime


class User(BaseModel):
    user_id: str
    email: str
    name: str
    picture: Optional[str] = None
    created_at: datetime = None
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
    ingredients: List[Dict[str, Any]] = []
    servings: int = 1
    prep_time_mins: Optional[int] = 0
    cook_time_mins: Optional[int] = 0
    instructions: Optional[List[str]] = []


class MealPlanCreate(BaseModel):
    date: str
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


class AIChatRequest(BaseModel):
    message: str
    conversation_history: str = ""
    nutrition_context: str = ""
