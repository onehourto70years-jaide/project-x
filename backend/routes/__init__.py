"""NutriOS Route Registration."""
from fastapi import APIRouter
from routes.auth import router as auth_router
from routes.user import router as user_router
from routes.payments import router as payments_router
from routes.foods import router as foods_router
from routes.meals import router as meals_router
from routes.recipes import router as recipes_router
from routes.routines import router as routines_router
from routes.progress import router as progress_router
from routes.dashboard import router as dashboard_router
from routes.ai import router as ai_router
from routes.gamification import router as gamification_router
from routes.molecular import router as molecular_router
from routes.notifications import router as notifications_router
from routes.sharing import router as sharing_router
from routes.sequence_optimizer import router as sequence_router
from routes.weight import router as weight_router
from routes.reports import router as reports_router
from routes.micronutrients import router as micronutrients_router
from routes.analytics import router as analytics_router
from routes.photo_ai import router as photo_ai_router
from routes.metabolic import router as metabolic_router


def create_api_router() -> APIRouter:
    api = APIRouter(prefix="/api")
    api.include_router(auth_router)
    api.include_router(user_router)
    api.include_router(payments_router)
    api.include_router(foods_router)
    api.include_router(meals_router)
    api.include_router(recipes_router)
    api.include_router(routines_router)
    api.include_router(progress_router)
    api.include_router(dashboard_router)
    api.include_router(ai_router)
    api.include_router(gamification_router)
    api.include_router(molecular_router)
    api.include_router(notifications_router)
    api.include_router(sharing_router)
    api.include_router(sequence_router)
    api.include_router(weight_router)
    api.include_router(reports_router)
    api.include_router(micronutrients_router)
    api.include_router(analytics_router)
    api.include_router(photo_ai_router)
    api.include_router(metabolic_router)
    return api
