#!/usr/bin/env python3
"""
NutriOS Backend API Regression Test Suite
Testing all endpoints after major refactoring from monolithic server.py to modular structure.
"""

import asyncio
import httpx
import json
from datetime import datetime, timezone, timedelta
from typing import Dict, Any, Optional

# Test Configuration
BASE_URL = "https://meal-sync-test.preview.emergentagent.com"
API_BASE = f"{BASE_URL}/api"

# Test User Setup (as specified in review request)
TEST_USER_ID = "test_refactor_user"
TEST_EMAIL = "test@nutrios.com"
TEST_NAME = "Test User"
TEST_TOKEN = "test_refactor_token_2026"

class NutriOSAPITester:
    def __init__(self):
        self.client = httpx.AsyncClient(timeout=30.0)
        self.test_results = []
        self.auth_headers = {"Authorization": f"Bearer {TEST_TOKEN}"}
        
    async def __aenter__(self):
        return self
        
    async def __aexit__(self, exc_type, exc_val, exc_tb):
        await self.client.aclose()
    
    def log_result(self, endpoint: str, method: str, status: int, success: bool, response_data: Any = None, error: str = None):
        """Log test result"""
        result = {
            "endpoint": endpoint,
            "method": method,
            "status": status,
            "success": success,
            "timestamp": datetime.now().isoformat(),
            "response_data": response_data,
            "error": error
        }
        self.test_results.append(result)
        status_icon = "✅" if success else "❌"
        print(f"{status_icon} {method} {endpoint} - Status: {status}")
        if error:
            print(f"   Error: {error}")
        if response_data and isinstance(response_data, dict):
            if "message" in response_data:
                print(f"   Message: {response_data['message']}")
    
    async def setup_test_user(self):
        """Setup test user and session in MongoDB"""
        print("\n🔧 Setting up test user in MongoDB...")
        
        # MongoDB connection setup
        from motor.motor_asyncio import AsyncIOMotorClient
        mongo_client = AsyncIOMotorClient("mongodb://localhost:27017")
        db = mongo_client["nutrient_mapper"]
        
        try:
            # Create test user
            user_doc = {
                "user_id": TEST_USER_ID,
                "email": TEST_EMAIL,
                "name": TEST_NAME,
                "created_at": datetime.now(timezone.utc),
                "weight_kg": 70,
                "activity_level": "moderate",
                "health_goals": []
            }
            await db.users.update_one(
                {"user_id": TEST_USER_ID},
                {"$set": user_doc},
                upsert=True
            )
            
            # Create test session
            session_doc = {
                "session_token": TEST_TOKEN,
                "user_id": TEST_USER_ID,
                "expires_at": datetime.now(timezone.utc) + timedelta(days=7),
                "created_at": datetime.now(timezone.utc)
            }
            await db.user_sessions.update_one(
                {"session_token": TEST_TOKEN},
                {"$set": session_doc},
                upsert=True
            )
            
            # Create test user settings
            settings_doc = {
                "user_id": TEST_USER_ID,
                "daily_water_goal_ml": 2500,
                "daily_calorie_goal": 2000,
                "daily_protein_goal": 50
            }
            await db.user_settings.update_one(
                {"user_id": TEST_USER_ID},
                {"$set": settings_doc},
                upsert=True
            )
            
            print(f"✅ Test user setup complete: {TEST_USER_ID}")
            
        except Exception as e:
            print(f"❌ Test user setup failed: {e}")
            raise
        finally:
            mongo_client.close()
    
    async def cleanup_test_user(self):
        """Cleanup test user from all collections"""
        print("\n🧹 Cleaning up test user from MongoDB...")
        
        from motor.motor_asyncio import AsyncIOMotorClient
        mongo_client = AsyncIOMotorClient("mongodb://localhost:27017")
        db = mongo_client["nutrient_mapper"]
        
        collections_to_clean = [
            "users", "user_sessions", "user_settings", "meals", "water_logs",
            "routines", "favorites", "recipes", "daily_summaries", "badges",
            "task_completions"
        ]
        
        try:
            for collection_name in collections_to_clean:
                result = await db[collection_name].delete_many({"user_id": TEST_USER_ID})
                if result.deleted_count > 0:
                    print(f"   Cleaned {result.deleted_count} documents from {collection_name}")
            
            print("✅ Test user cleanup complete")
            
        except Exception as e:
            print(f"❌ Test user cleanup failed: {e}")
        finally:
            mongo_client.close()
    
    async def test_endpoint(self, method: str, endpoint: str, headers: Dict = None, json_data: Dict = None, params: Dict = None) -> Dict:
        """Test a single endpoint"""
        url = f"{API_BASE}{endpoint}"
        
        try:
            if method.upper() == "GET":
                response = await self.client.get(url, headers=headers, params=params)
            elif method.upper() == "POST":
                response = await self.client.post(url, headers=headers, json=json_data, params=params)
            elif method.upper() == "PUT":
                response = await self.client.put(url, headers=headers, json=json_data, params=params)
            elif method.upper() == "DELETE":
                response = await self.client.delete(url, headers=headers, params=params)
            else:
                raise ValueError(f"Unsupported method: {method}")
            
            success = 200 <= response.status_code < 300
            
            try:
                response_data = response.json()
            except:
                response_data = response.text
            
            self.log_result(endpoint, method.upper(), response.status_code, success, response_data)
            
            return {
                "status_code": response.status_code,
                "success": success,
                "data": response_data,
                "headers": dict(response.headers)
            }
            
        except Exception as e:
            self.log_result(endpoint, method.upper(), 0, False, error=str(e))
            return {
                "status_code": 0,
                "success": False,
                "error": str(e)
            }
    
    async def run_all_tests(self):
        """Run all API endpoint tests as specified in review request"""
        print("🚀 Starting NutriOS Backend API Regression Tests")
        print("=" * 60)
        
        # Setup test user
        await self.setup_test_user()
        
        print("\n📋 Testing All Endpoints...")
        
        # 1. Health Check
        await self.test_endpoint("GET", "/")
        
        # 2. Element Info
        await self.test_endpoint("GET", "/elements/info")
        
        # 3. Recommended Values
        await self.test_endpoint("GET", "/recommended-values")
        
        # 4. Food Search
        await self.test_endpoint("POST", "/foods/search", json_data={"query": "apple", "page_size": 3})
        
        # 5. Retention Factors
        await self.test_endpoint("GET", "/foods/retention-factors")
        
        # 6. Dashboard (auth required)
        await self.test_endpoint("GET", "/dashboard", headers=self.auth_headers)
        
        # 7. User Settings - Get (auth required)
        await self.test_endpoint("GET", "/user/settings", headers=self.auth_headers)
        
        # 8. User Settings - Update (auth required)
        await self.test_endpoint("PUT", "/user/settings", headers=self.auth_headers, json_data={"daily_water_goal_ml": 3000})
        
        # 9. User Profile - Update (auth required)
        await self.test_endpoint("PUT", "/user/profile", headers=self.auth_headers, json_data={"weight_kg": 75})
        
        # 10. Add Meal (auth required)
        meal_data = {
            "food_name": "Apple",
            "portion_grams": 150,
            "meal_type": "snack",
            "cooking_method": "raw",
            "nutrients": {"energy_kcal": 78, "protein_g": 0.4},
            "elements": {"C": 6.5, "H": 1.2, "O": 8.3}
        }
        await self.test_endpoint("POST", "/meals", headers=self.auth_headers, json_data=meal_data)
        
        # 11. Get Today's Meals (auth required)
        await self.test_endpoint("GET", "/meals/today", headers=self.auth_headers)
        
        # 12. Add Water Log (auth required)
        await self.test_endpoint("POST", "/water", headers=self.auth_headers, json_data={"amount_ml": 300})
        
        # 13. Get Today's Water (auth required)
        await self.test_endpoint("GET", "/water/today", headers=self.auth_headers)
        
        # 14. Smart Water Goal (auth required)
        await self.test_endpoint("GET", "/water/smart-goal", headers=self.auth_headers)
        
        # 15. Create Routine (auth required)
        routine_data = {
            "name": "Test Routine",
            "type": "morning",
            "time_start": "07:00",
            "time_end": "08:00",
            "days": ["mon", "tue"],
            "tasks": [{"id": "t1", "name": "Wake up"}]
        }
        await self.test_endpoint("POST", "/routines", headers=self.auth_headers, json_data=routine_data)
        
        # 16. Get Routines (auth required)
        await self.test_endpoint("GET", "/routines", headers=self.auth_headers)
        
        # 17. Get Today's Routines (auth required)
        await self.test_endpoint("GET", "/routines/today", headers=self.auth_headers)
        
        # 18. Get Routine Streak (auth required)
        await self.test_endpoint("GET", "/routines/streak", headers=self.auth_headers)
        
        # 19. Add Favorite (auth required)
        favorite_data = {
            "fdc_id": 171052,
            "food_name": "Chicken",
            "default_portion_grams": 100
        }
        await self.test_endpoint("POST", "/favorites", headers=self.auth_headers, json_data=favorite_data)
        
        # 20. Get Favorites (auth required)
        await self.test_endpoint("GET", "/favorites", headers=self.auth_headers)
        
        # 21. Create Recipe (auth required)
        recipe_data = {
            "name": "Simple Apple",
            "description": "test",
            "servings": 1,
            "ingredients": []
        }
        await self.test_endpoint("POST", "/recipes", headers=self.auth_headers, json_data=recipe_data)
        
        # 22. Get Recipes (auth required)
        await self.test_endpoint("GET", "/recipes", headers=self.auth_headers)
        
        # 23. Nutrition Progress (auth required)
        await self.test_endpoint("GET", "/progress/nutrition", headers=self.auth_headers, params={"days": 7})
        
        # 24. Water Progress (auth required)
        await self.test_endpoint("GET", "/progress/water", headers=self.auth_headers, params={"days": 7})
        
        # 25. Routines Progress (auth required)
        await self.test_endpoint("GET", "/progress/routines", headers=self.auth_headers, params={"days": 7})
        
        # 26. Elements Progress (auth required)
        await self.test_endpoint("GET", "/progress/elements", headers=self.auth_headers, params={"days": 7})
        
        # 27. Get Badges (auth required)
        await self.test_endpoint("GET", "/badges", headers=self.auth_headers)
        
        # 28. Molecular Profiles
        await self.test_endpoint("GET", "/molecular/profiles")
        
        # 29. Payment Status (auth required)
        await self.test_endpoint("GET", "/payments/status", headers=self.auth_headers)
        
        # 30. Notification Status (auth required)
        await self.test_endpoint("GET", "/notifications/status", headers=self.auth_headers)
        
        # 31. Daily Summary Share (auth required)
        await self.test_endpoint("GET", "/share/daily-summary", headers=self.auth_headers)
        
        # 32. AI Predictive Recommendations (auth required)
        await self.test_endpoint("POST", "/ai/predictive-recommendations", headers=self.auth_headers)
        
        # 33. AI Insights (auth required)
        await self.test_endpoint("GET", "/ai/insights", headers=self.auth_headers)
        
        # Cleanup
        await self.cleanup_test_user()
        
        # Generate summary
        self.generate_summary()
    
    def generate_summary(self):
        """Generate test summary"""
        print("\n" + "=" * 60)
        print("📊 TEST SUMMARY")
        print("=" * 60)
        
        total_tests = len(self.test_results)
        passed_tests = sum(1 for result in self.test_results if result["success"])
        failed_tests = total_tests - passed_tests
        
        print(f"Total Tests: {total_tests}")
        print(f"Passed: {passed_tests} ✅")
        print(f"Failed: {failed_tests} ❌")
        print(f"Success Rate: {(passed_tests/total_tests)*100:.1f}%")
        
        if failed_tests > 0:
            print("\n❌ FAILED TESTS:")
            for result in self.test_results:
                if not result["success"]:
                    print(f"   {result['method']} {result['endpoint']} - Status: {result['status']}")
                    if result.get("error"):
                        print(f"      Error: {result['error']}")
        
        print("\n✅ PASSED TESTS:")
        for result in self.test_results:
            if result["success"]:
                print(f"   {result['method']} {result['endpoint']} - Status: {result['status']}")
        
        # Save detailed results to file
        with open("/app/test_results_detailed.json", "w") as f:
            json.dump(self.test_results, f, indent=2, default=str)
        
        print(f"\n📄 Detailed results saved to: /app/test_results_detailed.json")


async def main():
    """Main test runner"""
    async with NutriOSAPITester() as tester:
        await tester.run_all_tests()


if __name__ == "__main__":
    asyncio.run(main())