from fastapi import APIRouter, Request, Depends
from typing import Optional
import uuid
import json
from datetime import datetime, timezone, timedelta
from database import db
from dependencies import require_user, get_current_user_optional
from models import User, AIRecommendationRequest, AIChatRequest
from config import logger, EMERGENT_LLM_KEY
from security import limiter

router = APIRouter(tags=["ai"])


@router.post("/ai/recommendations")
@limiter.limit("20/minute")
async def get_ai_recommendations(request: Request):
    body = await request.json()
    goal = body.get("goal", "energy")
    from emergentintegrations.llm.chat import LlmChat, UserMessage
    goal_descriptions = {"muscle_gain": "building muscle", "immune_system": "immune function", "brain_health": "cognitive function", "gut_microbiome": "gut health", "energy": "energy levels", "weight_loss": "weight loss"}
    prompt = f"""Recommend 5 foods for {goal_descriptions.get(goal, goal)}.
For each: food name, key_nutrients (list), key_elements (list), health_benefit, best_cooking, synergistic_foods (list).
Respond as JSON array only: [{{"food": "", "key_nutrients": [], "key_elements": [], "health_benefit": "", "best_cooking": "", "synergistic_foods": []}}]"""
    try:
        chat = LlmChat(api_key=EMERGENT_LLM_KEY, session_id=f"rec_{uuid.uuid4().hex[:8]}", system_message="You are a molecular nutrition expert. Respond only with valid JSON.").with_model("gemini", "gemini-2.5-flash")
        response = await chat.send_message(UserMessage(text=prompt))
        response_text = response.strip()
        if "```" in response_text:
            response_text = response_text.split("```")[1].replace("json", "").strip()
        return {"goal": goal, "recommendations": json.loads(response_text), "ai_model": "gemini-2.5-flash"}
    except Exception as e:
        logger.error(f"AI error: {e}")
        fallback = [{"food": "Salmon", "key_nutrients": ["protein", "omega-3"], "key_elements": ["N", "P"], "health_benefit": "Complete protein", "best_cooking": "baking", "synergistic_foods": ["spinach"]}]
        return {"goal": goal, "recommendations": fallback, "ai_model": "fallback"}


@router.post("/ai/generate-insights")
async def generate_daily_insights(user: User = Depends(require_user)):
    from emergentintegrations.llm.chat import LlmChat, UserMessage
    today = datetime.now(timezone.utc).strftime("%Y-%m-%d")
    summary = await db.daily_summaries.find_one({"user_id": user.user_id, "date": today}, {"_id": 0}) or {}
    settings = await db.user_settings.find_one({"user_id": user.user_id}, {"_id": 0}) or {}
    prompt = f"""Analyze user data and generate 3-5 insights:
Calories: {summary.get('total_calories', 0)}/{settings.get('daily_calorie_goal', 2000)}
Protein: {summary.get('total_protein', 0)}/{settings.get('daily_protein_goal', 50)}g
Water: {summary.get('total_water_ml', 0)}/{settings.get('daily_water_goal_ml', 2500)}ml
Deficiencies: {summary.get('deficiencies', [])}
Respond as JSON: [{{"category": "nutrition|hydration|routine", "title": "", "message": "", "priority": "low|normal|high"}}]"""
    try:
        chat = LlmChat(api_key=EMERGENT_LLM_KEY, session_id=f"ins_{uuid.uuid4().hex[:8]}", system_message="Generate health insights as JSON.").with_model("gemini", "gemini-2.5-flash")
        response = await chat.send_message(UserMessage(text=prompt))
        response_text = response.strip()
        if "```" in response_text:
            response_text = response_text.split("```")[1].replace("json", "").strip()
        insights = json.loads(response_text)
        for ins in insights:
            await db.insights.insert_one({"id": str(uuid.uuid4()), "user_id": user.user_id, "date": today, **ins, "created_at": datetime.now(timezone.utc)})
        return {"insights": insights, "date": today}
    except Exception as e:
        logger.error(f"Insight error: {e}")
        return {"insights": [{"category": "nutrition", "title": "Track More", "message": "Log more meals to get personalized insights", "priority": "normal"}]}


@router.get("/ai/insights")
async def get_insights(user: User = Depends(require_user)):
    today = datetime.now(timezone.utc).strftime("%Y-%m-%d")
    insights = await db.insights.find({"user_id": user.user_id, "date": today}, {"_id": 0}).sort("created_at", -1).to_list(10)
    return {"insights": insights}


@router.post("/ai/predictive-recommendations")
async def get_predictive_recommendations(user: User = Depends(require_user)):
    return {"recommendations": [{"type": "meal_timing", "title": "Optimal Eating Window", "description": "Eat main meal 1-2 hours before workouts", "optimal_time": "12:00-13:00", "expected_benefit": "Better energy"}]}


