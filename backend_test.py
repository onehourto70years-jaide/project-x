#!/usr/bin/env python3
"""
NutriOS Backend API Testing - Water Log Delete Endpoint Focus
Testing the water log delete endpoint as per review request.
"""

import asyncio
import aiohttp
import json
import uuid
from datetime import datetime, timezone, timedelta
from pymongo import MongoClient

# Configuration - Using the correct backend URL from frontend/.env
BASE_URL = "https://meal-sync-test.preview.emergentagent.com/api"
MONGO_URL = "mongodb://localhost:27017"
DB_NAME = "nutrient_mapper"

# Test user credentials as per review request
TEST_USER_ID = "test_water_del"
TEST_EMAIL = "water_del@nutrios.com"
TEST_NAME = "Water Test"
TEST_SESSION_TOKEN = "water_del_token_789"

class NutriOSWaterDeleteTester:
    def __init__(self):
        self.session = None
        self.mongo_client = None
        self.db = None
        self.headers = {
            "Authorization": f"Bearer {TEST_SESSION_TOKEN}",
            "Content-Type": "application/json"
        }
        self.created_log_id = None
        
    async def setup(self):
        """Setup test environment - create test user and session in MongoDB"""
        print("🔧 Setting up test environment...")
        
        # MongoDB setup
        self.mongo_client = MongoClient(MONGO_URL)
        self.db = self.mongo_client[DB_NAME]
        
        # HTTP session setup
        self.session = aiohttp.ClientSession()
        
        # Create test user in MongoDB as per review request
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
        
        # Create session token with far future expiry as per review request
        session_doc = {
            "session_token": TEST_SESSION_TOKEN,
            "user_id": TEST_USER_ID,
            "expires_at": datetime.now(timezone.utc) + timedelta(days=365),  # Far future date
            "created_at": datetime.now(timezone.utc)
        }
        
        self.db.user_sessions.replace_one({"session_token": TEST_SESSION_TOKEN}, session_doc, upsert=True)
        print(f"✅ Created session token: {TEST_SESSION_TOKEN}")
        
        # Clean up any existing water logs for this user
        self.db.water_logs.delete_many({"user_id": TEST_USER_ID})
        print("✅ Cleaned up existing water logs")
        
    async def cleanup(self):
        """Cleanup test data"""
        print("🧹 Cleaning up test data...")
        if self.db is not None:
            self.db.users.delete_one({"user_id": TEST_USER_ID})
            self.db.user_sessions.delete_one({"session_token": TEST_SESSION_TOKEN})
            self.db.water_logs.delete_many({"user_id": TEST_USER_ID})
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
            elif method.upper() == "DELETE":
                async with self.session.delete(url, headers=request_headers) as response:
                    return response.status, await response.json()
        except Exception as e:
            return 500, {"error": str(e)}
    
    async def test_step_1_add_water_log(self):
        """Step 1: POST /api/water — Add a water log (250ml)"""
        print("\n💧 Step 1: Testing Add Water Log (250ml)...")
        
        water_data = {"amount_ml": 250}
        status, response = await self.make_request("POST", "/water", water_data)
        
        if status == 200 and "log_id" in response:
            self.created_log_id = response["log_id"]
            print(f"✅ Water log added successfully: {response}")
            print(f"   - Log ID: {self.created_log_id}")
            print(f"   - Amount: {response.get('amount_ml')}ml")
            return True
        else:
            print(f"❌ Add water log failed: {status} - {response}")
            return False
    
    async def test_step_2_verify_log_exists(self):
        """Step 2: GET /api/water/today — Verify the log exists"""
        print("\n🔍 Step 2: Testing Get Today's Water (verify log exists)...")
        
        status, response = await self.make_request("GET", "/water/today")
        
        if status == 200:
            total_ml = response.get("total_ml", 0)
            logs = response.get("logs", [])
            
            if total_ml >= 250 and len(logs) > 0:
                # Check if our log is in the list
                log_found = any(log.get("id") == self.created_log_id for log in logs)
                if log_found:
                    print(f"✅ Water log verification passed:")
                    print(f"   - Total water: {total_ml}ml")
                    print(f"   - Logs count: {len(logs)}")
                    print(f"   - Our log found: {log_found}")
                    return True
                else:
                    print(f"❌ Our log ID {self.created_log_id} not found in logs")
                    return False
            else:
                print(f"❌ Expected total_ml >= 250 and logs > 0, got total_ml={total_ml}, logs={len(logs)}")
                return False
        else:
            print(f"❌ Get today's water failed: {status} - {response}")
            return False
    
    async def test_step_3_delete_water_log(self):
        """Step 3: DELETE /api/water/{log_id} — Delete the water log"""
        print(f"\n🗑️ Step 3: Testing Delete Water Log (ID: {self.created_log_id})...")
        
        if not self.created_log_id:
            print("❌ No log ID available for deletion test")
            return False
        
        status, response = await self.make_request("DELETE", f"/water/{self.created_log_id}")
        
        if status == 200:
            expected_fields = ["message", "deleted_log"]
            missing_fields = [field for field in expected_fields if field not in response]
            
            if not missing_fields:
                deleted_log = response.get("deleted_log", {})
                if deleted_log.get("id") == self.created_log_id and deleted_log.get("amount_ml") == 250:
                    print(f"✅ Water log deletion passed:")
                    print(f"   - Message: {response.get('message')}")
                    print(f"   - Deleted log ID: {deleted_log.get('id')}")
                    print(f"   - Deleted amount: {deleted_log.get('amount_ml')}ml")
                    return True
                else:
                    print(f"❌ Deleted log data mismatch: expected ID={self.created_log_id}, amount=250")
                    print(f"   Got: ID={deleted_log.get('id')}, amount={deleted_log.get('amount_ml')}")
                    return False
            else:
                print(f"❌ Delete response missing fields: {missing_fields}")
                return False
        else:
            print(f"❌ Delete water log failed: {status} - {response}")
            return False
    
    async def test_step_4_verify_log_removed(self):
        """Step 4: GET /api/water/today — Verify the log is removed"""
        print("\n🔍 Step 4: Testing Get Today's Water (verify log removed)...")
        
        status, response = await self.make_request("GET", "/water/today")
        
        if status == 200:
            total_ml = response.get("total_ml", 0)
            logs = response.get("logs", [])
            
            # Check that our log is no longer in the list
            log_found = any(log.get("id") == self.created_log_id for log in logs)
            
            if not log_found and total_ml == 0:  # Should be 0 since we only added one log
                print(f"✅ Water log removal verification passed:")
                print(f"   - Total water: {total_ml}ml (reduced by 250ml)")
                print(f"   - Logs count: {len(logs)}")
                print(f"   - Our log found: {log_found}")
                return True
            else:
                print(f"❌ Log removal verification failed:")
                print(f"   - Total water: {total_ml}ml (expected 0)")
                print(f"   - Our log still found: {log_found}")
                return False
        else:
            print(f"❌ Get today's water failed: {status} - {response}")
            return False
    
    async def test_step_5_delete_nonexistent_log(self):
        """Step 5: DELETE /api/water/fake-nonexistent-id — Try to delete a non-existent log"""
        print("\n🚫 Step 5: Testing Delete Non-Existent Water Log...")
        
        fake_log_id = "fake-nonexistent-id"
        status, response = await self.make_request("DELETE", f"/water/{fake_log_id}")
        
        if status == 404:
            print(f"✅ Non-existent log deletion properly handled:")
            print(f"   - Status: {status}")
            print(f"   - Response: {response}")
            return True
        else:
            print(f"❌ Expected 404 for non-existent log, got {status} - {response}")
            return False
    
    async def run_all_tests(self):
        """Run all water log delete tests in sequence as per review request"""
        print("🚀 Starting NutriOS Water Log Delete Endpoint Tests")
        print(f"🌐 Base URL: {BASE_URL}")
        print(f"👤 Test User: {TEST_USER_ID}")
        print(f"🔑 Session Token: {TEST_SESSION_TOKEN}")
        
        results = {}
        
        try:
            await self.setup()
            
            # Test flow as specified in review request
            results["step_1_add_water_log"] = await self.test_step_1_add_water_log()
            results["step_2_verify_log_exists"] = await self.test_step_2_verify_log_exists()
            results["step_3_delete_water_log"] = await self.test_step_3_delete_water_log()
            results["step_4_verify_log_removed"] = await self.test_step_4_verify_log_removed()
            results["step_5_delete_nonexistent_log"] = await self.test_step_5_delete_nonexistent_log()
            
            # Summary
            print("\n" + "="*60)
            print("📋 WATER LOG DELETE TEST SUMMARY")
            print("="*60)
            
            passed = sum(1 for result in results.values() if result)
            total = len(results)
            
            for test_name, result in results.items():
                status = "✅ PASS" if result else "❌ FAIL"
                print(f"{status} {test_name.replace('_', ' ').title()}")
            
            print(f"\n🎯 Overall: {passed}/{total} tests passed ({(passed/total)*100:.1f}%)")
            
            if passed == total:
                print("🎉 ALL TESTS PASSED - Water Log Delete endpoint is fully operational!")
            else:
                print("⚠️  Some tests failed - see details above")
                
            return results
                
        except Exception as e:
            print(f"💥 Test execution error: {e}")
            return {}
            
        finally:
            await self.cleanup()

async def main():
    tester = NutriOSWaterDeleteTester()
    results = await tester.run_all_tests()
    return results

if __name__ == "__main__":
    asyncio.run(main())