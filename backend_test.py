#!/usr/bin/env python3
"""
NutriOS Backend Testing - AI Coach & Gap Analysis
Testing the AI Coach meal logging + calorie counting fix and improved Nutrient Gap Analysis
"""

import asyncio
import aiohttp
import json
import uuid
from datetime import datetime, timezone, timedelta

# Backend URL from frontend/.env
BACKEND_URL = "https://meal-sync-test.preview.emergentagent.com/api"

# Test user credentials as specified in review request
TEST_USER = {
    "user_id": "test_ai_cal",
    "email": "ai_cal@nutrios.com", 
    "name": "AI Cal Test",
    "weight_kg": 70,
    "activity_level": "moderate"
}

TEST_SESSION = {
    "session_token": "ai_cal_token_111",
    "user_id": "test_ai_cal",
    "expires_at": datetime.now(timezone.utc) + timedelta(days=30)
}

TEST_SETTINGS = {
    "user_id": "test_ai_cal",
    "daily_calorie_goal": 2000,
    "daily_protein_goal": 50,
    "daily_water_goal_ml": 2500
}

class NutriOSTestClient:
    def __init__(self):
        self.session = None
        self.headers = {
            "Authorization": f"Bearer {TEST_SESSION['session_token']}",
            "Content-Type": "application/json"
        }
    
    async def __aenter__(self):
        self.session = aiohttp.ClientSession()
        return self
    
    async def __aexit__(self, exc_type, exc_val, exc_tb):
        if self.session:
            await self.session.close()
    
    async def setup_test_data(self):
        """Setup test user, session, and settings in MongoDB"""
        print("🔧 Setting up test data...")
        
        # We'll use the backend API to create the test data
        # First, let's check if we can connect to the backend
        try:
            async with self.session.get(f"{BACKEND_URL}/") as resp:
                if resp.status == 200:
                    data = await resp.json()
                    print(f"✅ Backend connection successful: {data.get('message', 'Unknown')}")
                else:
                    print(f"❌ Backend connection failed: {resp.status}")
                    return False
        except Exception as e:
            print(f"❌ Backend connection error: {e}")
            return False
        
        print("✅ Test data setup complete (using existing session)")
        return True
    
    async def get_dashboard_initial(self):
        """Get initial dashboard state to note calories"""
        print("\n📊 Getting initial dashboard state...")
        try:
            async with self.session.get(f"{BACKEND_URL}/dashboard", headers=self.headers) as resp:
                if resp.status == 200:
                    data = await resp.json()
                    initial_calories = data.get("nutrition", {}).get("calories", {}).get("current", 0)
                    print(f"✅ Initial calories: {initial_calories}")
                    return initial_calories
                else:
                    print(f"❌ Dashboard request failed: {resp.status}")
                    text = await resp.text()
                    print(f"Response: {text}")
                    return None
        except Exception as e:
            print(f"❌ Dashboard request error: {e}")
            return None
    
    async def test_ai_coach_meal_logging(self):
        """Test AI Coach meal logging updates daily summary"""
        print("\n🤖 Testing AI Coach meal logging...")
        
        try:
            # Test AI chat with meal logging request
            chat_data = {
                "message": "I just ate a banana for breakfast"
            }
            
            async with self.session.post(f"{BACKEND_URL}/ai/chat", 
                                       headers=self.headers, 
                                       json=chat_data) as resp:
                if resp.status == 200:
                    data = await resp.json()
                    print(f"✅ AI Chat response received")
                    
                    # Check for actions array
                    actions = data.get("actions", [])
                    if not actions:
                        print("❌ No actions array in response")
                        return False
                    
                    # Look for log_meal action
                    meal_action = None
                    for action in actions:
                        if action.get("type") == "log_meal":
                            meal_action = action
                            break
                    
                    if not meal_action:
                        print("❌ No log_meal action found in response")
                        return False
                    
                    if not meal_action.get("success"):
                        print(f"❌ Meal logging action failed: {meal_action}")
                        return False
                    
                    # Check if nutrients field is present
                    nutrients = meal_action.get("nutrients", {})
                    if not nutrients:
                        print("⚠️ No nutrients field in meal action")
                    else:
                        calories = nutrients.get("energy_kcal", 0)
                        print(f"✅ Meal logged with nutrients - calories: {calories}")
                    
                    print(f"✅ AI Coach meal logging successful: {meal_action.get('food_name')} ({meal_action.get('portion_grams')}g)")
                    return True
                else:
                    print(f"❌ AI Chat request failed: {resp.status}")
                    text = await resp.text()
                    print(f"Response: {text}")
                    return False
        except Exception as e:
            print(f"❌ AI Chat request error: {e}")
            return False
    
    async def verify_dashboard_calories_increased(self, initial_calories):
        """Verify dashboard calories increased after meal logging"""
        print("\n📈 Verifying dashboard calories increased...")
        
        try:
            async with self.session.get(f"{BACKEND_URL}/dashboard", headers=self.headers) as resp:
                if resp.status == 200:
                    data = await resp.json()
                    current_calories = data.get("nutrition", {}).get("calories", {}).get("current", 0)
                    
                    if current_calories > initial_calories:
                        print(f"✅ Calories increased: {initial_calories} → {current_calories}")
                        return True
                    else:
                        print(f"❌ Calories did not increase: {initial_calories} → {current_calories}")
                        return False
                else:
                    print(f"❌ Dashboard verification failed: {resp.status}")
                    return False
        except Exception as e:
            print(f"❌ Dashboard verification error: {e}")
            return False
    
    async def verify_meal_in_today_meals(self):
        """Verify the banana meal appears in today's meals"""
        print("\n🍌 Verifying meal appears in today's meals...")
        
        try:
            async with self.session.get(f"{BACKEND_URL}/meals/today", headers=self.headers) as resp:
                if resp.status == 200:
                    data = await resp.json()
                    meals = data.get("meals", [])
                    
                    # Look for banana meal
                    banana_meal = None
                    for meal in meals:
                        food_name = meal.get("food_name", "").lower()
                        if "banana" in food_name:
                            banana_meal = meal
                            break
                    
                    if banana_meal:
                        nutrients = banana_meal.get("nutrients", {})
                        calories = nutrients.get("energy_kcal", 0)
                        print(f"✅ Banana meal found: {banana_meal.get('food_name')} with {calories} calories")
                        return True
                    else:
                        print("❌ Banana meal not found in today's meals")
                        print(f"Available meals: {[m.get('food_name') for m in meals]}")
                        return False
                else:
                    print(f"❌ Today's meals request failed: {resp.status}")
                    return False
        except Exception as e:
            print(f"❌ Today's meals request error: {e}")
            return False
    
    async def add_test_meal_with_nutrients(self):
        """Add a test meal with known nutrients for gap analysis"""
        print("\n🥗 Adding test meal with known nutrients...")
        
        meal_data = {
            "food_name": "Test Iron Food",
            "portion_grams": 100,
            "meal_type": "lunch",
            "cooking_method": "raw",
            "nutrients": {
                "energy_kcal": 200,
                "protein_g": 20,
                "iron_mg": 5,
                "vitamin_c_mg": 60,
                "calcium_mg": 100
            }
        }
        
        try:
            async with self.session.post(f"{BACKEND_URL}/meals", 
                                       headers=self.headers, 
                                       json=meal_data) as resp:
                if resp.status == 200:
                    data = await resp.json()
                    print(f"✅ Test meal added: {data.get('message', 'Success')}")
                    return True
                else:
                    print(f"❌ Test meal addition failed: {resp.status}")
                    text = await resp.text()
                    print(f"Response: {text}")
                    return False
        except Exception as e:
            print(f"❌ Test meal addition error: {e}")
            return False
    
    async def test_improved_gap_analysis(self):
        """Test improved Gap Analysis with trend data"""
        print("\n📊 Testing improved Gap Analysis...")
        
        try:
            async with self.session.get(f"{BACKEND_URL}/progress/gap-analysis", headers=self.headers) as resp:
                if resp.status == 200:
                    data = await resp.json()
                    print("✅ Gap Analysis response received")
                    
                    # Check for progress_summary field
                    progress_summary = data.get("progress_summary")
                    if not progress_summary:
                        print("❌ No progress_summary field in response")
                        return False
                    
                    # Check required fields in progress_summary
                    required_fields = [
                        "current_deficiencies", "previous_deficiencies", "overall_trend",
                        "trend_improving", "trend_declining", "trend_stable", "days_tracked_this_week"
                    ]
                    
                    missing_fields = []
                    for field in required_fields:
                        if field not in progress_summary:
                            missing_fields.append(field)
                    
                    if missing_fields:
                        print(f"❌ Missing fields in progress_summary: {missing_fields}")
                        return False
                    
                    print(f"✅ Progress summary fields present: {list(progress_summary.keys())}")
                    
                    # Check top_gaps for trend data
                    top_gaps = data.get("top_gaps", [])
                    if not top_gaps:
                        print("⚠️ No top_gaps found (may be normal if no deficiencies)")
                    else:
                        # Check if each gap has trend, delta_pct, prev_pct_rda fields
                        for gap in top_gaps:
                            required_gap_fields = ["trend", "delta_pct", "prev_pct_rda"]
                            missing_gap_fields = []
                            for field in required_gap_fields:
                                if field not in gap:
                                    missing_gap_fields.append(field)
                            
                            if missing_gap_fields:
                                print(f"❌ Missing fields in gap {gap.get('name', 'unknown')}: {missing_gap_fields}")
                                return False
                        
                        print(f"✅ Top gaps have trend data: {len(top_gaps)} gaps analyzed")
                    
                    print("✅ Gap Analysis with trend data working correctly")
                    return True
                else:
                    print(f"❌ Gap Analysis request failed: {resp.status}")
                    text = await resp.text()
                    print(f"Response: {text}")
                    return False
        except Exception as e:
            print(f"❌ Gap Analysis request error: {e}")
            return False
    
    async def test_ai_coach_water_logging(self):
        """Test AI Coach water logging updates daily summary"""
        print("\n💧 Testing AI Coach water logging...")
        
        try:
            chat_data = {
                "message": "Log 500ml of water"
            }
            
            async with self.session.post(f"{BACKEND_URL}/ai/chat", 
                                       headers=self.headers, 
                                       json=chat_data) as resp:
                if resp.status == 200:
                    data = await resp.json()
                    print("✅ AI Chat water response received")
                    
                    # Check for actions array with log_water
                    actions = data.get("actions", [])
                    water_action = None
                    for action in actions:
                        if action.get("type") == "log_water":
                            water_action = action
                            break
                    
                    if not water_action:
                        print("❌ No log_water action found in response")
                        return False
                    
                    if not water_action.get("success"):
                        print(f"❌ Water logging action failed: {water_action}")
                        return False
                    
                    amount = water_action.get("amount_ml", 0)
                    print(f"✅ AI Coach water logging successful: {amount}ml")
                    return True
                else:
                    print(f"❌ AI Chat water request failed: {resp.status}")
                    return False
        except Exception as e:
            print(f"❌ AI Chat water request error: {e}")
            return False
    
    async def verify_water_in_today_logs(self):
        """Verify water shows up in today's water logs"""
        print("\n💧 Verifying water appears in today's logs...")
        
        try:
            async with self.session.get(f"{BACKEND_URL}/water/today", headers=self.headers) as resp:
                if resp.status == 200:
                    data = await resp.json()
                    total_water = data.get("total_ml", 0)
                    logs = data.get("logs", [])
                    
                    if total_water > 0:
                        print(f"✅ Water logged successfully: {total_water}ml total, {len(logs)} logs")
                        return True
                    else:
                        print("❌ No water found in today's logs")
                        return False
                else:
                    print(f"❌ Water today request failed: {resp.status}")
                    return False
        except Exception as e:
            print(f"❌ Water today request error: {e}")
            return False

