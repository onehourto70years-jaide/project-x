"""
NutriOS AI Photo Meal Analysis Route
Accepts a base64-encoded food photo and uses Gemini Vision to identify foods and nutrients.
"""
from fastapi import APIRouter, Request, Depends, HTTPException
from typing import Optional
import uuid
import json
import base64
import tempfile
import os
from datetime import datetime, timezone
from database import db
from dependencies import require_user
from models import User
from config import logger, EMERGENT_LLM_KEY
from security import limiter

router = APIRouter(tags=["ai-photo"])


@router.post("/ai/analyze-photo")
@limiter.limit("10/minute")
async def analyze_food_photo(request: Request, user: User = Depends(require_user)):
    """Analyze a food photo using Gemini Vision and return identified foods with nutrients."""
    body = await request.json()
    image_base64 = body.get("image_base64")
    mime_type = body.get("mime_type", "image/jpeg")
    meal_type = body.get("meal_type", "snack")
    language = body.get("language", "en")

    if not image_base64:
        raise HTTPException(status_code=400, detail="image_base64 is required")

    # Validate image data
    try:
        decoded = base64.b64decode(image_base64)
        if len(decoded) < 1000:
            raise HTTPException(status_code=400, detail="Image too small or invalid")
        if len(decoded) > 10_000_000:
            raise HTTPException(status_code=400, detail="Image too large (max 10MB)")
    except Exception as e:
        raise HTTPException(status_code=400, detail=f"Invalid base64 image: {str(e)}")

    # Write temp file for Gemini
    suffix = ".jpg" if "jpeg" in mime_type else ".png" if "png" in mime_type else ".webp"
    tmp_file = tempfile.NamedTemporaryFile(delete=False, suffix=suffix)
    try:
        tmp_file.write(decoded)
        tmp_file.close()

        from emergentintegrations.llm.chat import LlmChat, UserMessage, FileContentWithMimeType

        lang_instructions = {
            "it": "Rispondi in italiano.",
            "es": "Responde en español.",
            "fr": "Réponds en français.",
            "en": "Respond in English."
        }
        lang_note = lang_instructions.get(language, "Respond in English.")

        system_prompt = f"""You are NutriOS Photo Analyzer — an expert AI food recognition system.
Analyze the food photo and identify ALL visible food items with nutritional estimates.
{lang_note}

You MUST respond with ONLY valid JSON (no markdown, no code fences) in this exact format:
{{
  "foods": [
    {{
      "food_name": "name of the food item",
      "portion_grams": estimated weight in grams,
      "confidence": 0.0 to 1.0 confidence score,
      "nutrients": {{
        "energy_kcal": estimated calories,
        "protein_g": estimated protein in grams,
        "carbohydrate_g": estimated carbs in grams,
        "fat_g": estimated fat in grams,
        "fiber_g": estimated fiber in grams
      }},
      "cooking_method": "raw|boiled|steamed|grilled|fried|baked|roasted|sauteed"
    }}
  ],
  "meal_description": "Brief description of the overall meal",
  "total_calories": total estimated calories for the entire plate,
  "health_score": 1-10 rating of meal healthiness,
  "suggestions": "One brief nutritional suggestion"
}}

Be precise with portion estimates. A standard dinner plate holds ~400-600g of food.
Common portions: rice/pasta serving = 150-200g, chicken breast = 150-180g, salad = 100-150g, bread slice = 30g."""

        chat = LlmChat(
            api_key=EMERGENT_LLM_KEY,
            session_id=f"photo_{uuid.uuid4().hex[:8]}",
            system_message=system_prompt
        ).with_model("gemini", "gemini-2.5-flash")

        image_content = FileContentWithMimeType(
            file_path=tmp_file.name,
            mime_type=mime_type
        )

        user_message = UserMessage(
            text="Identify all food items in this photo with nutritional estimates. Be specific about portions.",
            file_contents=[image_content]
        )

        raw_response = await chat.send_message(user_message)

        # Parse the response
        cleaned = raw_response.strip()
        if cleaned.startswith("```"):
            cleaned = cleaned.split("```")[1]
            if cleaned.startswith("json"):
                cleaned = cleaned[4:]
            cleaned = cleaned.strip()

        result = json.loads(cleaned)

        # Validate structure
        if "foods" not in result:
            result = {"foods": [], "meal_description": "Unable to identify foods", "total_calories": 0, "health_score": 5, "suggestions": "Try a clearer photo"}

        # Store analysis in DB
        analysis_doc = {
            "id": str(uuid.uuid4()),
            "user_id": user.user_id,
            "timestamp": datetime.now(timezone.utc),
            "meal_type": meal_type,
            "result": result,
            "foods_count": len(result.get("foods", []))
        }
        await db.photo_analyses.insert_one(analysis_doc)

        return {
            "analysis_id": analysis_doc["id"],
            "foods": result.get("foods", []),
            "meal_description": result.get("meal_description", ""),
            "total_calories": result.get("total_calories", 0),
            "health_score": result.get("health_score", 5),
            "suggestions": result.get("suggestions", "")
        }

    except json.JSONDecodeError:
        logger.error(f"Photo analysis JSON parse error: {raw_response[:200]}")
        return {
            "analysis_id": None,
            "foods": [],
            "meal_description": "Could not parse AI response",
            "total_calories": 0,
            "health_score": 5,
            "suggestions": "Please try again with a clearer photo"
        }
    except Exception as e:
        logger.error(f"Photo analysis error: {e}")
        raise HTTPException(status_code=500, detail=f"Photo analysis failed: {str(e)}")
    finally:
        # Clean up temp file
        try:
            os.unlink(tmp_file.name)
        except OSError:
            pass


