#!/usr/bin/env python3
"""
NutriOS Favorites Endpoints Test
Tests the favorites system endpoints as specified in the review request.
"""

import asyncio
import aiohttp
import json
from datetime import datetime, timezone, timedelta
from motor.motor_asyncio import AsyncIOMotorClient
import sys

# Test configuration
BASE_URL = "https://meal-sync-test.preview.emergentagent.com/api"
MONGO_URL = "mongodb://localhost:27017"
DB_NAME = "nutrient_mapper"

class FavoritesTester:
    def __init__(self):
        self.session = None
        self.mongo_client = None
        self.db = None
        self.test_user_id = "test_fav_user"
        self.test_session_token = "test_fav_token_222"
        self.test_email = "fav@nutrios.com"
        self.test_name = "Fav Tester"
        self.headers = {"Authorization": f"Bearer {self.test_session_token}"}
        
    async def setup(self):
        """Setup HTTP session and MongoDB connection"""
        self.session = aiohttp.ClientSession()
        self.mongo_client = AsyncIOMotorClient(MONGO_URL)
        self.db = self.mongo_client[DB_NAME]
        print("✅ Setup complete - HTTP session and MongoDB connection established")
        
    async def cleanup(self):
        """Cleanup test data and close connections"""
        try:
            # Clean up test user and session
            await self.db.users.delete_one({"user_id": self.test_user_id})
            await self.db.user_sessions.delete_one({"user_id": self.test_user_id})
            await self.db.favorites.delete_many({"user_id": self.test_user_id})
            print("✅ Test data cleanup complete")
        except Exception as e:
            print(f"⚠️ Cleanup warning: {e}")
        
        if self.session:
            await self.session.close()
        if self.mongo_client:
            self.mongo_client.close()
        print("✅ Connections closed")

    async def create_test_user(self):
        """Create test user and session in MongoDB as specified in review request"""
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
            print(f"✅ Created test user: {self.test_user_id}")
            
            # Create session token with far future expiry
            session_doc = {
                "session_token": self.test_session_token,
                "user_id": self.test_user_id,
                "expires_at": datetime.now(timezone.utc) + timedelta(days=365),
                "created_at": datetime.now(timezone.utc)
            }
            await self.db.user_sessions.insert_one(session_doc)
            print(f"✅ Created session token: {self.test_session_token}")
            
        except Exception as e:
            print(f"❌ Failed to create test user: {e}")
            raise

    async def test_get_favorites_empty(self):
        """Test 1: GET /api/favorites - List favorites (should be empty initially)"""
        print("\n🧪 Test 1: GET /api/favorites (empty list)")
        try:
            async with self.session.get(f"{BASE_URL}/favorites", headers=self.headers) as response:
                status = response.status
                data = await response.json()
                
                print(f"Status: {status}")
                print(f"Response: {json.dumps(data, indent=2)}")
                
                if status == 200 and data.get("favorites") == []:
                    print("✅ PASS: Empty favorites list returned correctly")
                    return True
                else:
                    print(f"❌ FAIL: Expected 200 with empty favorites, got {status}: {data}")
                    return False
                    
        except Exception as e:
            print(f"❌ FAIL: Exception occurred: {e}")
            return False

    async def test_add_favorite_chicken(self):
        """Test 2: POST /api/favorites - Add Chicken Breast to favorites"""
        print("\n🧪 Test 2: POST /api/favorites (Chicken Breast)")
        try:
            payload = {
                "fdc_id": 170567,
                "food_name": "Chicken Breast",
                "default_portion_grams": 150,
                "default_cooking_method": "baking"
            }
            
            async with self.session.post(f"{BASE_URL}/favorites", headers=self.headers, json=payload) as response:
                status = response.status
                data = await response.json()
                
                print(f"Status: {status}")
                print(f"Response: {json.dumps(data, indent=2)}")
                
                if status in [200, 201] and "favorite_id" in data:
                    print("✅ PASS: Chicken Breast added to favorites")
                    return True
                else:
                    print(f"❌ FAIL: Expected 200/201 with favorite_id, got {status}: {data}")
                    return False
                    
        except Exception as e:
            print(f"❌ FAIL: Exception occurred: {e}")
            return False

    async def test_add_favorite_banana(self):
        """Test 3: POST /api/favorites - Add Banana to favorites"""
        print("\n🧪 Test 3: POST /api/favorites (Banana)")
        try:
            payload = {
                "fdc_id": 173944,
                "food_name": "Banana",
                "default_portion_grams": 120,
                "default_cooking_method": "raw"
            }
            
            async with self.session.post(f"{BASE_URL}/favorites", headers=self.headers, json=payload) as response:
                status = response.status
                data = await response.json()
                
                print(f"Status: {status}")
                print(f"Response: {json.dumps(data, indent=2)}")
                
                if status in [200, 201] and "favorite_id" in data:
                    print("✅ PASS: Banana added to favorites")
                    return True
                else:
                    print(f"❌ FAIL: Expected 200/201 with favorite_id, got {status}: {data}")
                    return False
                    
        except Exception as e:
            print(f"❌ FAIL: Exception occurred: {e}")
            return False

    async def test_get_favorites_with_items(self):
        """Test 4: GET /api/favorites - List favorites (should have 2 items)"""
        print("\n🧪 Test 4: GET /api/favorites (with 2 items)")
        try:
            async with self.session.get(f"{BASE_URL}/favorites", headers=self.headers) as response:
                status = response.status
                data = await response.json()
                
                print(f"Status: {status}")
                print(f"Response: {json.dumps(data, indent=2)}")
                
                if status == 200:
                    favorites = data.get("favorites", [])
                    if len(favorites) == 2:
                        # Check if both foods are present
                        food_names = [fav.get("food_name") for fav in favorites]
                        fdc_ids = [fav.get("fdc_id") for fav in favorites]
                        
                        if "Chicken Breast" in food_names and "Banana" in food_names:
                            if 170567 in fdc_ids and 173944 in fdc_ids:
                                print("✅ PASS: Both favorites returned with correct food_name and fdc_id")
                                return True
                            else:
                                print(f"❌ FAIL: Missing expected fdc_ids. Got: {fdc_ids}")
                                return False
                        else:
                            print(f"❌ FAIL: Missing expected food names. Got: {food_names}")
                            return False
                    else:
                        print(f"❌ FAIL: Expected 2 favorites, got {len(favorites)}")
                        return False
                else:
                    print(f"❌ FAIL: Expected 200, got {status}: {data}")
                    return False
                    
        except Exception as e:
            print(f"❌ FAIL: Exception occurred: {e}")
            return False

    async def test_delete_favorite_chicken(self):
        """Test 5: DELETE /api/favorites/170567 - Remove Chicken from favorites"""
        print("\n🧪 Test 5: DELETE /api/favorites/170567 (Remove Chicken)")
        try:
            async with self.session.delete(f"{BASE_URL}/favorites/170567", headers=self.headers) as response:
                status = response.status
                data = await response.json()
                
                print(f"Status: {status}")
                print(f"Response: {json.dumps(data, indent=2)}")
                
                if status == 200 and data.get("message") == "Removed from favorites":
                    print("✅ PASS: Chicken Breast removed from favorites")
                    return True
                else:
                    print(f"❌ FAIL: Expected 200 with 'Removed from favorites', got {status}: {data}")
                    return False
                    
        except Exception as e:
            print(f"❌ FAIL: Exception occurred: {e}")
            return False

    async def test_get_favorites_one_remaining(self):
        """Test 6: GET /api/favorites - Verify only 1 remains (Banana)"""
        print("\n🧪 Test 6: GET /api/favorites (verify only Banana remains)")
        try:
            async with self.session.get(f"{BASE_URL}/favorites", headers=self.headers) as response:
                status = response.status
                data = await response.json()
                
                print(f"Status: {status}")
                print(f"Response: {json.dumps(data, indent=2)}")
                
                if status == 200:
                    favorites = data.get("favorites", [])
                    if len(favorites) == 1:
                        favorite = favorites[0]
                        if favorite.get("food_name") == "Banana" and favorite.get("fdc_id") == 173944:
                            print("✅ PASS: Only Banana remains in favorites")
                            return True
                        else:
                            print(f"❌ FAIL: Expected Banana (173944), got {favorite.get('food_name')} ({favorite.get('fdc_id')})")
                            return False
                    else:
                        print(f"❌ FAIL: Expected 1 favorite, got {len(favorites)}")
                        return False
                else:
                    print(f"❌ FAIL: Expected 200, got {status}: {data}")
                    return False
                    
        except Exception as e:
            print(f"❌ FAIL: Exception occurred: {e}")
            return False

    async def test_get_recent_foods(self):
        """Test 7: GET /api/foods/recent - Get recent foods"""
        print("\n🧪 Test 7: GET /api/foods/recent")
        try:
            async with self.session.get(f"{BASE_URL}/foods/recent", headers=self.headers) as response:
                status = response.status
                data = await response.json()
                
                print(f"Status: {status}")
                print(f"Response: {json.dumps(data, indent=2)}")
                
                if status == 200 and "recent_foods" in data:
                    print("✅ PASS: Recent foods endpoint working")
                    return True
                else:
                    print(f"❌ FAIL: Expected 200 with recent_foods, got {status}: {data}")
                    return False
                    
        except Exception as e:
            print(f"❌ FAIL: Exception occurred: {e}")
            return False

    async def run_all_tests(self):
        """Run all favorites tests in sequence"""
        print("🚀 Starting NutriOS Favorites Endpoints Test")
        print(f"Backend URL: {BASE_URL}")
        print(f"Test User: {self.test_user_id}")
        print(f"Session Token: {self.test_session_token}")
        
        await self.setup()
        
        try:
            # Setup test user
            await self.create_test_user()
            
            # Run test sequence
            tests = [
                ("Get Empty Favorites", self.test_get_favorites_empty),
                ("Add Chicken Breast", self.test_add_favorite_chicken),
                ("Add Banana", self.test_add_favorite_banana),
                ("Get Favorites (2 items)", self.test_get_favorites_with_items),
                ("Delete Chicken Breast", self.test_delete_favorite_chicken),
                ("Get Favorites (1 item)", self.test_get_favorites_one_remaining),
                ("Get Recent Foods", self.test_get_recent_foods),
            ]
            
            results = []
            for test_name, test_func in tests:
                result = await test_func()
                results.append((test_name, result))
            
            # Summary
            print("\n" + "="*60)
            print("📊 TEST RESULTS SUMMARY")
            print("="*60)
            
            passed = 0
            total = len(results)
            
            for test_name, result in results:
                status = "✅ PASS" if result else "❌ FAIL"
                print(f"{status} {test_name}")
                if result:
                    passed += 1
            
            print(f"\n🎯 Overall: {passed}/{total} tests passed ({(passed/total)*100:.1f}%)")
            
            if passed == total:
                print("🎉 ALL TESTS PASSED - Favorites endpoints are working correctly!")
            else:
                print("⚠️ Some tests failed - see details above")
                
        except Exception as e:
            print(f"💥 Test suite failed with exception: {e}")
        finally:
            await self.cleanup()

async def main():
    """Main test runner"""
    tester = FavoritesTester()
    await tester.run_all_tests()

if __name__ == "__main__":
    asyncio.run(main())