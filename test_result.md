# Test Result Document

## Testing Protocol
- Backend tests should be run using `deep_testing_backend_v2`
- Frontend tests should be run using `expo_frontend_testing_agent`
- Always update this file before invoking any testing agent
- Never edit the Testing Protocol section

## Application Overview
**App Name:** NutriOS - Personal Health Operating System
**Backend:** FastAPI + MongoDB (Motor async)
**Frontend:** React Native (Expo) with expo-router
**Backend URL:** http://localhost:8001

## Authentication
- Google OAuth via Emergent Auth
- Session tokens stored in cookies and Authorization Bearer header
- Auth flow: POST /api/auth/session with session_id from Emergent Auth
- For testing: Create a test user directly in the database, then create a session token

## Backend API Endpoints to Test

### Auth Endpoints
1. `POST /api/auth/session` - Create session (requires Emergent Auth session_id)
2. `GET /api/auth/me` - Get current user (requires auth)
3. `POST /api/auth/logout` - Logout

### User Settings
4. `GET /api/user/settings` - Get user settings (requires auth)
5. `PUT /api/user/settings` - Update user settings (requires auth)
6. `PUT /api/user/profile` - Update user profile (requires auth)
7. `DELETE /api/user/account` - Delete user account and all data (requires auth)

### Food Search & Analysis
7. `POST /api/foods/search` - Search USDA foods (body: {"query": "chicken", "page_size": 5})
8. `POST /api/foods/analyze` - Analyze food (body: {"fdc_id": 171052, "portion_grams": 100, "cooking_method": "raw"})
9. `GET /api/foods/retention-factors` - Get cooking retention factors
10. `GET /api/foods/barcode/{barcode}` - Lookup food by barcode (uses Open Food Facts)

### Meal Tracking
11. `POST /api/meals` - Add meal entry (requires auth, body: {"food_name": "Chicken breast", "portion_grams": 150, "meal_type": "lunch", "cooking_method": "baking", "nutrients": {"energy_kcal": 250, "protein_g": 40}, "elements": {"C": 20, "H": 3, "O": 8, "N": 6}})
12. `GET /api/meals/today` - Get today's meals (requires auth)
13. `GET /api/meals/history?days=7` - Get meal history (requires auth)
14. `DELETE /api/meals/{meal_id}` - Delete meal (requires auth)

### Water Tracking
15. `POST /api/water` - Add water log (requires auth, body: {"amount_ml": 250})
16. `GET /api/water/today` - Get today's water (requires auth)
17. `GET /api/water/history?days=7` - Get water history (requires auth)
18. `GET /api/water/smart-goal` - Get smart water goal (requires auth)

### Favorites
19. `POST /api/favorites` - Add favorite (requires auth, body: {"fdc_id": 171052, "food_name": "Chicken breast", "default_portion_grams": 100})
20. `GET /api/favorites` - Get favorites (requires auth)
21. `DELETE /api/favorites/{fdc_id}` - Remove favorite (requires auth)

### Recent Foods
22. `GET /api/foods/recent?limit=20` - Get recent foods (requires auth)

### Recipes
23. `POST /api/recipes` - Create recipe (requires auth, body: {"name": "Test Recipe", "description": "A test", "servings": 2, "ingredients": [{"fdc_id": 171052, "food_name": "Chicken", "portion_grams": 200, "cooking_method": "baking"}]})
24. `GET /api/recipes` - Get recipes (requires auth)
25. `GET /api/recipes/{recipe_id}` - Get single recipe (requires auth)
26. `DELETE /api/recipes/{recipe_id}` - Delete recipe (requires auth)

### Meal Planning
27. `POST /api/meal-plans` - Create meal plan (requires auth, body: {"date": "2026-03-24", "meal_type": "lunch", "food_name": "Chicken salad"})
28. `GET /api/meal-plans` - Get meal plans (requires auth)
29. `DELETE /api/meal-plans/{plan_id}` - Delete meal plan (requires auth)

### Routines
30. `POST /api/routines` - Create routine (requires auth, body: {"name": "Morning Routine", "type": "morning", "time_start": "07:00", "time_end": "08:00", "days": ["mon","tue","wed","thu","fri"], "tasks": [{"id": "task1", "name": "Drink water", "completed": false}]})
31. `GET /api/routines` - Get routines (requires auth)
32. `GET /api/routines/today` - Get today's routines (requires auth)
33. `PUT /api/routines/{routine_id}` - Update routine (requires auth)
34. `DELETE /api/routines/{routine_id}` - Delete routine (requires auth)
35. `POST /api/routines/{routine_id}/tasks/{task_id}/complete` - Complete task (requires auth)
36. `GET /api/routines/streak` - Get streak (requires auth)

### Dashboard
37. `GET /api/dashboard` - Get dashboard data (requires auth) - **CRITICAL: was returning 500 previously**

### Progress Charts
38. `GET /api/progress/nutrition?days=7` - Get nutrition progress (requires auth)
39. `GET /api/progress/water?days=7` - Get water progress (requires auth)
40. `GET /api/progress/routines?days=7` - Get routines progress (requires auth)
41. `GET /api/progress/elements?days=7` - Get elements progress (requires auth)

### AI Endpoints
42. `POST /api/ai/recommendations` - Get AI recommendations (body: {"goal": "muscle_gain"})
43. `POST /api/ai/generate-insights` - Generate daily insights (requires auth)
44. `GET /api/ai/insights` - Get insights (requires auth)
45. `POST /api/ai/predictive-recommendations` - Get predictive recommendations (requires auth)

### Utility
46. `GET /api/` - Root health check
47. `GET /api/elements/info` - Get element information
48. `GET /api/recommended-values` - Get daily recommended values

## Test Setup Instructions
1. For authenticated endpoints, create a test user and session directly:
   - Insert user into `users` collection with user_id, email, name, created_at
   - Insert session into `user_sessions` collection with session_token, user_id, expires_at
   - Use the session_token as Bearer token in Authorization header
2. Backend runs on http://localhost:8001
3. All endpoints are prefixed with /api

## Priority Tests
1. **P0**: Dashboard endpoint (GET /api/dashboard) - previously 500 error
2. **P0**: Food search and analysis
3. **P0**: Meal, water, and routine tracking CRUD
4. **P1**: Favorites, recipes, meal plans CRUD
5. **P1**: Progress chart endpoints
6. **P2**: AI endpoints (requires valid Emergent LLM key)

## Test Results
(Will be populated by testing agent)
