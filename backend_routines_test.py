#!/usr/bin/env python3
"""
NutriOS Routines Edit and Delete Endpoints Test
Tests the specific flow requested: Create → Edit → Delete routines
"""

import asyncio
import aiohttp
import json
from datetime import datetime, timezone, timedelta
from motor.motor_asyncio import AsyncIOMotorClient

# Test configuration
BASE_URL = "https://meal-sync-test.preview.emergentagent.com/api"
MONGO_URL = "mongodb://localhost:27017"
DB_NAME = "nutrient_mapper"

class RoutinesEditDeleteTester:
    def __init__(self):
        self.session = None
        self.mongo_client = None
        self.db = None
        self.test_user_id = "test_rout_user"
        self.test_session_token = "test_rout_token_333"
        self.test_email = "rout@nutrios.com"
        self.test_name = "Routine Tester"
        self.routine_id = None
        
    async def setup(self):
        """Setup HTTP session and MongoDB connection"""
        self.session = aiohttp.ClientSession()
        self.mongo_client = AsyncIOMotorClient(MONGO_URL)
        self.db = self.mongo_client[DB_NAME]
        print("✅ Setup complete - HTTP session and MongoDB connection established")
        
    async def cleanup(self):
        """Cleanup test data and close connections"""
        try:
            # Clean up test user, session, and any routines
            await self.db.users.delete_one({"user_id": self.test_user_id})
            await self.db.user_sessions.delete_one({"user_id": self.test_user_id})
            await self.db.routines.delete_many({"user_id": self.test_user_id})
            print("✅ Test data cleanup complete")
        except Exception as e:
            print(f"⚠️ Cleanup warning: {e}")
        
        if self.session:
            await self.session.close()
        if self.mongo_client:
            self.mongo_client.close()
        print("✅ Connections closed")
    
    async def setup_test_user(self):
        """Create test user and session in MongoDB as specified in review request"""
        print("\n🔍 Setup: Creating test user and session")
        
        try:
            # Create test user
            user_doc = {
                "user_id": self.test_user_id,
                "email": self.test_email,
                "name": self.test_name,
                "weight_kg": 70,
                "activity_level": "moderate",
                "created_at": datetime.now(timezone.utc)
            }
            
            await self.db.users.insert_one(user_doc)
            print(f"✅ Test user created: {self.test_user_id}")
            
            # Create session with far future expiry
            expires_at = datetime.now(timezone.utc) + timedelta(days=365)
            session_doc = {
                "session_token": self.test_session_token,
                "user_id": self.test_user_id,
                "expires_at": expires_at
            }
            
            await self.db.user_sessions.insert_one(session_doc)
            print(f"✅ Test session created: {self.test_session_token}")
            
            return True
            
        except Exception as e:
            print(f"❌ Test user setup failed: {e}")
            return False
    
    async def test_1_create_routine(self):
        """Test 1: POST /api/routines - Create a routine"""
        print("\n🔍 Test 1: Create Routine")
        
        try:
            headers = {"Authorization": f"Bearer {self.test_session_token}"}
            routine_data = {
                "name": "Morning Workout",
                "type": "workout",
                "time_start": "06:00",
                "time_end": "07:00",
                "days": ["mon", "wed", "fri"],
                "tasks": [
                    {"id": "t1", "name": "Stretching"},
                    {"id": "t2", "name": "Running"}
                ]
            }
            
            async with self.session.post(f"{BASE_URL}/routines", 
                                       headers=headers, 
                                       json=routine_data) as response:
                if response.status in [200, 201]:
                    data = await response.json()
                    self.routine_id = data.get("routine_id")
                    print(f"✅ Routine created successfully: {response.status}")
                    print(f"   Routine ID: {self.routine_id}")
                    print(f"   Response: {data}")
                    return True
                else:
                    error_text = await response.text()
                    print(f"❌ Routine creation failed: {response.status}")
                    print(f"   Error: {error_text}")
                    return False
        except Exception as e:
            print(f"❌ Routine creation error: {e}")
            return False
    
    async def test_2_verify_routine_exists(self):
        """Test 2: GET /api/routines - Verify routine exists"""
        print("\n🔍 Test 2: Verify Routine Exists")
        
        try:
            headers = {"Authorization": f"Bearer {self.test_session_token}"}
            async with self.session.get(f"{BASE_URL}/routines", headers=headers) as response:
                if response.status == 200:
                    data = await response.json()
                    routines = data.get("routines", [])
                    print(f"✅ Routines retrieved successfully: {response.status}")
                    print(f"   Number of routines: {len(routines)}")
                    
                    if len(routines) == 1:
                        routine = routines[0]
                        print(f"   Routine name: {routine.get('name')}")
                        print(f"   Routine type: {routine.get('type')}")
                        print(f"   Tasks count: {len(routine.get('tasks', []))}")
                        
                        # Verify it's our routine
                        if routine.get("name") == "Morning Workout" and routine.get("id") == self.routine_id:
                            print("✅ Routine verification successful")
                            return True
                        else:
                            print("❌ Routine data doesn't match expected values")
                            return False
                    else:
                        print(f"❌ Expected 1 routine, found {len(routines)}")
                        return False
                else:
                    error_text = await response.text()
                    print(f"❌ Routine retrieval failed: {response.status}")
                    print(f"   Error: {error_text}")
                    return False
        except Exception as e:
            print(f"❌ Routine retrieval error: {e}")
            return False
    
    async def test_3_edit_routine(self):
        """Test 3: PUT /api/routines/{routine_id} - Edit the routine"""
        print("\n🔍 Test 3: Edit Routine")
        
        try:
            headers = {"Authorization": f"Bearer {self.test_session_token}"}
            update_data = {
                "name": "Evening Yoga",
                "type": "evening",
                "time_start": "19:00",
                "time_end": "20:00",
                "days": ["mon", "tue", "wed", "thu", "fri"],
                "tasks": [
                    {"id": "t1", "name": "Meditation"},
                    {"id": "t2", "name": "Yoga Flow"},
                    {"id": "t3", "name": "Cool Down"}
                ]
            }
            
            async with self.session.put(f"{BASE_URL}/routines/{self.routine_id}", 
                                      headers=headers, 
                                      json=update_data) as response:
                if response.status == 200:
                    data = await response.json()
                    print(f"✅ Routine updated successfully: {response.status}")
                    print(f"   Response: {data}")
                    return True
                else:
                    error_text = await response.text()
                    print(f"❌ Routine update failed: {response.status}")
                    print(f"   Error: {error_text}")
                    return False
        except Exception as e:
            print(f"❌ Routine update error: {e}")
            return False
    
    async def test_4_verify_changes_saved(self):
        """Test 4: GET /api/routines - Verify changes were saved"""
        print("\n🔍 Test 4: Verify Changes Were Saved")
        
        try:
            headers = {"Authorization": f"Bearer {self.test_session_token}"}
            async with self.session.get(f"{BASE_URL}/routines", headers=headers) as response:
                if response.status == 200:
                    data = await response.json()
                    routines = data.get("routines", [])
                    print(f"✅ Routines retrieved successfully: {response.status}")
                    
                    if len(routines) == 1:
                        routine = routines[0]
                        print(f"   Updated routine name: {routine.get('name')}")
                        print(f"   Updated routine type: {routine.get('type')}")
                        print(f"   Updated tasks count: {len(routine.get('tasks', []))}")
                        print(f"   Updated days: {routine.get('days')}")
                        print(f"   Updated time: {routine.get('time_start')} - {routine.get('time_end')}")
                        
                        # Verify the changes
                        expected_checks = [
                            (routine.get("name") == "Evening Yoga", "name"),
                            (routine.get("type") == "evening", "type"),
                            (len(routine.get("tasks", [])) == 3, "tasks count"),
                            (routine.get("time_start") == "19:00", "start time"),
                            (routine.get("time_end") == "20:00", "end time"),
                            (len(routine.get("days", [])) == 5, "days count")
                        ]
                        
                        all_checks_passed = True
                        for check_result, check_name in expected_checks:
                            if not check_result:
                                print(f"❌ {check_name} check failed")
                                all_checks_passed = False
                            else:
                                print(f"✅ {check_name} check passed")
                        
                        if all_checks_passed:
                            print("✅ All changes verified successfully")
                            return True
                        else:
                            print("❌ Some changes were not saved correctly")
                            return False
                    else:
                        print(f"❌ Expected 1 routine, found {len(routines)}")
                        return False
                else:
                    error_text = await response.text()
                    print(f"❌ Routine retrieval failed: {response.status}")
                    print(f"   Error: {error_text}")
                    return False
        except Exception as e:
            print(f"❌ Routine verification error: {e}")
            return False
    
    async def test_5_delete_routine(self):
        """Test 5: DELETE /api/routines/{routine_id} - Delete the routine"""
        print("\n🔍 Test 5: Delete Routine")
        
        try:
            headers = {"Authorization": f"Bearer {self.test_session_token}"}
            async with self.session.delete(f"{BASE_URL}/routines/{self.routine_id}", 
                                         headers=headers) as response:
                if response.status == 200:
                    data = await response.json()
                    print(f"✅ Routine deleted successfully: {response.status}")
                    print(f"   Response: {data}")
                    return True
                else:
                    error_text = await response.text()
                    print(f"❌ Routine deletion failed: {response.status}")
                    print(f"   Error: {error_text}")
                    return False
        except Exception as e:
            print(f"❌ Routine deletion error: {e}")
            return False
    
    async def test_6_verify_routine_deleted(self):
        """Test 6: GET /api/routines - Verify routine was deleted"""
        print("\n🔍 Test 6: Verify Routine Was Deleted")
        
        try:
            headers = {"Authorization": f"Bearer {self.test_session_token}"}
            async with self.session.get(f"{BASE_URL}/routines", headers=headers) as response:
                if response.status == 200:
                    data = await response.json()
                    routines = data.get("routines", [])
                    print(f"✅ Routines retrieved successfully: {response.status}")
                    print(f"   Number of routines: {len(routines)}")
                    
                    if len(routines) == 0:
                        print("✅ Routine deletion verified - empty array returned")
                        return True
                    else:
                        print(f"❌ Expected 0 routines, found {len(routines)}")
                        print(f"   Remaining routines: {[r.get('name') for r in routines]}")
                        return False
                else:
                    error_text = await response.text()
                    print(f"❌ Routine retrieval failed: {response.status}")
                    print(f"   Error: {error_text}")
                    return False
        except Exception as e:
            print(f"❌ Routine deletion verification error: {e}")
            return False
    
    async def run_all_tests(self):
        """Run all routine edit and delete tests"""
        print("🚀 Starting NutriOS Routines Edit and Delete Tests")
        print(f"   Backend URL: {BASE_URL}")
        print(f"   MongoDB: {MONGO_URL}/{DB_NAME}")
        
        await self.setup()
        
        # Setup test user first
        if not await self.setup_test_user():
            print("❌ Failed to setup test user - aborting tests")
            await self.cleanup()
            return False
        
        tests = [
            ("Create Routine", self.test_1_create_routine),
            ("Verify Routine Exists", self.test_2_verify_routine_exists),
            ("Edit Routine", self.test_3_edit_routine),
            ("Verify Changes Saved", self.test_4_verify_changes_saved),
            ("Delete Routine", self.test_5_delete_routine),
            ("Verify Routine Deleted", self.test_6_verify_routine_deleted),
        ]
        
        results = []
        for test_name, test_func in tests:
            try:
                result = await test_func()
                results.append((test_name, result))
                
                # If a critical test fails, stop the chain
                if not result and test_name in ["Create Routine", "Edit Routine", "Delete Routine"]:
                    print(f"⚠️ Critical test '{test_name}' failed - stopping test chain")
                    break
                    
            except Exception as e:
                print(f"❌ {test_name} crashed: {e}")
                results.append((test_name, False))
                break
        
        await self.cleanup()
        
        # Summary
        print("\n" + "="*60)
        print("🏁 ROUTINES EDIT & DELETE TEST SUMMARY")
        print("="*60)
        
        passed = 0
        total = len(results)
        
        for test_name, result in results:
            status = "✅ PASS" if result else "❌ FAIL"
            print(f"{status} {test_name}")
            if result:
                passed += 1
        
        print(f"\nSuccess Rate: {passed}/{total} ({passed/total*100:.1f}%)")
        
        if passed == total:
            print("🎉 ALL ROUTINES EDIT & DELETE TESTS PASSED!")
            print("✅ Routines Edit and Delete endpoints are working correctly")
        else:
            print("⚠️ Some tests failed - check logs above")
        
        return passed == total

async def main():
    tester = RoutinesEditDeleteTester()
    success = await tester.run_all_tests()
    return 0 if success else 1

if __name__ == "__main__":
    exit_code = asyncio.run(main())
    exit(exit_code)