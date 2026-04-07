#!/usr/bin/env python3
"""
NutriOS Backend API Focused Test Suite
Testing specific endpoints as requested in the review request.
"""

import asyncio
import httpx
import json
from datetime import datetime, timezone, timedelta
from typing import Dict, Any, Optional

# Test Configuration - Using the production URL as per environment
BASE_URL = "https://meal-sync-test.preview.emergentagent.com"
API_BASE = f"{BASE_URL}/api"

# Test User Setup (as specified in review request)
TEST_USER_ID = "test_user_123"
TEST_EMAIL = "test@example.com"
TEST_NAME = "Test User"
TEST_TOKEN = "test_session_token_123"

class NutriOSFocusedTester:
    def __init__(self):
        self.client = httpx.AsyncClient(timeout=30.0)
        self.test_results = []
        self.auth_headers = {"Authorization": f"Bearer {TEST_TOKEN}"}
        self.cookie_headers = {"Cookie": f"session_token={TEST_TOKEN}"}
        
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
        """Setup test user and session in MongoDB as specified in review request"""
        print("\n🔧 Setting up test user in MongoDB...")
        
        # MongoDB connection setup
        from motor.motor_asyncio import AsyncIOMotorClient
        mongo_client = AsyncIOMotorClient("mongodb://localhost:27017")
        db = mongo_client["nutrient_mapper"]
        
        try:
            # Create test user as specified in review request
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
            
            # Create test session as specified in review request
            future_date = datetime.now(timezone.utc) + timedelta(days=7)
            session_doc = {
                "session_token": TEST_TOKEN,
                "user_id": TEST_USER_ID,
                "expires_at": future_date,
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
                "daily_protein_goal": 50,
                "notifications_enabled": True,
                "water_reminder_enabled": True,
                "meal_reminder_enabled": True,
                "routine_reminder_enabled": True
            }
            await db.user_settings.update_one(
                {"user_id": TEST_USER_ID},
                {"$set": settings_doc},
                upsert=True
            )
            
            print(f"✅ Test user setup complete: {TEST_USER_ID}")
            print(f"   Session token: {TEST_TOKEN}")
            
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
    
    async def run_focused_tests(self):
        """Run focused API tests as specified in review request"""
        print("🚀 Starting NutriOS Backend API Focused Tests")
        print("=" * 60)
        print("Testing specific endpoints as requested:")
        print("1. Auth flow with test user creation")
        print("2. Account deletion (with email)")
        print("3. User settings & profile")
        print("4. Core endpoints (food search, meals, water, dashboard)")
        print("5. Payments status")
        print("6. Health check")
        print("=" * 60)
        
        # Setup test user
        await self.setup_test_user()
        
        print("\n📋 Testing Specific Endpoints...")
        
        # 1. Health Check (GET /api/health)
        print("\n🏥 HEALTH CHECK")
        await self.test_endpoint("GET", "/")
        
        # 2. Auth Flow Testing
        print("\n🔐 AUTH FLOW TESTING")
        # Test authenticated endpoint to verify session works
        await self.test_endpoint("GET", "/auth/me", headers=self.auth_headers)
        
        # 3. User Settings & Profile (GET/PUT /api/user/settings and PUT /api/user/profile)
        print("\n⚙️ USER SETTINGS & PROFILE")
        await self.test_endpoint("GET", "/user/settings", headers=self.auth_headers)
        await self.test_endpoint("PUT", "/user/settings", headers=self.auth_headers, 
                                json_data={"daily_water_goal_ml": 3000, "notifications_enabled": True})
        await self.test_endpoint("PUT", "/user/profile", headers=self.auth_headers, 
                                json_data={"weight_kg": 75, "activity_level": "active"})
        
        # 4. Core Endpoints
        print("\n🍎 CORE ENDPOINTS")
        
        # Food Search (POST /api/foods/search)
        await self.test_endpoint("POST", "/foods/search", 
                                json_data={"query": "apple", "page_size": 3})
        
        # Meals (POST /api/meals, GET /api/meals/today)
        meal_data = {
            "food_name": "Apple",
            "portion_grams": 150,
            "meal_type": "snack",
            "cooking_method": "raw",
            "nutrients": {"energy_kcal": 78, "protein_g": 0.4, "carbs_g": 20.6, "fat_g": 0.3},
            "elements": {"C": 6.5, "H": 1.2, "O": 8.3, "N": 0.1}
        }
        await self.test_endpoint("POST", "/meals", headers=self.auth_headers, json_data=meal_data)
        await self.test_endpoint("GET", "/meals/today", headers=self.auth_headers)
        
        # Water (POST /api/water, GET /api/water/today)
        await self.test_endpoint("POST", "/water", headers=self.auth_headers, 
                                json_data={"amount_ml": 250})
        await self.test_endpoint("GET", "/water/today", headers=self.auth_headers)
        
        # Dashboard (GET /api/dashboard)
        await self.test_endpoint("GET", "/dashboard", headers=self.auth_headers)
        
        # 5. Payments (GET /api/payments/status)
        print("\n💳 PAYMENTS")
        await self.test_endpoint("GET", "/payments/status", headers=self.auth_headers)
        
        # 6. Account Deletion (DELETE /api/user/account) - Test this last
        print("\n🗑️ ACCOUNT DELETION (with email)")
        delete_result = await self.test_endpoint("DELETE", "/user/account", headers=self.auth_headers)
        
        # Verify account was deleted by trying to access user data
        print("\n🔍 VERIFYING ACCOUNT DELETION")
        verify_result = await self.test_endpoint("GET", "/user/settings", headers=self.auth_headers)
        if verify_result["status_code"] == 401 or verify_result["status_code"] == 404:
            print("✅ Account deletion verified - user data no longer accessible")
        else:
            print("❌ Account deletion verification failed - user data still accessible")
        
        # Generate summary
        self.generate_summary()
    
    def generate_summary(self):
        """Generate test summary"""
        print("\n" + "=" * 60)
        print("📊 FOCUSED TEST SUMMARY")
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
        with open("/app/test_results_focused.json", "w") as f:
            json.dump(self.test_results, f, indent=2, default=str)
        
        print(f"\n📄 Detailed results saved to: /app/test_results_focused.json")


async def main():
    """Main test runner"""
    async with NutriOSFocusedTester() as tester:
        await tester.run_focused_tests()


if __name__ == "__main__":
    asyncio.run(main())