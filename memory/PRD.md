# ElementEats - Food Elemental Composition & Nutrient Analyzer + Health Tracker

## Original Problem Statement
Build an app that takes any food or recipe, breaks it down to elemental (periodic) composition, maps vitamins/minerals/protein, flags allergens, and recommends the cooking method/temperature that best preserves nutrients. Extended with comprehensive health & fitness tracking.

## Architecture
- **Frontend**: React 19 + Tailwind CSS + shadcn/ui + Recharts
- **Backend**: FastAPI + MongoDB
- **External APIs**: USDA FoodData Central, Open Food Facts
- **Authentication**: Emergent Google OAuth

## User Personas
1. **Health-conscious individuals** - Track nutrient intake at molecular level
2. **Nutritionists** - Analyze recipes for clients
3. **Food scientists** - Research elemental composition
4. **Allergy sufferers** - Detect allergens in foods
5. **Fitness enthusiasts** - Track calories, macros, workouts
6. **Weight loss/gain seekers** - Monitor progress with goals
7. **Keto dieters** - Track net carbs

## Core Requirements (Static)
### Food Analysis (v1.0)
1. Recipe/ingredient input with USDA database search
2. Barcode scanning via Open Food Facts API
3. Elemental breakdown (C, H, O, N, S + minerals)
4. Allergen detection (FDA top 9 + EU additions)
5. Safe cooking temperature recommendations
6. Nutrient retention factors by cooking method
7. User authentication for saving recipes

### Health & Fitness Tracking (v2.0)
8. Daily food log with calorie/macro tracking
9. Custom daily goals (calories, protein, carbs, fat, water, steps)
10. Water intake tracker
11. Workout/exercise logging with calories burned
12. Weight tracking with trend analysis
13. Steps tracking
14. Meal planner (weekly planning grid)
15. Progress charts and analytics
16. Net carbs mode for keto dieting

## What's Been Implemented

### v1.0 - Food Analyzer (Jan 2026)
- [x] Landing page with periodic table UI aesthetic
- [x] Google OAuth authentication (Emergent-managed)
- [x] USDA FoodData Central API integration
- [x] Open Food Facts barcode lookup
- [x] Elemental composition calculations from macros
- [x] Allergen detection system
- [x] Safe cooking temperatures (USDA guidelines)
- [x] Nutrient retention factors for 6 cooking methods
- [x] Recipe saving/management
- [x] Dashboard with full analysis display

### v2.0 - Health & Fitness Tracker (Jan 2026)
- [x] Health Dashboard with daily overview
- [x] Food Log with meal tracking (breakfast/lunch/dinner/snack)
- [x] Workout Log with exercise categories
- [x] Progress page with Recharts visualizations
- [x] Goals page with customizable targets
- [x] Net carbs mode toggle for keto
- [x] Meal Planner with weekly grid
- [x] Water tracking with quick-add
- [x] Steps logging
- [x] Weight tracking with trend analysis
- [x] 26+ new API endpoints for health tracking
- [x] Responsive navigation for all health pages

## Fitness App Integration (Ready for Implementation)
- [ ] Google Fit OAuth flow
- [ ] Apple Health data sync (requires iOS app)
- [ ] Samsung Health integration
- [ ] Fitbit API connection

## Prioritized Backlog

### P0 (Critical)
- All core features implemented ✓

### P1 (High Value)
- Google Fit API integration for automatic step/workout sync
- Recipe sharing functionality
- PDF export for analysis results
- Push notifications for goal reminders

### P2 (Nice to Have)
- AI-powered recipe suggestions based on nutritional goals
- Voice logging with OpenAI Whisper
- AI meal scan with GPT-4o Vision
- Social features (friend challenges, sharing)

## Next Tasks
1. Implement Google Fit OAuth flow for automatic data sync
2. Add Fitbit API integration
3. Create recipe sharing with unique URLs
4. Add PDF export for daily/weekly reports