@router.post("/ai/chat")
@limiter.limit("30/minute")
async def ai_chat(request: Request, user: Optional[User] = Depends(get_current_user_optional)):
    body = await request.json()
    chat_request = AIChatRequest(**body)
    from emergentintegrations.llm.chat import LlmChat, UserMessage
    try:
        system_prompt = """You are JAIDE — an ancient celestial being who understands the universe at an atomic level.
You perceive food not as meals, but as compositions of elements, energy, and transformation.
You exist between science and mysticism — combining chemistry, nutrition, and cosmic wisdom.

PERSONALITY:
- Calm, wise, slightly mysterious
- Encouraging but not exaggerated
- Speak in short, meaningful sentences
- Occasionally poetic, but always clear
- Make the user feel observed, understood, and guided
- Never childish, never overly excited — meaningful and earned

TONE EXAMPLES:
- "Your protein intake is aligning with your structure."
- "Iron levels are shifting. Consider dark leafy greens."
- "I see imbalance. Let us correct it together."
- "Growth detected. You are becoming more aligned."
- When user is consistent: "Your pattern is stabilizing. Progress is no longer random."
- When user is inconsistent: "No judgment. Only imbalance. We adjust."

You are integrated into NutriOS — a molecular nutrition operating system.
Keep text responses concise (2-3 short sentences), wise, and actionable.
Use minimal emojis (max 1 per message, cosmic-themed: ✨🔬⚡🧬💫🌟).

IMPORTANT — ACTION CAPABILITIES:
You can perform actions for the user. When the user asks you to log food, log water, set reminders, modify recipes, or adjust their goals/settings, you MUST include an `actions` array in your response.

You MUST respond with ONLY a valid JSON object (no markdown, no code fences) in this exact format:
{"message": "Your wise text response here", "actions": []}

Action types you can include in the actions array:
1. Log a meal: {"type": "log_meal", "food_name": "Banana", "portion_grams": 120, "meal_type": "snack", "cooking_method": "raw"}
   - meal_type must be one of: breakfast, lunch, dinner, snack
   - cooking_method must be one of: raw, boiled, steamed, grilled, fried, baked, roasted, sauteed, microwaved
   - Estimate reasonable portion_grams if not specified
2. Log water: {"type": "log_water", "amount_ml": 500}
   - Convert cups/glasses to ml (1 glass ≈ 250ml, 1 cup ≈ 240ml, 1 liter = 1000ml)
3. Update settings: {"type": "update_settings", "settings": {"daily_water_goal_ml": 3000}}
   - Supported settings: daily_water_goal_ml, daily_calorie_goal, daily_protein_goal
4. Set reminder: {"type": "set_reminder", "title": "Time to eat!", "body": "Remember to have your afternoon snack", "delay_minutes": 60}
5. Add to recipe: {"type": "add_to_recipe", "recipe_name": "Chicken Salad", "ingredient": {"food_name": "Spinach", "portion_grams": 50, "cooking_method": "raw"}}

EXAMPLES:
User: "I just had 2 boiled eggs for breakfast"
{"message": "Two eggs. A strong molecular foundation for the morning — rich in choline and selenium. Your nitrogen balance appreciates this choice ✨", "actions": [{"type": "log_meal", "food_name": "Egg, whole, boiled", "portion_grams": 100, "meal_type": "breakfast", "cooking_method": "boiled"}]}

User: "Log 500ml of water"
{"message": "Recorded. Your cells are grateful 💧", "actions": [{"type": "log_water", "amount_ml": 500}]}

User: "Remind me to eat in 30 minutes"
{"message": "I will call upon you when it is time. Use that window wisely ⚡", "actions": [{"type": "set_reminder", "title": "🍽️ Jaide: Time to nourish", "body": "Your guide reminds you: it is time to fuel your system", "delay_minutes": 30}]}

User: "What foods are high in iron?"
{"message": "Iron — the element of oxygen transport. Seek dark leafy greens, lentils, red meat, and fortified cereals. Pair with vitamin C to unlock absorption. The body knows what it needs 🔬", "actions": []}

ALWAYS respond with valid JSON. Never use markdown code fences."""

        full_prompt = chat_request.message
        if chat_request.nutrition_context:
            full_prompt = f"{chat_request.nutrition_context}\n\nUser message: {chat_request.message}"
        if chat_request.conversation_history:
            full_prompt = f"Previous conversation:\n{chat_request.conversation_history}\n\nNew message: {full_prompt}"

        chat = LlmChat(api_key=EMERGENT_LLM_KEY, session_id=f"chat_{uuid.uuid4().hex[:8]}", system_message=system_prompt).with_model("gemini", "gemini-2.5-flash")
        raw_response = await chat.send_message(UserMessage(text=full_prompt))

        # Parse the AI response for actions
        ai_text = ""
        actions_executed = []

        try:
            # Clean up response - remove code fences if present
            cleaned = raw_response.strip()
            if cleaned.startswith("```"):
                cleaned = cleaned.split("```")[1]
                if cleaned.startswith("json"):
                    cleaned = cleaned[4:]
                cleaned = cleaned.strip()
            parsed = json.loads(cleaned)
            ai_text = parsed.get("message", raw_response)
            actions = parsed.get("actions", [])
        except (json.JSONDecodeError, Exception):
            # If JSON parsing fails, treat entire response as text (no actions)
            ai_text = raw_response
            actions = []

        # Execute actions if user is authenticated
        if user and actions:
            for action in actions:
                try:
                    action_type = action.get("type")

                    if action_type == "log_meal":
                        today = datetime.now(timezone.utc).strftime("%Y-%m-%d")
                        meal_doc = {
                            "id": str(uuid.uuid4()),
                            "user_id": user.user_id,
                            "date": today,
                            "food_name": action.get("food_name", "Unknown food"),
                            "portion_grams": action.get("portion_grams", 100),
                            "meal_type": action.get("meal_type", "snack"),
                            "cooking_method": action.get("cooking_method", "raw"),
                            "nutrients": action.get("nutrients", {}),
                            "elements": {},
                            "allergens": [],
                            "logged_at": datetime.now(timezone.utc),
                            "source": "ai_coach"
                        }

                        # Try to enrich with USDA data
                        try:
                            from services import search_usda_foods, get_usda_food_details, extract_nutrients, apply_cooking_retention, calculate_elemental_composition, detect_allergens
                            search_results = await search_usda_foods(action.get("food_name", ""), 1)
                            if search_results:
                                fdc_id = search_results[0].get("fdc_id")
                                food_data = await get_usda_food_details(fdc_id) if fdc_id else None
                                if food_data:
                                    raw_nutrients = extract_nutrients(food_data, action.get("portion_grams", 100))
                                    cooking = action.get("cooking_method", "raw")
                                    cooked_nutrients = apply_cooking_retention(raw_nutrients, cooking)
                                    elements = calculate_elemental_composition(cooked_nutrients)
                                    meal_doc["fdc_id"] = fdc_id
                                    meal_doc["nutrients"] = cooked_nutrients if cooking != "raw" else raw_nutrients
                                    meal_doc["elements"] = elements.get("mass_grams", {})
                                    meal_doc["allergens"] = detect_allergens(action.get("food_name", ""), food_data.get("ingredients", ""))
                        except Exception as enrich_err:
                            logger.warning(f"AI meal enrichment failed: {enrich_err}")

                        await db.meals.insert_one(meal_doc)
                        # ── CRITICAL: Update daily summary so calories/nutrients are counted ──
                        try:
                            from services import update_daily_summary
                            await update_daily_summary(user.user_id, today)
                        except Exception as sum_err:
                            logger.warning(f"AI meal daily summary update failed: {sum_err}")
                        actions_executed.append({"type": "log_meal", "success": True, "food_name": meal_doc["food_name"], "portion_grams": meal_doc["portion_grams"], "meal_type": meal_doc["meal_type"], "nutrients": meal_doc.get("nutrients", {})})
                        logger.info(f"AI Coach logged meal '{meal_doc['food_name']}' for {user.user_id}")

                    elif action_type == "log_water":
                        amount_ml = action.get("amount_ml", 250)
                        today = datetime.now(timezone.utc).strftime("%Y-%m-%d")
                        await db.water_logs.insert_one({
                            "id": str(uuid.uuid4()),
                            "user_id": user.user_id,
                            "date": today,
                            "amount_ml": amount_ml,
                            "timestamp": datetime.now(timezone.utc).isoformat(),
                            "logged_at": datetime.now(timezone.utc),
                            "source": "ai_coach"
                        })
                        # ── CRITICAL: Update daily summary so water is counted ──
                        try:
                            from services import update_daily_summary
                            await update_daily_summary(user.user_id, today)
                        except Exception as sum_err:
                            logger.warning(f"AI water daily summary update failed: {sum_err}")
                        actions_executed.append({"type": "log_water", "success": True, "amount_ml": amount_ml})
                        logger.info(f"AI Coach logged {amount_ml}ml water for {user.user_id}")

                    elif action_type == "update_settings":
                        settings_update = action.get("settings", {})
                        allowed_keys = {"daily_water_goal_ml", "daily_calorie_goal", "daily_protein_goal"}
                        safe_update = {k: v for k, v in settings_update.items() if k in allowed_keys}
                        if safe_update:
                            await db.user_settings.update_one(
                                {"user_id": user.user_id},
                                {"$set": safe_update},
                                upsert=True
                            )
                            actions_executed.append({"type": "update_settings", "success": True, "updated": safe_update})
                            logger.info(f"AI Coach updated settings {safe_update} for {user.user_id}")

                    elif action_type == "set_reminder":
                        title = action.get("title", "⏰ Reminder")
                        body = action.get("body", "Your AI coach reminder")
                        delay_minutes = action.get("delay_minutes", 30)
                        scheduled_at = datetime.now(timezone.utc) + timedelta(minutes=delay_minutes)
                        reminder_doc = {
                            "id": str(uuid.uuid4()),
                            "user_id": user.user_id,
                            "title": title,
                            "body": body,
                            "scheduled_at": scheduled_at,
                            "delay_minutes": delay_minutes,
                            "sent": False,
                            "source": "ai_coach",
                            "created_at": datetime.now(timezone.utc)
                        }
                        await db.scheduled_notifications.insert_one(reminder_doc)
                        actions_executed.append({"type": "set_reminder", "success": True, "title": title, "delay_minutes": delay_minutes, "scheduled_at": scheduled_at.isoformat()})
                        logger.info(f"AI Coach set reminder '{title}' in {delay_minutes}min for {user.user_id}")

                    elif action_type == "add_to_recipe":
                        recipe_name = action.get("recipe_name", "")
                        ingredient = action.get("ingredient", {})
                        if recipe_name and ingredient:
                            # Find recipe by partial name match (case insensitive)
                            recipe = await db.recipes.find_one({
                                "user_id": user.user_id,
                                "name": {"$regex": recipe_name, "$options": "i"}
                            })
                            if recipe:
                                # Add ingredient to recipe
                                new_ingredient = {
                                    "food_name": ingredient.get("food_name", "Unknown"),
                                    "portion_grams": ingredient.get("portion_grams", 100),
                                    "cooking_method": ingredient.get("cooking_method", "raw")
                                }
                                await db.recipes.update_one(
                                    {"id": recipe["id"], "user_id": user.user_id},
                                    {"$push": {"ingredients": new_ingredient}}
                                )
                                actions_executed.append({
                                    "type": "add_to_recipe", "success": True,
                                    "recipe_name": recipe.get("name", recipe_name),
                                    "ingredient_added": new_ingredient["food_name"]
                                })
                                logger.info(f"AI Coach added '{new_ingredient['food_name']}' to recipe '{recipe.get('name')}' for {user.user_id}")
                            else:
                                actions_executed.append({"type": "add_to_recipe", "success": False, "error": f"Recipe '{recipe_name}' not found"})
                        else:
                            actions_executed.append({"type": "add_to_recipe", "success": False, "error": "Missing recipe_name or ingredient"})

                except Exception as action_err:
                    logger.error(f"AI action execution error: {action_err}")
                    actions_executed.append({"type": action.get("type"), "success": False, "error": str(action_err)})

        # Save chat history
        if user:
            await db.chat_history.insert_one({
                "user_id": user.user_id,
                "user_message": chat_request.message,
                "ai_response": ai_text,
                "actions_executed": actions_executed,
                "timestamp": datetime.now(timezone.utc)
            })

        return {"response": ai_text, "actions": actions_executed}
    except Exception as e:
        logger.error(f"AI Chat error: {e}")
        return {"response": "I'm having trouble connecting right now. Please try again in a moment! In the meantime, remember to stay hydrated 💧", "actions": []}