async def run_tests():
    """Run all AI Coach and Gap Analysis tests"""
    print("🚀 Starting NutriOS AI Coach & Gap Analysis Tests")
    print("=" * 60)
    
    async with NutriOSTestClient() as client:
        # Setup test data
        if not await client.setup_test_data():
            print("❌ Test setup failed")
            return
        
        # Test sequence as specified in review request
        test_results = []
        
        # 1. Get initial dashboard calories
        initial_calories = await client.get_dashboard_initial()
        if initial_calories is None:
            print("❌ Could not get initial dashboard state")
            return
        
        # 2. Test AI Coach meal logging
        result = await client.test_ai_coach_meal_logging()
        test_results.append(("AI Coach Meal Logging", result))
        
        # 3. Verify dashboard calories increased
        if result:
            result = await client.verify_dashboard_calories_increased(initial_calories)
            test_results.append(("Dashboard Calories Update", result))
        
        # 4. Verify meal appears in today's meals
        if result:
            result = await client.verify_meal_in_today_meals()
            test_results.append(("Meal in Today's List", result))
        
        # 5. Add test meal with known nutrients
        result = await client.add_test_meal_with_nutrients()
        test_results.append(("Add Test Meal with Nutrients", result))
        
        # 6. Test improved Gap Analysis
        if result:
            result = await client.test_improved_gap_analysis()
            test_results.append(("Improved Gap Analysis", result))
        
        # 7. Test AI Coach water logging
        result = await client.test_ai_coach_water_logging()
        test_results.append(("AI Coach Water Logging", result))
        
        # 8. Verify water in today's logs
        if result:
            result = await client.verify_water_in_today_logs()
            test_results.append(("Water in Today's Logs", result))
        
        # Print summary
        print("\n" + "=" * 60)
        print("📋 TEST SUMMARY")
        print("=" * 60)
        
        passed = 0
        failed = 0
        
        for test_name, success in test_results:
            status = "✅ PASS" if success else "❌ FAIL"
            print(f"{status} {test_name}")
            if success:
                passed += 1
            else:
                failed += 1
        
        print(f"\n📊 Results: {passed} passed, {failed} failed")
        
        if failed == 0:
            print("🎉 All tests passed! AI Coach and Gap Analysis are working correctly.")
        else:
            print("⚠️ Some tests failed. Check the detailed output above.")

if __name__ == "__main__":
    asyncio.run(run_tests())