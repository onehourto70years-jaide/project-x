# ElementEats - Food Elemental Composition & Nutrient Analyzer

## Original Problem Statement
Build an app that takes any food or recipe, breaks it down to elemental (periodic) composition, maps vitamins/minerals/protein, flags allergens, and recommends the cooking method/temperature that best preserves nutrients.

## Architecture
- **Frontend**: React 19 + Tailwind CSS + shadcn/ui
- **Backend**: FastAPI + MongoDB
- **External APIs**: USDA FoodData Central, Open Food Facts
- **Authentication**: Emergent Google OAuth

## User Personas
1. **Health-conscious individuals** - Track nutrient intake at molecular level
2. **Nutritionists** - Analyze recipes for clients
3. **Food scientists** - Research elemental composition
4. **Allergy sufferers** - Detect allergens in foods

## Core Requirements (Static)
1. Recipe/ingredient input with USDA database search
2. Barcode scanning via Open Food Facts API
3. Elemental breakdown (C, H, O, N, S + minerals)
4. Allergen detection (FDA top 9 + EU additions)
5. Safe cooking temperature recommendations
6. Nutrient retention factors by cooking method
7. User authentication for saving recipes

## What's Been Implemented (Jan 2026)
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

## Prioritized Backlog

### P0 (Critical)
- All core features implemented ✓

### P1 (High Value)
- Recipe sharing functionality
- Meal planning with weekly nutrient targets
- Custom allergen profile per user
- Export analysis as PDF

### P2 (Nice to Have)
- AI-powered recipe suggestions based on nutritional goals
- Integration with fitness tracking apps
- Barcode camera scanning (currently manual entry)
- Historical analysis tracking over time

## Next Tasks
1. Add recipe sharing with unique URLs
2. Implement user allergen profile settings
3. Add PDF export for analysis results
4. Create meal planning feature
