#!/usr/bin/env python3
"""
NutriOS Notification System API Test Suite
Testing the NEW notification system endpoints as specified in the review request.
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
TEST_USER_ID = "test_notif_user"
TEST_EMAIL = "test@example.com"
TEST_NAME = "Test User"
TEST_TOKEN = "test_notification_token_2026"

class NotificationAPITester:
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
            elif "status" in response_data:
                print(f"   Status: {response_data['status']}")
    
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
                "health_goals": [],
                "language_preference": "en"
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
                "notifications_enabled": True,
                "water_reminder_enabled": True,
                "meal_reminder_enabled": True,
                "routine_reminder_enabled": True,
                "daily_water_goal_ml": 2500,
                "daily_calorie_goal": 2000
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
            "users", "user_sessions", "user_settings", "push_tokens", 
            "notification_logs"
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
    
    async def run_notification_tests(self):
        """Run notification system tests as specified in review request"""
        print("🚀 Starting NutriOS Notification System API Tests")
        print("=" * 60)
        
        # Setup test user
        await self.setup_test_user()
        
        print("\n📋 Testing Notification System Endpoints...")
        
        # Test 1: Root health check (no auth)
        print("\n1. Testing Root Health Check...")
        await self.test_endpoint("GET", "/")
        
        # Test 2: Register push token
        print("\n2. Testing Push Token Registration...")
        token_data = {
            "push_token": "ExponentPushToken[test123abc]",
            "platform": "ios"
        }
        await self.test_endpoint("POST", "/notifications/register-token", headers=self.auth_headers, json_data=token_data)
        
        # Test 3: Get notification status (should show push_token_registered: true)
        print("\n3. Testing Notification Status...")
        status_result = await self.test_endpoint("GET", "/notifications/status", headers=self.auth_headers)
        if status_result["success"] and status_result["data"].get("push_token_registered"):
            print("   ✅ Push token registration confirmed")
        else:
            print("   ⚠️ Push token registration not confirmed")
        
        # Test 4: Get notification history
        print("\n4. Testing Notification History...")
        await self.test_endpoint("GET", "/notifications/history", headers=self.auth_headers)
        
        # Test 5: Mark notifications as read
        print("\n5. Testing Mark Notifications Read...")
        await self.test_endpoint("POST", "/notifications/mark-read", headers=self.auth_headers)
        
        # Test 6: Get notification schedule
        print("\n6. Testing Notification Schedule...")
        await self.test_endpoint("GET", "/notifications/schedule", headers=self.auth_headers)
        
        # Test 7: Send test notification (may fail due to invalid token, but should handle gracefully)
        print("\n7. Testing Send Test Notification...")
        test_result = await self.test_endpoint("POST", "/notifications/test", headers=self.auth_headers)
        if test_result["status_code"] == 200:
            print("   ✅ Test notification sent successfully")
        elif test_result["status_code"] == 400 or test_result["status_code"] == 500:
            print("   ⚠️ Test notification failed (expected with test token)")
        
        # Test 8: Dashboard data
        print("\n8. Testing Dashboard...")
        await self.test_endpoint("GET", "/dashboard", headers=self.auth_headers)
        
        # Test 9: Update profile with language preference
        print("\n9. Testing Profile Update with Language Preference...")
        profile_data = {"language_preference": "it"}
        await self.test_endpoint("PUT", "/user/profile", headers=self.auth_headers, json_data=profile_data)
        
        # Test 10: Get user settings
        print("\n10. Testing Get User Settings...")
        await self.test_endpoint("GET", "/user/settings", headers=self.auth_headers)
        
        # Test 11: Update user settings
        print("\n11. Testing Update User Settings...")
        settings_data = {
            "notifications_enabled": True,
            "water_reminder_enabled": True
        }
        await self.test_endpoint("PUT", "/user/settings", headers=self.auth_headers, json_data=settings_data)
        
        # Test 12: Unregister push token
        print("\n12. Testing Push Token Unregistration...")
        await self.test_endpoint("DELETE", "/notifications/unregister-token", headers=self.auth_headers)
        
        # Test 13: Verify token unregistration
        print("\n13. Verifying Token Unregistration...")
        final_status = await self.test_endpoint("GET", "/notifications/status", headers=self.auth_headers)
        if final_status["success"] and not final_status["data"].get("push_token_registered"):
            print("   ✅ Push token unregistration confirmed")
        else:
            print("   ⚠️ Push token still appears to be registered")
        
        # Cleanup
        await self.cleanup_test_user()
        
        # Generate summary
        self.generate_summary()
    
    def generate_summary(self):
        """Generate test summary"""
        print("\n" + "=" * 60)
        print("📊 NOTIFICATION SYSTEM TEST SUMMARY")
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
        with open("/app/notification_test_results.json", "w") as f:
            json.dump(self.test_results, f, indent=2, default=str)
        
        print(f"\n📄 Detailed results saved to: /app/notification_test_results.json")


async def main():
    """Main test runner"""
    async with NotificationAPITester() as tester:
        await tester.run_notification_tests()


if __name__ == "__main__":
    asyncio.run(main())