#!/usr/bin/env python3
"""
NutriOS Body State Engine and Synergies/Conflicts Backend Testing
Tests the Body State Engine and Synergies/Conflicts endpoints as per review request
"""

import asyncio
import aiohttp
import json
import uuid
from datetime import datetime, timezone, timedelta
import sys

# Backend URL from frontend .env
BACKEND_URL = "https://meal-sync-test.preview.emergentagent.com/api"

class BodyStateTester:
    def __init__(self):
        self.session = None
        self.test_user_id = "test_bodystate_user"
        self.test_session_token = "test_bs_token"
        self.test_user_id_empty = "test_bs_empty"
        self.test_session_token_empty = "test_bs_empty_token"
        self.test_results = []
        
    async def setup_session(self):
        """Setup HTTP session"""
        self.session = aiohttp.ClientSession()
        
    async def cleanup_session(self):
        """Cleanup HTTP session"""
        if self.session:
            await self.session.close()
            
    async def create_test_users(self):
        """Create test users and sessions as per review request setup"""
        try:
            # Connect to MongoDB directly
            from motor.motor_asyncio import AsyncIOMotorClient
            client = AsyncIOMotorClient("mongodb://localhost:27017")
            db = client.nutrient_mapper
            
            # Create main test user with specific data from review request
            user_doc = {
                "user_id": self.test_user_id,
                "email": "test@bs.com",
                "name": "Body Test",
                "weight_kg": 75,
                "height_cm": 175,
                "age": 32,
                "sex": "male",
                "activity_level": "moderate",
                "sleep_hours": 7,
                "diet_type": "standard",
                "health_goals": ["muscle_gain"],
                "created_at": datetime.now(timezone.utc)
            }
            await db.users.insert_one(user_doc)
            
            # Create session with far future expiry
            session_doc = {
                "session_token": self.test_session_token,
                "user_id": self.test_user_id,
                "expires_at": datetime.now(timezone.utc) + timedelta(days=365),
                "created_at": datetime.now(timezone.utc)
            }
            await db.user_sessions.insert_one(session_doc)
            
            # Create empty user for no-meals test
            user_doc_empty = {
                "user_id": self.test_user_id_empty,
                "email": "test@empty.com",
                "name": "Empty Test User",
                "weight_kg": 70,
                "height_cm": 170,
                "age": 30,
                "sex": "female",
                "activity_level": "moderate",
                "sleep_hours": 7,
                "health_goals": ["weight_loss"],
                "created_at": datetime.now(timezone.utc)
            }
            await db.users.insert_one(user_doc_empty)
            
            # Create session for empty user
            session_doc_empty = {
                "session_token": self.test_session_token_empty,
                "user_id": self.test_user_id_empty,
                "expires_at": datetime.now(timezone.utc) + timedelta(days=365),
                "created_at": datetime.now(timezone.utc)
            }
            await db.user_sessions.insert_one(session_doc_empty)
            
            # Insert test meals for today with nutrients as per review request
            today = datetime.now(timezone.utc).replace(hour=12, minute=0, second=0, microsecond=0)
            
            meal1 = {
                "id": "bs_meal1",
                "user_id": self.test_user_id,
                "date": today.strftime("%Y-%m-%d"),
                "food_name": "Chicken breast",
                "portion_grams": 200,
                "meal_type": "lunch",
                "nutrients": {
                    "energy_kcal": 330,
                    "protein_g": 62,
                    "carbohydrate_g": 0,
                    "fat_g": 7,
                    "fiber_g": 0,
                    "sugars_g": 0,
                    "iron_mg": 1.5,
                    "magnesium_mg": 40,
                    "vitamin_c_mg": 0,
                    "calcium_mg": 15,
                    "zinc_mg": 2.5,
                    "vitamin_b6_mg": 0.8
                },
                "logged_at": today
            }
            await db.meals.insert_one(meal1)
            
            meal2 = {
                "id": "bs_meal2",
                "user_id": self.test_user_id,
                "date": today.strftime("%Y-%m-%d"),
                "food_name": "Spinach salad with lemon",
                "portion_grams": 150,
                "meal_type": "lunch",
                "nutrients": {
                    "energy_kcal": 35,
                    "protein_g": 4.3,
                    "carbohydrate_g": 5.5,
                    "fat_g": 0.6,
                    "fiber_g": 3.3,
                    "sugars_g": 0.6,
                    "iron_mg": 4.1,
                    "magnesium_mg": 120,
                    "vitamin_c_mg": 42,
                    "calcium_mg": 149,
                    "zinc_mg": 0.8,
                    "vitamin_b6_mg": 0.3
                },
                "logged_at": today
            }
            await db.meals.insert_one(meal2)
            
            client.close()
            print(f"✅ Created test user: {self.test_user_id}")
            print(f"✅ Created session token: {self.test_session_token}")
            print(f"✅ Created empty user: {self.test_user_id_empty}")
            print(f"✅ Inserted 2 test meals with vitamin C + iron synergy")
            return True
            
        except Exception as e:
            print(f"❌ Failed to create test users: {e}")
            import traceback
            traceback.print_exc()
            return False
            
    async def cleanup_test_users(self):
        """Clean up test users and related data"""
        try:
            from motor.motor_asyncio import AsyncIOMotorClient
            client = AsyncIOMotorClient("mongodb://localhost:27017")
            db = client.nutrient_mapper
            
            # Delete all test data
            await db.users.delete_many({"user_id": {"$in": [self.test_user_id, self.test_user_id_empty]}})
            await db.user_sessions.delete_many({"user_id": {"$in": [self.test_user_id, self.test_user_id_empty]}})
            await db.meals.delete_many({"user_id": {"$in": [self.test_user_id, self.test_user_id_empty]}})
            
            client.close()
            print(f"✅ Cleaned up test users and data")
            
        except Exception as e:
            print(f"⚠️ Cleanup warning: {e}")
            
    async def test_body_state_main(self):
        """Test 1: GET /api/body-state - Main body state endpoint"""
        test_name = "GET /api/body-state - Main body state endpoint"
        try:
            headers = {
                "Authorization": f"Bearer {self.test_session_token}",
                "Content-Type": "application/json"
            }
            
            async with self.session.get(
                f"{BACKEND_URL}/body-state",
                headers=headers
            ) as response:
                status = response.status
                data = await response.json()
                
                if status == 200:
                    # Verify response structure
                    required_fields = ["body_state", "decisions", "synergies", "conflicts", "nutrient_totals", "meals_count"]
                    missing_fields = [field for field in required_fields if field not in data]
                    
                    # Verify body_state structure
                    body_state_fields = ["energy", "glycemic_stability", "concentration", "hunger", "recovery"]
                    body_state = data.get("body_state", {})
                    missing_body_state = [field for field in body_state_fields if field not in body_state]
                    
                    # Verify energy structure
                    energy = body_state.get("energy", {})
                    energy_fields = ["level", "score", "prediction"]
                    missing_energy = [field for field in energy_fields if field not in energy]
                    
                    # Verify decisions structure
                    decisions = data.get("decisions", [])
                    decisions_valid = True
                    if decisions and isinstance(decisions, list):
                        for decision in decisions[:1]:  # Check first decision
                            decision_fields = ["priority", "action", "reason", "icon"]
                            if not all(field in decision for field in decision_fields):
                                decisions_valid = False
                                break
                    
                    # Verify meals count
                    meals_count = data.get("meals_count", 0)
                    
                    # Check for vitamin C + iron synergy
                    synergies = data.get("synergies", [])
                    vitc_iron_synergy = any(
                        syn.get("id") == "vitc_iron" for syn in synergies
                    )
                    
                    if (not missing_fields and not missing_body_state and not missing_energy 
                        and decisions_valid and meals_count == 2 and vitc_iron_synergy):
                        self.test_results.append({
                            "test": test_name,
                            "status": "✅ PASS",
                            "details": f"Status: {status}, Meals: {meals_count}, Energy: {energy.get('level')}, Synergies: {len(synergies)}, VitC+Iron synergy detected: {vitc_iron_synergy}"
                        })
                        print(f"✅ {test_name}: PASS - Complete body state analysis with synergy detection")
                        return True
                    else:
                        self.test_results.append({
                            "test": test_name,
                            "status": "❌ FAIL",
                            "details": f"Missing fields: {missing_fields}, Body state: {missing_body_state}, Energy: {missing_energy}, Decisions valid: {decisions_valid}, Meals: {meals_count}, VitC+Iron synergy: {vitc_iron_synergy}"
                        })
                        print(f"❌ {test_name}: FAIL - Structure validation failed")
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
            
    async def test_synergies_conflicts_standalone(self):
        """Test 2: GET /api/nutrients/synergies-conflicts - Standalone synergies/conflicts"""
        test_name = "GET /api/nutrients/synergies-conflicts - Standalone endpoint"
        try:
            headers = {
                "Authorization": f"Bearer {self.test_session_token}",
                "Content-Type": "application/json"
            }
            
            async with self.session.get(
                f"{BACKEND_URL}/nutrients/synergies-conflicts",
                headers=headers
            ) as response:
                status = response.status
                data = await response.json()
                
                if status == 200:
                    # Verify response structure
                    required_fields = ["active_synergies", "active_conflicts", "all_synergies", "all_conflicts", "meals_analyzed"]
                    missing_fields = [field for field in required_fields if field not in data]
                    
                    # Verify knowledge base sizes
                    all_synergies = data.get("all_synergies", [])
                    all_conflicts = data.get("all_conflicts", [])
                    active_synergies = data.get("active_synergies", [])
                    meals_analyzed = data.get("meals_analyzed", 0)
                    
                    # Check for vitamin C + iron synergy in active synergies
                    vitc_iron_active = any(
                        syn.get("id") == "vitc_iron" for syn in active_synergies
                    )
                    
                    if (not missing_fields and len(all_synergies) == 8 and len(all_conflicts) == 5 
                        and meals_analyzed == 2 and vitc_iron_active):
                        self.test_results.append({
                            "test": test_name,
                            "status": "✅ PASS",
                            "details": f"Status: {status}, All synergies: {len(all_synergies)}, All conflicts: {len(all_conflicts)}, Active synergies: {len(active_synergies)}, Meals analyzed: {meals_analyzed}, VitC+Iron active: {vitc_iron_active}"
                        })
                        print(f"✅ {test_name}: PASS - Knowledge base and active detection working")
                        return True
                    else:
                        self.test_results.append({
                            "test": test_name,
                            "status": "❌ FAIL",
                            "details": f"Missing fields: {missing_fields}, All synergies: {len(all_synergies)}/8, All conflicts: {len(all_conflicts)}/5, Meals: {meals_analyzed}/2, VitC+Iron active: {vitc_iron_active}"
                        })
                        print(f"❌ {test_name}: FAIL - Knowledge base or detection failed")
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
            
    async def test_body_state_no_meals(self):
        """Test 3: GET /api/body-state with no meals (different user)"""
        test_name = "GET /api/body-state - No meals user"
        try:
            headers = {
                "Authorization": f"Bearer {self.test_session_token_empty}",
                "Content-Type": "application/json"
            }
            
            async with self.session.get(
                f"{BACKEND_URL}/body-state",
                headers=headers
            ) as response:
                status = response.status
                data = await response.json()
                
                if status == 200:
                    # Verify graceful response with no meals
                    meals_count = data.get("meals_count", -1)
                    decisions = data.get("decisions", [])
                    
                    # Check if decisions suggest logging first meal
                    first_meal_suggestion = any(
                        "first meal" in decision.get("action", "").lower() or 
                        "log" in decision.get("action", "").lower() or
                        "eat a balanced meal" in decision.get("action", "").lower() or
                        "eat" in decision.get("action", "").lower()
                        for decision in decisions
                    )
                    
                    if meals_count == 0 and first_meal_suggestion:
                        self.test_results.append({
                            "test": test_name,
                            "status": "✅ PASS",
                            "details": f"Status: {status}, Meals: {meals_count}, First meal suggestion: {first_meal_suggestion}, Decisions: {len(decisions)}"
                        })
                        print(f"✅ {test_name}: PASS - Graceful handling of no meals with appropriate suggestions")
                        return True
                    else:
                        self.test_results.append({
                            "test": test_name,
                            "status": "❌ FAIL",
                            "details": f"Meals: {meals_count}, First meal suggestion: {first_meal_suggestion}, Decisions: {decisions}"
                        })
                        print(f"❌ {test_name}: FAIL - No meals handling not working properly")
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
        """Run all Body State Engine tests"""
        print("🧪 Starting Body State Engine and Synergies/Conflicts Backend Tests")
        print(f"📍 Backend URL: {BACKEND_URL}")
        print("=" * 70)
        
        # Setup
        await self.setup_session()
        
        # Create test users and data
        if not await self.create_test_users():
            print("❌ Failed to create test users. Aborting tests.")
            await self.cleanup_session()
            return False
            
        try:
            # Run tests
            tests = [
                self.test_body_state_main(),
                self.test_synergies_conflicts_standalone(),
                self.test_body_state_no_meals()
            ]
            
            results = await asyncio.gather(*tests, return_exceptions=True)
            
            # Count results
            passed = sum(1 for result in results if result is True)
            total = len(tests)
            
            print("\n" + "=" * 70)
            print("📊 TEST SUMMARY")
            print("=" * 70)
            
            for test_result in self.test_results:
                print(f"{test_result['status']} {test_result['test']}")
                print(f"   {test_result['details']}")
                print()
                
            print(f"🎯 OVERALL RESULT: {passed}/{total} tests passed ({passed/total*100:.1f}%)")
            
            if passed == total:
                print("✅ ALL BODY STATE ENGINE TESTS PASSED")
                return True
            else:
                print("❌ SOME TESTS FAILED")
                return False
                
        finally:
            # Cleanup
            await self.cleanup_test_users()
            await self.cleanup_session()

async def main():
    """Main test runner"""
    tester = BodyStateTester()
    success = await tester.run_all_tests()
    sys.exit(0 if success else 1)

if __name__ == "__main__":
    asyncio.run(main())