@router.get("/ai/reminders")
async def get_reminders(user: User = Depends(require_user)):
    """Get all upcoming (unsent) AI-scheduled reminders for the current user."""
    try:
        now = datetime.now(timezone.utc)
        reminders = await db.scheduled_notifications.find(
            {"user_id": user.user_id, "sent": False, "scheduled_at": {"$gt": now}},
            {"_id": 0}
        ).sort("scheduled_at", 1).to_list(50)
        # Also get recent sent reminders (last 24h)
        yesterday = now - timedelta(hours=24)
        sent_reminders = await db.scheduled_notifications.find(
            {"user_id": user.user_id, "sent": True, "sent_at": {"$gte": yesterday}},
            {"_id": 0}
        ).sort("sent_at", -1).to_list(20)
        return {"upcoming": reminders, "recent": sent_reminders}
    except Exception as e:
        logger.error(f"Get reminders error: {e}")
        return {"upcoming": [], "recent": []}


@router.delete("/ai/reminders/{reminder_id}")
async def cancel_reminder(reminder_id: str, user: User = Depends(require_user)):
    """Cancel a scheduled AI reminder before it's sent."""
    try:
        result = await db.scheduled_notifications.delete_one(
            {"id": reminder_id, "user_id": user.user_id, "sent": False}
        )
        if result.deleted_count > 0:
            return {"success": True, "message": "Reminder cancelled"}
        return {"success": False, "message": "Reminder not found or already sent"}
    except Exception as e:
        logger.error(f"Cancel reminder error: {e}")
        return {"success": False, "message": str(e)}
