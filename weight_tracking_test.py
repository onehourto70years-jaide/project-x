#!/usr/bin/env python3
"""
NutriOS Weight Tracking API Test Suite
Testing NEW Weight Tracking endpoints as specified in review request.
"""

import asyncio
import httpx
import json
from datetime import datetime, timezone, timedelta
from typing import Dict, Any, Optional

# Test Configuration - Using production URL from frontend/.env
BASE_URL = "https://meal-sync-test.preview.emergentagent.com"
API_BASE = f"{BASE_URL}/api"

# Test User Setup (as specified in review request)
TEST_USER_ID = "test_weight_user"
TEST_EMAIL = "weight_test@test.com"
TEST_NAME = "Weight Test"
TEST_TOKEN = "test_weight_token_2026"

class WeightTrackingTester:
    def __init__(self):
        self.client = httpx.AsyncClient(timeout=30.0)
        self.test_results = []
        self.auth_headers = {"Authorization": f"Bearer {TEST_TOKEN}"}
        
    async def __aenter__(self):
        return self
        
    async def __aexit__(self, exc_type, exc_val, exc_tb):
        await self.client.aclose()
    
    def log_result(self, test_name: str, endpoint: str, method: str, status: int, success: bool, response_data: Any = None, error: str = None):
        """Log test result"""
        result = {
            "test_name": test_name,
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
        print(f"{status_icon} {test_name}: {method} {endpoint} - Status: {status}")
        if error:
            print(f"   Error: {error}")
        if response_data and isinstance(response_data, dict):
            if "message" in response_data:
                print(f"   Message: {response_data['message']}")
            # Show key response fields for weight endpoints
            if "weight_kg" in response_data:
                print(f"   Weight: {response_data['weight_kg']}kg")
            if "current_weight" in response_data:
                print(f"   Current Weight: {response_data['current_weight']}kg")
    
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
                "weight_kg": 70  # Initial weight as specified
            }
            await db.users.update_one(
                {"user_id": TEST_USER_ID},
                {"$set": user_doc},
                upsert=True
            )
            
            # Create test session as specified in review request
            session_doc = {
                "session_token": TEST_TOKEN,
                "user_id": TEST_USER_ID,
                "expires_at": datetime.now(timezone.utc) + timedelta(days=1),  # 86400000ms = 1 day
                "created_at": datetime.now(timezone.utc)
            }
            await db.user_sessions.update_one(
                {"session_token": TEST_TOKEN},
                {"$set": session_doc},
                upsert=True
            )
            
            print(f"✅ Test user setup complete: {TEST_USER_ID}")
            print(f"   Email: {TEST_EMAIL}")
            print(f"   Initial weight: 70kg")
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
            "users", "user_sessions", "weight_logs"
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
    
    async def test_endpoint(self, test_name: str, method: str, endpoint: str, headers: Dict = None, json_data: Dict = None, params: Dict = None, expected_status: int = 200) -> Dict:
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
            
            success = response.status_code == expected_status
            
            try:
                response_data = response.json()
            except:
                response_data = response.text
            
            self.log_result(test_name, endpoint, method.upper(), response.status_code, success, response_data)
            
            return {
                "status_code": response.status_code,
                "success": success,
                "data": response_data,
                "headers": dict(response.headers)
            }
            
        except Exception as e:
            self.log_result(test_name, endpoint, method.upper(), 0, False, error=str(e))
            return {
                "status_code": 0,
                "success": False,
                "error": str(e)
            }
    
    async def run_weight_tracking_tests(self):
        """Run all Weight Tracking API tests as specified in review request"""
        print("🚀 Starting NutriOS Weight Tracking API Tests")
        print("=" * 60)
        
        # Setup test user
        await self.setup_test_user()
        
        print("\n📋 Testing Weight Tracking Endpoints...")
        
        # Test 1: POST /api/weight - Log weight entry
        print("\n1. Testing weight logging...")
        result1 = await self.test_endpoint(
            "Log Weight Entry",
            "POST", 
            "/weight", 
            headers=self.auth_headers, 
            json_data={"weight_kg": 75.5, "note": "Morning weigh-in"}
        )
        
        # Test 2: GET /api/weight/today - Get today's weight
        print("\n2. Testing today's weight retrieval...")
        result2 = await self.test_endpoint(
            "Get Today's Weight",
            "GET", 
            "/weight/today", 
            headers=self.auth_headers
        )
        
        # Test 3: POST /api/weight - Update today's weight (upsert)
        print("\n3. Testing weight update (upsert)...")
        result3 = await self.test_endpoint(
            "Update Today's Weight",
            "POST", 
            "/weight", 
            headers=self.auth_headers, 
            json_data={"weight_kg": 76.0, "note": "Updated"}
        )
        
        # Test 4: GET /api/weight/history?days=30 - Get weight history
        print("\n4. Testing 30-day weight history...")
        result4 = await self.test_endpoint(
            "Get 30-Day History",
            "GET", 
            "/weight/history", 
            headers=self.auth_headers, 
            params={"days": 30}
        )
        
        # Test 5: GET /api/weight/history?days=7 - Get 7-day history
        print("\n5. Testing 7-day weight history...")
        result5 = await self.test_endpoint(
            "Get 7-Day History",
            "GET", 
            "/weight/history", 
            headers=self.auth_headers, 
            params={"days": 7}
        )
        
        # Test 6: DELETE /api/weight/{date} - Delete weight entry (use today's date)
        print("\n6. Testing weight entry deletion...")
        today_date = datetime.now(timezone.utc).strftime("%Y-%m-%d")
        result6 = await self.test_endpoint(
            "Delete Today's Weight Entry",
            "DELETE", 
            f"/weight/{today_date}", 
            headers=self.auth_headers
        )
        
        # Test 7: DELETE /api/weight/2020-01-01 - Delete non-existent entry
        print("\n7. Testing deletion of non-existent entry...")
        result7 = await self.test_endpoint(
            "Delete Non-Existent Entry",
            "DELETE", 
            "/weight/2020-01-01", 
            headers=self.auth_headers,
            expected_status=404
        )
        
        # Test 8: POST /api/weight - Validation: weight too low
        print("\n8. Testing validation: weight too low...")
        result8 = await self.test_endpoint(
            "Validation: Weight Too Low",
            "POST", 
            "/weight", 
            headers=self.auth_headers, 
            json_data={"weight_kg": 10},
            expected_status=400
        )
        
        # Test 9: POST /api/weight - Validation: weight too high
        print("\n9. Testing validation: weight too high...")
        result9 = await self.test_endpoint(
            "Validation: Weight Too High",
            "POST", 
            "/weight", 
            headers=self.auth_headers, 
            json_data={"weight_kg": 500},
            expected_status=400
        )
        
        # Cleanup
        await self.cleanup_test_user()
        
        # Generate summary
        self.generate_summary()
    
    def generate_summary(self):
        """Generate test summary"""
        print("\n" + "=" * 60)
        print("📊 WEIGHT TRACKING API TEST SUMMARY")
        print("=" * 60)
        
        total_tests = len(self.test_results)
        passed_tests = sum(1 for result in self.test_results if result["success"])
        failed_tests = total_tests - passed_tests
        
        print(f"Total Tests: {total_tests}")
        print(f"Passed: {passed_tests} ✅")
        print(f"Failed: {failed_tests} ❌")
        print(f"Success Rate: {(passed_tests/total_tests)*100:.1f}%")
        
        print("\n📋 DETAILED TEST RESULTS:")
        for i, result in enumerate(self.test_results, 1):
            status_icon = "✅" if result["success"] else "❌"
            print(f"{i}. {status_icon} {result['test_name']}")
            print(f"   {result['method']} {result['endpoint']} - Status: {result['status']}")
            if result.get("error"):
                print(f"   Error: {result['error']}")
            elif result.get("response_data") and isinstance(result["response_data"], dict):
                if "message" in result["response_data"]:
                    print(f"   Response: {result['response_data']['message']}")
        
        if failed_tests > 0:
            print(f"\n❌ FAILED TESTS ({failed_tests}):")
            for result in self.test_results:
                if not result["success"]:
                    print(f"   • {result['test_name']}: {result['method']} {result['endpoint']}")
                    if result.get("error"):
                        print(f"     Error: {result['error']}")
        
        # Save detailed results to file
        with open("/app/weight_tracking_test_results.json", "w") as f:
            json.dump(self.test_results, f, indent=2, default=str)
        
        print(f"\n📄 Detailed results saved to: /app/weight_tracking_test_results.json")


async def main():
    """Main test runner"""
    async with WeightTrackingTester() as tester:
        await tester.run_weight_tracking_tests()


if __name__ == "__main__":
    asyncio.run(main())