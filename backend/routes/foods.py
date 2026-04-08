from fastapi import APIRouter, Request, HTTPException
import httpx
from config import logger, RETENTION_FACTORS, BIOLOGICAL_EFFECTS, ATOMIC_WEIGHTS
from services import search_usda_foods, get_usda_food_details, extract_nutrients, apply_cooking_retention, calculate_elemental_composition, detect_allergens
from security import limiter

router = APIRouter(tags=["foods"])


@router.post("/foods/search")
@limiter.limit("30/minute")
async def search_foods(request: Request):
    body = await request.json()
    foods = await search_usda_foods(body.get("query", ""), body.get("page_size", 10))
    return {"foods": foods, "query": body.get("query", "")}


@router.post("/foods/analyze")
async def analyze_food(request: Request):
    try:
        body = await request.json()
        fdc_id = body.get("fdc_id")
        food_data = await get_usda_food_details(fdc_id)
        if not food_data:
            raise HTTPException(status_code=404, detail=f"Food not found (FDC ID: {fdc_id}). The USDA database may be temporarily unavailable.")
        raw_nutrients = extract_nutrients(food_data, body.get("portion_grams", 100))
        cooking_method = body.get("cooking_method", "raw")
        cooked_nutrients = apply_cooking_retention(raw_nutrients, cooking_method)
        elements = calculate_elemental_composition(cooked_nutrients)
        food_name = food_data.get("description", "")
        allergens = detect_allergens(food_name, food_data.get("ingredients", ""))
        bio_effects = {el: BIOLOGICAL_EFFECTS[el] for el in elements["mass_grams"] if el in BIOLOGICAL_EFFECTS and elements["mass_grams"][el] > 0}
        method_scores = {m: sum(f.values())/len(f) for m, f in RETENTION_FACTORS.items() if m != "raw"}
        ranked = sorted(method_scores.items(), key=lambda x: x[1], reverse=True)
        return {"fdc_id": fdc_id, "food_name": food_name, "portion_grams": body.get("portion_grams", 100), "cooking_method": cooking_method, "nutrients": {"raw": raw_nutrients, "cooked": cooked_nutrients, "retention_applied": cooking_method != "raw"}, "elements": elements, "allergens": allergens, "biological_effects": bio_effects, "cooking_recommendations": {"recommended_method": ranked[0][0], "method_rankings": [{"method": m, "avg_retention": round(s*100, 1)} for m, s in ranked]}, "data_source": "USDA FoodData Central"}
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Food analyze error: {e}")
        raise HTTPException(status_code=500, detail=f"Failed to analyze food. Error: {str(e)}")


@router.get("/foods/retention-factors")
async def get_retention_factors():
    return {"retention_factors": RETENTION_FACTORS}


@router.get("/foods/barcode/{barcode}")
async def lookup_barcode(barcode: str):
    async with httpx.AsyncClient() as client_http:
        response = await client_http.get(f"https://world.openfoodfacts.org/api/v0/product/{barcode}.json")
        if response.status_code != 200:
            raise HTTPException(status_code=404, detail="Product not found")
        data = response.json()
        if data.get("status") != 1:
            raise HTTPException(status_code=404, detail="Product not found")
        product = data.get("product", {})
        nutriments = product.get("nutriments", {})
        return {"barcode": barcode, "name": product.get("product_name", "Unknown"), "brand": product.get("brands", ""), "image_url": product.get("image_url", ""), "nutrients_per_100g": {"energy_kcal": nutriments.get("energy-kcal_100g", 0), "protein_g": nutriments.get("proteins_100g", 0), "carbohydrate_g": nutriments.get("carbohydrates_100g", 0), "fat_g": nutriments.get("fat_100g", 0), "fiber_g": nutriments.get("fiber_100g", 0), "sodium_mg": nutriments.get("sodium_100g", 0) * 1000 if nutriments.get("sodium_100g") else 0}, "allergens": product.get("allergens_tags", []), "ingredients": product.get("ingredients_text", "")}


@router.get("/elements/info")
async def get_elements_info():
    return {"elements": ATOMIC_WEIGHTS, "biological_effects": BIOLOGICAL_EFFECTS}


@router.get("/recommended-values")
async def get_recommended_values():
    from config import DAILY_RECOMMENDED
    return {"daily_recommended": DAILY_RECOMMENDED}
