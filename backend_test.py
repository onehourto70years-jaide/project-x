#!/usr/bin/env python3
"""
NutriOS Backend API Testing - Celebration Analytics Focus
Testing the celebration analytics endpoints as per review request.
"""

import asyncio
import aiohttp
import json
import uuid
from datetime import datetime, timezone, timedelta
from pymongo import MongoClient

# Configuration
BASE_URL = "https://meal-sync-test.preview.emergentagent.com/api"
MONGO_URL = "mongodb://localhost:27017"
DB_NAME = "nutrient_mapper"

# Test user credentials as per review request
TEST_USER_ID = "test_celeb_user"
TEST_EMAIL = "test_celeb@nutrios.com"
TEST_NAME = "Celebration Tester"
TEST_SESSION_TOKEN = "test_celeb_token_456"

class NutriOSCelebrationTester:
    def __init__(self):
        self.session = None
        self.mongo_client = None
        self.db = None
        self.headers = {
            "Authorization": f"Bearer {TEST_SESSION_TOKEN}",
            "Content-Type": "application/json"
        }
        
    async def setup(self):
        """Setup test environment - create test user and session in MongoDB"""
        print("🔧 Setting up test environment...")
        
        # MongoDB setup
        self.mongo_client = MongoClient(MONGO_URL)
        self.db = self.mongo_client[DB_NAME]
        
        # HTTP session setup
        self.session = aiohttp.ClientSession()
        
        # Create test user in MongoDB
        user_doc = {
            "user_id": TEST_USER_ID,
            "email": TEST_EMAIL,
            "name": TEST_NAME,
            "created_at": datetime.now(timezone.utc),
            "weight_kg": 70.0,
            "activity_level": "moderate"
        }
        
        # Insert or update user
        self.db.users.replace_one({"user_id": TEST_USER_ID}, user_doc, upsert=True)
        print(f"✅ Created test user: {TEST_USER_ID}")
        
        # Create session token with far future expiry
        session_doc = {
            "session_token": TEST_SESSION_TOKEN,
            "user_id": TEST_USER_ID,
            "expires_at": datetime.now(timezone.utc) + timedelta(days=365),  # Far future date
            "created_at": datetime.now(timezone.utc)
        }
        
        self.db.user_sessions.replace_one({"session_token": TEST_SESSION_TOKEN}, session_doc, upsert=True)
        print(f"✅ Created session token: {TEST_SESSION_TOKEN}")
        
        # Clean up any existing celebration analytics for this user
        self.db.celebration_analytics.delete_many({"user_id": TEST_USER_ID})
        print("✅ Cleaned up existing celebration analytics")
        
    async def cleanup(self):
        """Cleanup test data"""
        print("🧹 Cleaning up test data...")
        if self.db is not None:
            self.db.users.delete_one({"user_id": TEST_USER_ID})
            self.db.user_sessions.delete_one({"session_token": TEST_SESSION_TOKEN})
            self.db.celebration_analytics.delete_many({"user_id": TEST_USER_ID})
            print("✅ Test data cleaned up")
            
        if self.session:
            await self.session.close()
            
        if self.mongo_client:
            self.mongo_client.close()
    
    async def make_request(self, method, endpoint, data=None, headers=None):
        """Make HTTP request with error handling"""
        url = f"{BASE_URL}{endpoint}"
        request_headers = self.headers.copy()
        if headers:
            request_headers.update(headers)
            
        try:
            if method.upper() == "GET":
                async with self.session.get(url, headers=request_headers) as response:
                    return response.status, await response.json()
            elif method.upper() == "POST":
                async with self.session.post(url, headers=request_headers, json=data) as response:
                    return response.status, await response.json()
            elif method.upper() == "PUT":
                async with self.session.put(url, headers=request_headers, json=data) as response:
                    return response.status, await response.json()
            elif method.upper() == "DELETE":
                async with self.session.delete(url, headers=request_headers) as response:
                    return response.status, await response.json()
        except Exception as e:
            return 500, {"error": str(e)}
    
    async def test_health_check(self):
        """Test basic health check endpoint"""
        print("\n🔍 Testing Health Check...")
        status, response = await self.make_request("GET", "/")
        
        if status == 200:
            print(f"✅ Health check passed: {response}")
            return True
        else:
            print(f"❌ Health check failed: {status} - {response}")
            return False
    
    async def test_track_celebration_viewed(self):
        """Test POST /api/analytics/celebration - Track a 'viewed' celebration event"""
        print("\n🎉 Testing Track Celebration (viewed)...")
        
        celebration_data = {
            "badge_id": "first_meal",
            "badge_name": "First Meal",
            "action": "viewed",
            "duration_ms": 3500
        }
        
        status, response = await self.make_request("POST", "/analytics/celebration", celebration_data)
        
        if status == 200 and response.get("status") == "tracked":
            print(f"✅ Celebration tracking (viewed) passed: {response}")
            return True
        else:
            print(f"❌ Celebration tracking (viewed) failed: {status} - {response}")
            return False
    
    async def test_track_celebration_shared(self):
        """Test POST /api/analytics/celebration - Track a 'shared' celebration event"""
        print("\n📤 Testing Track Celebration (shared)...")
        
        celebration_data = {
            "badge_id": "first_meal",
            "badge_name": "First Meal",
            "action": "shared",
            "duration_ms": 5000
        }
        
        status, response = await self.make_request("POST", "/analytics/celebration", celebration_data)
        
        if status == 200 and response.get("status") == "tracked":
            print(f"✅ Celebration tracking (shared) passed: {response}")
            return True
        else:
            print(f"❌ Celebration tracking (shared) failed: {status} - {response}")
            return False
    
    async def test_track_celebration_continued(self):
        """Test POST /api/analytics/celebration - Track a 'continued' celebration event"""
        print("\n➡️ Testing Track Celebration (continued)...")
        
        celebration_data = {
            "badge_id": "hydration_hero",
            "badge_name": "Hydration Hero",
            "action": "continued",
            "duration_ms": 2000
        }
        
        status, response = await self.make_request("POST", "/analytics/celebration", celebration_data)
        
        if status == 200 and response.get("status") == "tracked":
            print(f"✅ Celebration tracking (continued) passed: {response}")
            return True
        else:
            print(f"❌ Celebration tracking (continued) failed: {status} - {response}")
            return False
    
    async def test_celebration_summary(self):
        """Test GET /api/analytics/celebrations/summary - Get celebration analytics"""
        print("\n📊 Testing Celebration Summary...")
        
        status, response = await self.make_request("GET", "/analytics/celebrations/summary")
        
        if status == 200:
            # Check required fields
            required_fields = ["total_celebrations", "share_count", "continue_count", "skip_count", "share_rate", "continue_rate"]
            missing_fields = [field for field in required_fields if field not in response]
            
            if not missing_fields:
                total = response.get("total_celebrations", 0)
                share_count = response.get("share_count", 0)
                continue_count = response.get("continue_count", 0)
                
                print(f"✅ Celebration summary passed:")
                print(f"   - Total celebrations: {total}")
                print(f"   - Share count: {share_count}")
                print(f"   - Continue count: {continue_count}")
                print(f"   - Skip count: {response.get('skip_count', 0)}")
                print(f"   - Share rate: {response.get('share_rate', 0)}%")
                print(f"   - Continue rate: {response.get('continue_rate', 0)}%")
                
                # Verify we have at least 3 celebrations (from our tests)
                if total >= 3 and share_count >= 1 and continue_count >= 1:
                    print("✅ Summary data matches expected test results")
                    return True
                else:
                    print(f"❌ Summary data doesn't match expected results (total: {total}, shared: {share_count}, continued: {continue_count})")
                    return False
            else:
                print(f"❌ Celebration summary missing fields: {missing_fields}")
                return False
        else:
            print(f"❌ Celebration summary failed: {status} - {response}")
            return False
    
    async def test_unauthorized_access(self):
        """Test that endpoints require authentication"""
        print("\n🔒 Testing Unauthorized Access...")
        
        # Test without Authorization header
        headers_no_auth = {"Content-Type": "application/json"}
        
        # Test celebration tracking without auth
        celebration_data = {
            "badge_id": "test",
            "badge_name": "Test",
            "action": "viewed",
            "duration_ms": 1000
        }
        
        url = f"{BASE_URL}/analytics/celebration"
        try:
            async with self.session.post(url, headers=headers_no_auth, json=celebration_data) as response:
                status = response.status
                if status == 401:
                    print("✅ Unauthorized access properly blocked for celebration tracking")
                    return True
                else:
                    print(f"❌ Expected 401 for unauthorized access, got {status}")
                    return False
        except Exception as e:
            print(f"❌ Error testing unauthorized access: {e}")
            return False
    
    async def run_all_tests(self):
        """Run all celebration analytics tests in sequence"""
        print("🚀 Starting NutriOS Celebration Analytics API Tests")
        print(f"🌐 Base URL: {BASE_URL}")
        print(f"👤 Test User: {TEST_USER_ID}")
        
        results = {}
        
        try:
            await self.setup()
            
            # Health check
            results["health_check"] = await self.test_health_check()
            
            # Celebration analytics tests
            results["track_celebration_viewed"] = await self.test_track_celebration_viewed()
            results["track_celebration_shared"] = await self.test_track_celebration_shared()
            results["track_celebration_continued"] = await self.test_track_celebration_continued()
            results["celebration_summary"] = await self.test_celebration_summary()
            results["unauthorized_access"] = await self.test_unauthorized_access()
            
            # Summary
            print("\n" + "="*60)
            print("📋 CELEBRATION ANALYTICS TEST SUMMARY")
            print("="*60)
            
            passed = sum(1 for result in results.values() if result)
            total = len(results)
            
            for test_name, result in results.items():
                status = "✅ PASS" if result else "❌ FAIL"
                print(f"{status} {test_name.replace('_', ' ').title()}")
            
            print(f"\n🎯 Overall: {passed}/{total} tests passed ({(passed/total)*100:.1f}%)")
            
            if passed == total:
                print("🎉 ALL TESTS PASSED - Celebration Analytics system is fully operational!")
            else:
                print("⚠️  Some tests failed - see details above")
                
            return results
                
        except Exception as e:
            print(f"💥 Test execution error: {e}")
            return {}
            
        finally:
            await self.cleanup()

async def main():
    tester = NutriOSCelebrationTester()
    results = await tester.run_all_tests()
    return results

if __name__ == "__main__":
    asyncio.run(main())