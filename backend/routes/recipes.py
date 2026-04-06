from fastapi import APIRouter, Depends, HTTPException
from typing import Optional
import uuid
from datetime import datetime, timezone, timedelta
from database import db
from dependencies import require_user
from models import User, RecipeCreate, MealPlanCreate
from services import get_usda_food_details, extract_nutrients, apply_cooking_retention, calculate_elemental_composition, detect_allergens, update_daily_summary

router = APIRouter(tags=["recipes"])


@router.post("/recipes")
async def create_recipe(recipe: RecipeCreate, user: User = Depends(require_user)):
    total_nutrients, total_elements, all_allergens = {}, {}, []
    for ingredient in recipe.ingredients:
        if ingredient.get("fdc_id"):
            food_data = await get_usda_food_details(ingredient["fdc_id"])
            if food_data:
                nutrients = extract_nutrients(food_data, ingredient.get("portion_grams", 100))
                cooked = apply_cooking_retention(nutrients, ingredient.get("cooking_method", "raw"))
                elements = calculate_elemental_composition(cooked)
                allergens = detect_allergens(food_data.get("description", ""), food_data.get("ingredients", ""))
                for k, v in cooked.items(): total_nutrients[k] = total_nutrients.get(k, 0) + v
                for k, v in elements["mass_grams"].items(): total_elements[k] = total_elements.get(k, 0) + v
                all_allergens.extend(allergens)
    servings = recipe.servings or 1
    per_serving_nutrients = {k: round(v / servings, 2) for k, v in total_nutrients.items()}
    per_serving_elements = {k: round(v / servings, 6) for k, v in total_elements.items()}
    recipe_doc = {"id": str(uuid.uuid4()), "user_id": user.user_id, **recipe.dict(), "total_nutrients": total_nutrients, "total_elements": total_elements, "per_serving_nutrients": per_serving_nutrients, "per_serving_elements": per_serving_elements, "allergens": list(set(all_allergens)), "created_at": datetime.now(timezone.utc)}
    await db.recipes.insert_one(recipe_doc)
    return {"message": "Recipe created", "recipe_id": recipe_doc["id"], "per_serving_nutrients": per_serving_nutrients, "per_serving_elements": per_serving_elements, "allergens": list(set(all_allergens))}


@router.get("/recipes")
async def get_recipes(user: User = Depends(require_user)):
    recipes = await db.recipes.find({"user_id": user.user_id}, {"_id": 0}).sort("created_at", -1).to_list(100)
    return {"recipes": recipes}


@router.get("/recipes/{recipe_id}")
async def get_recipe(recipe_id: str, user: User = Depends(require_user)):
    recipe = await db.recipes.find_one({"id": recipe_id, "user_id": user.user_id}, {"_id": 0})
    if not recipe:
        raise HTTPException(status_code=404, detail="Recipe not found")
    return recipe


@router.delete("/recipes/{recipe_id}")
async def delete_recipe(recipe_id: str, user: User = Depends(require_user)):
    await db.recipes.delete_one({"id": recipe_id, "user_id": user.user_id})
    return {"message": "Recipe deleted"}


# Meal Plans
@router.post("/meal-plans")
async def create_meal_plan(plan: MealPlanCreate, user: User = Depends(require_user)):
    plan_doc = {"id": str(uuid.uuid4()), "user_id": user.user_id, **plan.dict(), "created_at": datetime.now(timezone.utc)}
    await db.meal_plans.insert_one(plan_doc)
    return {"message": "Meal plan created", "plan_id": plan_doc["id"]}


@router.get("/meal-plans")
async def get_meal_plans(start_date: Optional[str] = None, end_date: Optional[str] = None, user: User = Depends(require_user)):
    if not start_date: start_date = datetime.now(timezone.utc).strftime("%Y-%m-%d")
    if not end_date: end_date = (datetime.now(timezone.utc) + timedelta(days=7)).strftime("%Y-%m-%d")
    plans = await db.meal_plans.find({"user_id": user.user_id, "date": {"$gte": start_date, "$lte": end_date}}, {"_id": 0}).sort("date", 1).to_list(100)
    by_date = {}
    for plan in plans:
        date = plan["date"]
        if date not in by_date: by_date[date] = []
        by_date[date].append(plan)
    return {"meal_plans": by_date, "start_date": start_date, "end_date": end_date}


@router.delete("/meal-plans/{plan_id}")
async def delete_meal_plan(plan_id: str, user: User = Depends(require_user)):
    await db.meal_plans.delete_one({"id": plan_id, "user_id": user.user_id})
    return {"message": "Meal plan deleted"}


@router.post("/meal-plans/{plan_id}/log")
async def log_meal_from_plan(plan_id: str, user: User = Depends(require_user)):
    plan = await db.meal_plans.find_one({"id": plan_id, "user_id": user.user_id})
    if not plan:
        raise HTTPException(status_code=404, detail="Meal plan not found")
    if plan.get("recipe_id"):
        recipe = await db.recipes.find_one({"id": plan["recipe_id"]})
        if recipe:
            meal_entry = {"id": str(uuid.uuid4()), "user_id": user.user_id, "food_name": recipe["name"], "portion_grams": 100, "meal_type": plan["meal_type"], "cooking_method": "raw", "nutrients": recipe.get("per_serving_nutrients", {}), "elements": recipe.get("per_serving_elements", {}), "allergens": recipe.get("allergens", []), "timestamp": datetime.now(timezone.utc), "date": datetime.now(timezone.utc).strftime("%Y-%m-%d")}
            await db.meals.insert_one(meal_entry)
            await update_daily_summary(user.user_id, meal_entry["date"])
            return {"message": "Meal logged from plan", "meal_id": meal_entry["id"]}
    return {"message": "No recipe associated with this plan"}