@router.post("/ai/photo-log-meal")
@limiter.limit("20/minute")
async def log_photo_meal(request: Request, user: User = Depends(require_user)):
    """Log identified foods from a photo analysis as meals."""
    body = await request.json()
    foods = body.get("foods", [])
    meal_type = body.get("meal_type", "snack")
    analysis_id = body.get("analysis_id")

    if not foods:
        raise HTTPException(status_code=400, detail="No foods to log")

    today = datetime.now(timezone.utc).strftime("%Y-%m-%d")
    logged_meals = []

    for food in foods:
        meal_doc = {
            "id": str(uuid.uuid4()),
            "user_id": user.user_id,
            "date": today,
            "food_name": food.get("food_name", "Unknown"),
            "portion_grams": food.get("portion_grams", 100),
            "meal_type": meal_type,
            "cooking_method": food.get("cooking_method", "raw"),
            "nutrients": food.get("nutrients", {}),
            "elements": {},
            "allergens": [],
            "logged_at": datetime.now(timezone.utc),
            "source": "photo_ai",
            "analysis_id": analysis_id
        }

        # Try to enrich with USDA data
        try:
            from services import search_usda_foods, get_usda_food_details, extract_nutrients, apply_cooking_retention, calculate_elemental_composition, detect_allergens
            search_results = await search_usda_foods(food.get("food_name", ""), 1)
            if search_results:
                fdc_id = search_results[0].get("fdc_id")
                food_data = await get_usda_food_details(fdc_id) if fdc_id else None
                if food_data:
                    raw_nutrients = extract_nutrients(food_data, food.get("portion_grams", 100))
                    cooking = food.get("cooking_method", "raw")
                    cooked_nutrients = apply_cooking_retention(raw_nutrients, cooking)
                    elements = calculate_elemental_composition(cooked_nutrients)
                    meal_doc["fdc_id"] = fdc_id
                    meal_doc["nutrients"] = cooked_nutrients if cooking != "raw" else raw_nutrients
                    meal_doc["elements"] = elements.get("mass_grams", {})
                    meal_doc["allergens"] = detect_allergens(food.get("food_name", ""), food_data.get("ingredients", ""))
        except Exception as enrich_err:
            logger.warning(f"Photo meal USDA enrichment failed: {enrich_err}")

        await db.meals.insert_one(meal_doc)
        logged_meals.append({
            "food_name": meal_doc["food_name"],
            "portion_grams": meal_doc["portion_grams"],
            "nutrients": meal_doc["nutrients"]
        })

    # Update daily summary
    try:
        from services import update_daily_summary
        await update_daily_summary(user.user_id, today)
    except Exception as sum_err:
        logger.warning(f"Photo meal daily summary update failed: {sum_err}")

    return {
        "logged_count": len(logged_meals),
        "meals": logged_meals,
        "date": today,
        "message": f"Successfully logged {len(logged_meals)} food(s) from photo"
    }
