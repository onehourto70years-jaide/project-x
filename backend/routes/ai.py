from fastapi import APIRouter, Request, Depends
from typing import Optional
import uuid
import json
from datetime import datetime, timezone
from database import db
from dependencies import require_user, get_current_user_optional
from models import User, AIRecommendationRequest, AIChatRequest
from config import logger, EMERGENT_LLM_KEY

router = APIRouter(tags=["ai"])


@router.post("/ai/recommendations")
async def get_ai_recommendations(request: AIRecommendationRequest):
    from emergentintegrations.llm.chat import LlmChat, UserMessage
    goal_descriptions = {"muscle_gain": "building muscle", "immune_system": "immune function", "brain_health": "cognitive function", "gut_microbiome": "gut health", "energy": "energy levels", "weight_loss": "weight loss"}
    prompt = f"""Recommend 5 foods for {goal_descriptions.get(request.goal, request.goal)}.
For each: food name, key_nutrients (list), key_elements (list), health_benefit, best_cooking, synergistic_foods (list).
Respond as JSON array only: [{{"food": "", "key_nutrients": [], "key_elements": [], "health_benefit": "", "best_cooking": "", "synergistic_foods": []}}]"""
    try:
        chat = LlmChat(api_key=EMERGENT_LLM_KEY, session_id=f"rec_{uuid.uuid4().hex[:8]}", system_message="You are a molecular nutrition expert. Respond only with valid JSON.").with_model("gemini", "gemini-3-flash-preview")
        response = await chat.send_message(UserMessage(text=prompt))
        response_text = response.strip()
        if "```" in response_text:
            response_text = response_text.split("```")[1].replace("json", "").strip()
        return {"goal": request.goal, "recommendations": json.loads(response_text), "ai_model": "gemini-3-flash-preview"}
    except Exception as e:
        logger.error(f"AI error: {e}")
        fallback = [{"food": "Salmon", "key_nutrients": ["protein", "omega-3"], "key_elements": ["N", "P"], "health_benefit": "Complete protein", "best_cooking": "baking", "synergistic_foods": ["spinach"]}]
        return {"goal": request.goal, "recommendations": fallback, "ai_model": "fallback"}


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
        chat = LlmChat(api_key=EMERGENT_LLM_KEY, session_id=f"ins_{uuid.uuid4().hex[:8]}", system_message="Generate health insights as JSON.").with_model("gemini", "gemini-3-flash-preview")
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
async def ai_chat(request: AIChatRequest, user: Optional[User] = Depends(get_current_user_optional)):
    from emergentintegrations.llm.chat import LlmChat, UserMessage
    try:
        system_prompt = """You are NutriOS Coach \u2014 a friendly, expert AI nutrition advisor integrated into a molecular nutrition app. 
You specialize in:
- Food recommendations based on elemental composition (C, H, O, N, S and minerals)
- Nutrient synergies and food combinations
- Cooking method optimization for nutrient retention
- Personalized advice based on user's current intake data
Keep responses concise (2-4 paragraphs max), warm, and actionable. Use occasional emojis.
When relevant, mention specific elements (Carbon, Nitrogen, etc.) and how they relate to health.
If the user shares their nutrition context, reference their actual numbers."""
        full_prompt = request.message
        if request.nutrition_context:
            full_prompt = f"{request.nutrition_context}\n\nUser question: {request.message}"
        if request.conversation_history:
            full_prompt = f"Previous conversation:\n{request.conversation_history}\n\nNew message: {full_prompt}"
        chat = LlmChat(api_key=EMERGENT_LLM_KEY, session_id=f"chat_{uuid.uuid4().hex[:8]}", system_message=system_prompt).with_model("gemini", "gemini-3-flash-preview")
        response = await chat.send_message(UserMessage(text=full_prompt))
        if user:
            await db.chat_history.insert_one({"user_id": user.user_id, "user_message": request.message, "ai_response": response, "timestamp": datetime.now(timezone.utc)})
        return {"response": response}
    except Exception as e:
        logger.error(f"AI Chat error: {e}")
        return {"response": "I'm having trouble connecting right now. Please try again in a moment! In the meantime, remember to stay hydrated \U0001f4a7"}
