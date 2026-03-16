# ElementEats - PRD

## Original Problem Statement
Build an application to analyze food and recipes for their elemental composition, nutrients, and allergens, and recommend optimal cooking methods. Expanded with:
1. A comprehensive health & fitness tracking system (calories, macros, water, workouts, weight, progress)
2. A cross-platform routine scheduling & tracking application with routine builder, real-time tracking, visual timeline, analytics, streak tracking, and templates

## User Personas
- Health-conscious individuals tracking daily nutrition and fitness
- Users wanting to understand food at a molecular/elemental level
- People building daily routines and habits with accountability

## Core Requirements
- Food search via USDA FoodData Central & Open Food Facts APIs
- Elemental composition calculation from macronutrients
- Allergen detection, safe cooking temperatures, nutrient retention analysis
- Daily calorie, macro, water, workout, weight, and step tracking
- Routine builder with templates, real-time tracking, analytics, and streaks
- Google OAuth authentication via Emergent Auth

## Tech Stack
- **Backend:** Python FastAPI, MongoDB (motor async driver)
- **Frontend:** React, Tailwind CSS, Shadcn UI
- **Auth:** Emergent-managed Google OAuth2
- **External APIs:** USDA FoodData Central, Open Food Facts

---

## What's Been Implemented

### Phase 1: Food Analysis & Logging ✅
- USDA FoodData Central integration for food search
- Open Food Facts barcode scanning
- Elemental composition (C, H, O, N, S) calculation from macronutrients
- Allergen detection (FDA top 9 + EU)
- Safe cooking temperature guidelines
- Nutrient retention factors by cooking method
- Recipe creation and analysis
- Food logging by meal type (breakfast, lunch, dinner, snack)

### Phase 2: Health & Fitness Tracker ✅
- Daily dashboard with calories, macros, water, workouts, steps
- Food log with meal categorization
- Water intake tracking
- Workout logging (cardio, strength, flexibility, sports, walking)
- Weight tracking with trends
- Step counting (manual + sync-ready)
- Progress charts (7/14/30 day views)
- Goal setting and tracking
- Meal planning (weekly)

### Phase 3: Routine Scheduling & Tracking ✅ (2026-03-16)
- Routine CRUD (create, read, update, delete)
- Activity management within routines (add, edit, delete)
- 10 activity categories (work, health, personal, sleep, focus, break, exercise, meal, learning, social)
- 3 pre-built templates (Productivity Master, Fitness Focus, Student Schedule)
- Real-time today status (current activity, next up, progress)
- Activity logging (start, complete, skip)
- Focus mode (Pomodoro-style timer)
- Reminder settings per routine
- Analytics dashboard with daily adherence chart
- Streak tracking (current + longest)
- Route ordering fix for FastAPI static vs parameterized paths
- Full RoutineAnalytics page with summary cards, bar chart, breakdown, daily detail table

### Authentication ✅
- Emergent-managed Google OAuth2
- Session-based auth with cookies
- Protected routes on frontend

---

## Prioritized Backlog

### P1 - Next Up
- Real-time activity reminders (browser push notifications)
- Fitness API integrations (Google Fit, Apple Health, Fitbit, Samsung Health) — deferred by user

### P2 - Future
- Google Calendar integration (deferred by user)
- Wear OS companion app
- AI-powered routine optimization
- Voice commands
- Backend refactoring: split monolithic server.py into routers (food.py, health.py, routines.py)

---

## Key API Endpoints

### Auth
- POST /api/auth/session, GET /api/auth/me, POST /api/auth/logout

### Food
- POST /api/foods/search, GET /api/foods/{fdc_id}, POST /api/foods/barcode
- POST /api/analyze, GET/POST/DELETE /api/recipes

### Health
- GET/PUT /api/goals
- GET/POST/DELETE /api/food-log
- GET/POST /api/water-log, POST /api/water-log/quick
- GET/POST/DELETE /api/workouts
- GET/POST /api/weight, GET/POST /api/steps
- GET /api/dashboard, GET /api/progress
- GET/POST/DELETE /api/meal-plan

### Routines
- GET /api/routines/templates, POST /api/routines/templates/{id}/apply
- GET /api/routines/analytics, GET /api/routines/streak
- GET/POST /api/routines, GET/PUT/DELETE /api/routines/{id}
- POST /api/routines/{id}/activities, DELETE /api/routines/{id}/activities/{id}
- GET /api/routines/today/status
- POST /api/routines/activities/{id}/start|complete|skip
- POST /api/routines/focus/start|end, GET /api/routines/focus/status
- GET/PUT /api/routines/{id}/reminders

### Reference
- GET /api/reference/cooking-methods, safe-temperatures, allergens, elements, workout-types, activity-categories
