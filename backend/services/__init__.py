"""NutriOS Services Package — Re-exports all service functions for backward compatibility."""

# Food analysis
from services.food import (
    search_usda_foods,
    get_usda_food_details,
    extract_nutrients,
    estimate_phytochemicals,
    calculate_elemental_composition,
    apply_cooking_retention,
    detect_allergens,
    calculate_elemental_balance,
    score_food_for_goal,
)

# Email
from services.email import (
    send_cancellation_email,
    send_welcome_email,
    send_account_deletion_email,
    send_subscription_activation_email,
    send_streak_milestone_email,
    send_weekly_summary_email,
    send_weekly_summary_emails,
    check_streak_milestones,
)

# Notifications
from services.notifications import (
    send_expo_push,
    _get_user_lang,
    _log_notification,
    notify_badge_earned,
    send_scheduled_notifications,
    send_ai_coach_reminders,
    send_smart_water_reminders,
    send_smart_meal_reminder,
    send_smart_calorie_check,
    send_smart_routine_reminder,
    send_streak_risk_alerts,
    send_inactivity_reminders,
    send_daily_summary_notification,
    update_daily_summary,
    send_nutrition_tips,
)

__all__ = [
    # Food
    'search_usda_foods', 'get_usda_food_details', 'extract_nutrients',
    'estimate_phytochemicals', 'calculate_elemental_composition',
    'apply_cooking_retention', 'detect_allergens', 'calculate_elemental_balance',
    'score_food_for_goal',
    # Email
    'send_cancellation_email', 'send_welcome_email', 'send_account_deletion_email',
    'send_subscription_activation_email', 'send_streak_milestone_email',
    'send_weekly_summary_email', 'send_weekly_summary_emails', 'check_streak_milestones',
    # Notifications
    'send_expo_push', '_get_user_lang', '_log_notification', 'notify_badge_earned',
    'send_scheduled_notifications', 'send_ai_coach_reminders',
    'send_smart_water_reminders', 'send_smart_meal_reminder',
    'send_smart_calorie_check', 'send_smart_routine_reminder',
    'send_streak_risk_alerts', 'send_inactivity_reminders',
    'send_daily_summary_notification', 'update_daily_summary', 'send_nutrition_tips',
]
