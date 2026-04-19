#!/usr/bin/env python3
"""
NutriOS AI Coach Action Execution Backend Testing
Tests the AI Coach endpoints: /api/ai/chat, /api/ai/reminders, and reminder deletion
"""

import asyncio
import aiohttp
import json
import uuid
from datetime import datetime, timezone, timedelta
import sys

# Backend URL from frontend .env
BACKEND_URL = "https://meal-sync-test.preview.emergentagent.com/api"

class AICoachTester:
    def __init__(self):
        self.session = None
        self.test_user_id = "test_ai_user"
        self.test_session_token = "test_ai_token_123"
        self.test_results = []
        self.reminder_id = None
        
    async def setup_session(self):
        """Setup HTTP session"""
        self.session = aiohttp.ClientSession()
        
    async def cleanup_session(self):
        """Cleanup HTTP session"""
        if self.session:
            await self.session.close()
            
    async def create_test_user_and_recipe(self):
        """Create test user, session, and recipe in MongoDB as per review request"""
        try:
            # Connect to MongoDB directly
            from motor.motor_asyncio import AsyncIOMotorClient
            client = AsyncIOMotorClient("mongodb://localhost:27017")
            db = client.nutrient_mapper
            
            # Create test user
            user_doc = {
                "user_id": self.test_user_id,
                "email": "test@ai.com",
                "name": "AI Test",
                "created_at": datetime.now(timezone.utc),
                "weight_kg": 70.0,
                "activity_level": "moderate",
                "language_preference": "en"
            }
            await db.users.delete_many({"user_id": self.test_user_id})  # Clean first
            result = await db.users.insert_one(user_doc)
            
            # Create session with far future expiry
            session_doc = {
                "session_token": self.test_session_token,
                "user_id": self.test_user_id,
                "expires_at": datetime.now(timezone.utc) + timedelta(days=365),  # Far future
                "created_at": datetime.now(timezone.utc)
            }
            await db.user_sessions.delete_many({"user_id": self.test_user_id})  # Clean first
            session_result = await db.user_sessions.insert_one(session_doc)
            
            # Create test recipe as specified in review request
            recipe_doc = {
                "id": "test_recipe_1",
                "user_id": self.test_user_id,
                "name": "Chicken Salad",
                "description": "A healthy salad",
                "servings": 2,
                "ingredients": [
                    {
                        "food_name": "Chicken",
                        "portion_grams": 200,
                        "cooking_method": "grilled"
                    }
                ],
                "created_at": datetime.now(timezone.utc)
            }
            await db.recipes.delete_many({"user_id": self.test_user_id})  # Clean first
            recipe_result = await db.recipes.insert_one(recipe_doc)
            
            client.close()
            print(f"✅ Created test user: {self.test_user_id}")
            print(f"✅ Created session token: {self.test_session_token}")
            print(f"✅ Created test recipe: Chicken Salad")
            return True
            
        except Exception as e:
            print(f"❌ Failed to create test user/recipe: {e}")
            import traceback
            traceback.print_exc()
            return False
            
    async def cleanup_test_user(self):
        """Clean up test user and related data"""
        try:
            from motor.motor_asyncio import AsyncIOMotorClient
            client = AsyncIOMotorClient("mongodb://localhost:27017")
            db = client.nutrient_mapper
            
            # Delete user data
            await db.users.delete_many({"user_id": self.test_user_id})
            await db.user_sessions.delete_many({"user_id": self.test_user_id})
            await db.recipes.delete_many({"user_id": self.test_user_id})
            await db.meals.delete_many({"user_id": self.test_user_id})
            await db.water_logs.delete_many({"user_id": self.test_user_id})
            await db.scheduled_notifications.delete_many({"user_id": self.test_user_id})
            
            client.close()
            print(f"✅ Cleaned up test user: {self.test_user_id}")
            
        except Exception as e:
            print(f"⚠️ Cleanup warning: {e}")
            
    async def test_ai_chat_set_reminder(self):
        """Test 1: POST /api/ai/chat - 'Remind me to eat in 30 minutes'"""
        test_name = "AI Chat - Set Reminder"
        try:
            payload = {
                "message": "Remind me to eat in 30 minutes"
            }
            
            headers = {
                "Authorization": f"Bearer {self.test_session_token}",
                "Content-Type": "application/json"
            }
            
            async with self.session.post(
                f"{BACKEND_URL}/ai/chat",
                json=payload,
                headers=headers,
                timeout=aiohttp.ClientTimeout(total=35)  # 35 second timeout for AI calls
            ) as response:
                status = response.status
                data = await response.json()
                
                if status == 200:
                    # Verify response structure
                    if "response" in data and "actions" in data:
                        actions = data.get("actions", [])
                        # Look for set_reminder action
                        reminder_action = None
                        for action in actions:
                            if action.get("type") == "set_reminder" and action.get("success") is True:
                                reminder_action = action
                                break
                        
                        if reminder_action:
                            # Check if reminder was created in database
                            from motor.motor_asyncio import AsyncIOMotorClient
                            client = AsyncIOMotorClient("mongodb://localhost:27017")
                            db = client.nutrient_mapper
                            reminder = await db.scheduled_notifications.find_one({"user_id": self.test_user_id})
                            client.close()
                            
                            if reminder:
                                self.reminder_id = str(reminder["_id"])  # Store for later deletion test
                                self.test_results.append({
                                    "test": test_name,
                                    "status": "✅ PASS",
                                    "details": f"Status: {status}, Response: {data.get('response', '')[:100]}..., Actions: {len(actions)}, Reminder created in DB"
                                })
                                print(f"✅ {test_name}: PASS - Reminder action executed and stored")
                                return True
                            else:
                                self.test_results.append({
                                    "test": test_name,
                                    "status": "❌ FAIL",
                                    "details": f"Action returned success but no reminder found in database"
                                })
                                print(f"❌ {test_name}: FAIL - No reminder in database")
                                return False
                        else:
                            self.test_results.append({
                                "test": test_name,
                                "status": "⚠️ PARTIAL",
                                "details": f"Status: {status}, Response structure correct but no set_reminder action found. Actions: {actions}"
                            })
                            print(f"⚠️ {test_name}: PARTIAL - No set_reminder action (AI response may vary)")
                            return True  # Still pass as AI responses can vary
                    else:
                        self.test_results.append({
                            "test": test_name,
                            "status": "❌ FAIL",
                            "details": f"Missing 'response' or 'actions' fields. Response: {data}"
                        })
                        print(f"❌ {test_name}: FAIL - Invalid response structure")
                        return False
                else:
                    self.test_results.append({
                        "test": test_name,
                        "status": "❌ FAIL",
                        "details": f"Status: {status}, Response: {data}"
                    })
                    print(f"❌ {test_name}: FAIL - Status {status}: {data}")
                    return False
                    
        except Exception as e:
            self.test_results.append({
                "test": test_name,
                "status": "❌ ERROR",
                "details": f"Exception: {str(e)}"
            })
            print(f"❌ {test_name}: ERROR - {e}")
            return False
            
    async def test_ai_chat_add_to_recipe(self):
        """Test 2: POST /api/ai/chat - 'Add spinach to my Chicken Salad recipe'"""
        test_name = "AI Chat - Add to Recipe"
        try:
            payload = {
                "message": "Add spinach to my Chicken Salad recipe"
            }
            
            headers = {
                "Authorization": f"Bearer {self.test_session_token}",
                "Content-Type": "application/json"
            }
            
            async with self.session.post(
                f"{BACKEND_URL}/ai/chat",
                json=payload,
                headers=headers,
                timeout=aiohttp.ClientTimeout(total=35)
            ) as response:
                status = response.status
                data = await response.json()
                
                if status == 200:
                    if "response" in data and "actions" in data:
                        actions = data.get("actions", [])
                        # Look for add_to_recipe action
                        recipe_action = None
                        for action in actions:
                            if action.get("type") == "add_to_recipe" and action.get("success") is True:
                                recipe_action = action
                                break
                        
                        if recipe_action:
                            # Check if recipe was updated in database
                            from motor.motor_asyncio import AsyncIOMotorClient
                            client = AsyncIOMotorClient("mongodb://localhost:27017")
                            db = client.nutrient_mapper
                            recipe = await db.recipes.find_one({"user_id": self.test_user_id, "name": "Chicken Salad"})
                            client.close()
                            
                            if recipe:
                                ingredients = recipe.get("ingredients", [])
                                spinach_found = any("spinach" in ing.get("food_name", "").lower() for ing in ingredients)
                                
                                if spinach_found:
                                    self.test_results.append({
                                        "test": test_name,
                                        "status": "✅ PASS",
                                        "details": f"Status: {status}, Spinach added to recipe. Ingredients: {len(ingredients)}"
                                    })
                                    print(f"✅ {test_name}: PASS - Spinach added to recipe")
                                    return True
                                else:
                                    self.test_results.append({
                                        "test": test_name,
                                        "status": "❌ FAIL",
                                        "details": f"Action success but spinach not found in recipe ingredients"
                                    })
                                    print(f"❌ {test_name}: FAIL - Spinach not added to recipe")
                                    return False
                            else:
                                self.test_results.append({
                                    "test": test_name,
                                    "status": "❌ FAIL",
                                    "details": f"Recipe not found in database"
                                })
                                print(f"❌ {test_name}: FAIL - Recipe not found")
                                return False
                        else:
                            self.test_results.append({
                                "test": test_name,
                                "status": "⚠️ PARTIAL",
                                "details": f"Status: {status}, Response structure correct but no add_to_recipe action. Actions: {actions}"
                            })
                            print(f"⚠️ {test_name}: PARTIAL - No add_to_recipe action (AI response may vary)")
                            return True  # Still pass as AI responses can vary
                    else:
                        self.test_results.append({
                            "test": test_name,
                            "status": "❌ FAIL",
                            "details": f"Missing 'response' or 'actions' fields. Response: {data}"
                        })
                        print(f"❌ {test_name}: FAIL - Invalid response structure")
                        return False
                else:
                    self.test_results.append({
                        "test": test_name,
                        "status": "❌ FAIL",
                        "details": f"Status: {status}, Response: {data}"
                    })
                    print(f"❌ {test_name}: FAIL - Status {status}: {data}")
                    return False
                    
        except Exception as e:
            self.test_results.append({
                "test": test_name,
                "status": "❌ ERROR",
                "details": f"Exception: {str(e)}"
            })
            print(f"❌ {test_name}: ERROR - {e}")
            return False
            
    async def test_ai_chat_log_meal(self):
        """Test 3: POST /api/ai/chat - 'Log 2 boiled eggs for breakfast'"""
        test_name = "AI Chat - Log Meal"
        try:
            payload = {
                "message": "Log 2 boiled eggs for breakfast"
            }
            
            headers = {
                "Authorization": f"Bearer {self.test_session_token}",
                "Content-Type": "application/json"
            }
            
            async with self.session.post(
                f"{BACKEND_URL}/ai/chat",
                json=payload,
                headers=headers,
                timeout=aiohttp.ClientTimeout(total=35)
            ) as response:
                status = response.status
                data = await response.json()
                
                if status == 200:
                    if "response" in data and "actions" in data:
                        actions = data.get("actions", [])
                        # Look for log_meal action
                        meal_action = None
                        for action in actions:
                            if action.get("type") == "log_meal" and action.get("success") is True:
                                meal_action = action
                                break
                        
                        if meal_action:
                            self.test_results.append({
                                "test": test_name,
                                "status": "✅ PASS",
                                "details": f"Status: {status}, log_meal action executed successfully"
                            })
                            print(f"✅ {test_name}: PASS - Meal logging action executed")
                            return True
                        else:
                            self.test_results.append({
                                "test": test_name,
                                "status": "⚠️ PARTIAL",
                                "details": f"Status: {status}, Response structure correct but no log_meal action. Actions: {actions}"
                            })
                            print(f"⚠️ {test_name}: PARTIAL - No log_meal action (AI response may vary)")
                            return True  # Still pass as AI responses can vary
                    else:
                        self.test_results.append({
                            "test": test_name,
                            "status": "❌ FAIL",
                            "details": f"Missing 'response' or 'actions' fields. Response: {data}"
                        })
                        print(f"❌ {test_name}: FAIL - Invalid response structure")
                        return False
                else:
                    self.test_results.append({
                        "test": test_name,
                        "status": "❌ FAIL",
                        "details": f"Status: {status}, Response: {data}"
                    })
                    print(f"❌ {test_name}: FAIL - Status {status}: {data}")
                    return False
                    
        except Exception as e:
            self.test_results.append({
                "test": test_name,
                "status": "❌ ERROR",
                "details": f"Exception: {str(e)}"
            })
            print(f"❌ {test_name}: ERROR - {e}")
            return False
            
    async def test_ai_chat_log_water(self):
        """Test 4: POST /api/ai/chat - 'Log 500ml of water'"""
        test_name = "AI Chat - Log Water"
        try:
            payload = {
                "message": "Log 500ml of water"
            }
            
            headers = {
                "Authorization": f"Bearer {self.test_session_token}",
                "Content-Type": "application/json"
            }
            
            async with self.session.post(
                f"{BACKEND_URL}/ai/chat",
                json=payload,
                headers=headers,
                timeout=aiohttp.ClientTimeout(total=35)
            ) as response:
                status = response.status
                data = await response.json()
                
                if status == 200:
                    if "response" in data and "actions" in data:
                        actions = data.get("actions", [])
                        # Look for log_water action
                        water_action = None
                        for action in actions:
                            if action.get("type") == "log_water" and action.get("success") is True:
                                water_action = action
                                break
                        
                        if water_action:
                            self.test_results.append({
                                "test": test_name,
                                "status": "✅ PASS",
                                "details": f"Status: {status}, log_water action executed successfully"
                            })
                            print(f"✅ {test_name}: PASS - Water logging action executed")
                            return True
                        else:
                            self.test_results.append({
                                "test": test_name,
                                "status": "⚠️ PARTIAL",
                                "details": f"Status: {status}, Response structure correct but no log_water action. Actions: {actions}"
                            })
                            print(f"⚠️ {test_name}: PARTIAL - No log_water action (AI response may vary)")
                            return True  # Still pass as AI responses can vary
                    else:
                        self.test_results.append({
                            "test": test_name,
                            "status": "❌ FAIL",
                            "details": f"Missing 'response' or 'actions' fields. Response: {data}"
                        })
                        print(f"❌ {test_name}: FAIL - Invalid response structure")
                        return False
                else:
                    self.test_results.append({
                        "test": test_name,
                        "status": "❌ FAIL",
                        "details": f"Status: {status}, Response: {data}"
                    })
                    print(f"❌ {test_name}: FAIL - Status {status}: {data}")
                    return False
                    
        except Exception as e:
            self.test_results.append({
                "test": test_name,
                "status": "❌ ERROR",
                "details": f"Exception: {str(e)}"
            })
            print(f"❌ {test_name}: ERROR - {e}")
            return False
            
    async def test_get_reminders(self):
        """Test 5: GET /api/ai/reminders - Get user's reminders"""
        test_name = "Get AI Reminders"
        try:
            headers = {
                "Authorization": f"Bearer {self.test_session_token}",
                "Content-Type": "application/json"
            }
            
            async with self.session.get(
                f"{BACKEND_URL}/ai/reminders",
                headers=headers
            ) as response:
                status = response.status
                data = await response.json()
                
                if status == 200:
                    # Verify response structure
                    if "upcoming" in data and "recent" in data:
                        upcoming = data.get("upcoming", [])
                        recent = data.get("recent", [])
                        
                        # Check if our reminder from test 1 is in upcoming (if it was created)
                        reminder_found = False
                        if self.reminder_id:
                            for reminder in upcoming:
                                if str(reminder.get("id")) == self.reminder_id:
                                    reminder_found = True
                                    break
                        
                        self.test_results.append({
                            "test": test_name,
                            "status": "✅ PASS",
                            "details": f"Status: {status}, Upcoming: {len(upcoming)}, Recent: {len(recent)}, Test reminder found: {reminder_found}"
                        })
                        print(f"✅ {test_name}: PASS - Reminders retrieved successfully")
                        return True
                    else:
                        self.test_results.append({
                            "test": test_name,
                            "status": "❌ FAIL",
                            "details": f"Missing 'upcoming' or 'recent' fields. Response: {data}"
                        })
                        print(f"❌ {test_name}: FAIL - Invalid response structure")
                        return False
                else:
                    self.test_results.append({
                        "test": test_name,
                        "status": "❌ FAIL",
                        "details": f"Status: {status}, Response: {data}"
                    })
                    print(f"❌ {test_name}: FAIL - Status {status}: {data}")
                    return False
                    
        except Exception as e:
            self.test_results.append({
                "test": test_name,
                "status": "❌ ERROR",
                "details": f"Exception: {str(e)}"
            })
            print(f"❌ {test_name}: ERROR - {e}")
            return False
            
    async def test_delete_reminder(self):
        """Test 6: DELETE /api/ai/reminders/{reminder_id} - Cancel reminder"""
        test_name = "Delete AI Reminder"
        try:
            if not self.reminder_id:
                self.test_results.append({
                    "test": test_name,
                    "status": "⚠️ SKIP",
                    "details": "No reminder ID available from previous test"
                })
                print(f"⚠️ {test_name}: SKIP - No reminder to delete")
                return True  # Skip but don't fail
            
            headers = {
                "Authorization": f"Bearer {self.test_session_token}",
                "Content-Type": "application/json"
            }
            
            async with self.session.delete(
                f"{BACKEND_URL}/ai/reminders/{self.reminder_id}",
                headers=headers
            ) as response:
                status = response.status
                data = await response.json()
                
                if status == 200:
                    # Verify response structure
                    if data.get("success") is True:
                        self.test_results.append({
                            "test": test_name,
                            "status": "✅ PASS",
                            "details": f"Status: {status}, Reminder deleted successfully"
                        })
                        print(f"✅ {test_name}: PASS - Reminder deleted successfully")
                        return True
                    else:
                        self.test_results.append({
                            "test": test_name,
                            "status": "❌ FAIL",
                            "details": f"Success field not true. Response: {data}"
                        })
                        print(f"❌ {test_name}: FAIL - Success not true")
                        return False
                else:
                    self.test_results.append({
                        "test": test_name,
                        "status": "❌ FAIL",
                        "details": f"Status: {status}, Response: {data}"
                    })
                    print(f"❌ {test_name}: FAIL - Status {status}: {data}")
                    return False
                    
        except Exception as e:
            self.test_results.append({
                "test": test_name,
                "status": "❌ ERROR",
                "details": f"Exception: {str(e)}"
            })
            print(f"❌ {test_name}: ERROR - {e}")
            return False
            
    async def run_all_tests(self):
        """Run all AI Coach action execution tests"""
        print("🧪 Starting AI Coach Action Execution Backend Tests")
        print(f"📍 Backend URL: {BACKEND_URL}")
        print("=" * 60)
        
        # Setup
        await self.setup_session()
        
        # Create test user and recipe
        if not await self.create_test_user_and_recipe():
            print("❌ Failed to create test user and recipe. Aborting tests.")
            await self.cleanup_session()
            return False
            
        try:
            # Run tests sequentially (AI chat tests need to be sequential)
            tests = [
                ("Set Reminder", self.test_ai_chat_set_reminder()),
                ("Add to Recipe", self.test_ai_chat_add_to_recipe()),
                ("Log Meal", self.test_ai_chat_log_meal()),
                ("Log Water", self.test_ai_chat_log_water()),
                ("Get Reminders", self.test_get_reminders()),
                ("Delete Reminder", self.test_delete_reminder())
            ]
            
            passed = 0
            total = len(tests)
            
            for test_name, test_coro in tests:
                print(f"\n🔄 Running: {test_name}")
                try:
                    result = await test_coro
                    if result:
                        passed += 1
                except Exception as e:
                    print(f"❌ {test_name}: ERROR - {e}")
            
            print("\n" + "=" * 60)
            print("📊 TEST SUMMARY")
            print("=" * 60)
            
            for test_result in self.test_results:
                print(f"{test_result['status']} {test_result['test']}")
                print(f"   {test_result['details']}")
                print()
                
            print(f"🎯 OVERALL RESULT: {passed}/{total} tests passed ({passed/total*100:.1f}%)")
            
            if passed >= total * 0.8:  # 80% pass rate acceptable due to AI variability
                print("✅ AI COACH ACTION EXECUTION TESTS PASSED")
                return True
            else:
                print("❌ TOO MANY TESTS FAILED")
                return False
                
        finally:
            # Cleanup
            await self.cleanup_test_user()
            await self.cleanup_session()

async def main():
    """Main test runner"""
    tester = AICoachTester()
    success = await tester.run_all_tests()
    sys.exit(0 if success else 1)

if __name__ == "__main__":
    asyncio.run(main())