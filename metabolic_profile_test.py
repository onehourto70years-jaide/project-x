#!/usr/bin/env python3
"""
NutriOS Metabolic Profile Engine Backend Testing
Tests the Metabolic Profile Engine endpoints as specified in the review request
"""

import asyncio
import aiohttp
import json
import uuid
from datetime import datetime, timezone, timedelta
from motor.motor_asyncio import AsyncIOMotorClient
import sys

# Backend URL from frontend .env
BACKEND_URL = "https://meal-sync-test.preview.emergentagent.com/api"

class MetabolicProfileTester:
    def __init__(self):
        self.session = None
        self.test_user_id = "test_metabolic_user"
        self.test_session_token = "test_metabolic_token"
        self.test_results = []
        
    async def setup_session(self):
        """Setup HTTP session"""
        self.session = aiohttp.ClientSession()
        
    async def cleanup_session(self):
        """Cleanup HTTP session"""
        if self.session:
            await self.session.close()
            
    async def create_test_user_and_data(self):
        """Create test user with extended profile and test meals as specified in review request"""
        try:
            client = AsyncIOMotorClient("mongodb://localhost:27017")
            db = client.nutrient_mapper
            
            # Create test user with extended profile
            now = datetime.now(timezone.utc)
            far_future = now + timedelta(days=365)
            
            user_doc = {
                "user_id": self.test_user_id,
                "email": "test@metabolic.com",
                "name": "Metabolic Test",
                "weight_kg": 80,
                "height_cm": 180,
                "age": 28,
                "sex": "male",
                "activity_level": "active",
                "sleep_hours": 7.5,
                "diet_type": "standard",
                "health_goals": ["muscle_gain", "energy"],
                "created_at": now
            }
            await db.users.insert_one(user_doc)
            
            # Create session
            session_doc = {
                "session_token": self.test_session_token,
                "user_id": self.test_user_id,
                "expires_at": far_future,
                "created_at": now
            }
            await db.user_sessions.insert_one(session_doc)
            
            # Insert 5 test meals with nutrients for the last 3 days
            today = now.strftime("%Y-%m-%d")
            yesterday = (now - timedelta(days=1)).strftime("%Y-%m-%d")
            
            meals = [
                {
                    "id": "meal1",
                    "user_id": self.test_user_id,
                    "date": today,
                    "food_name": "Chicken breast",
                    "portion_grams": 200,
                    "meal_type": "lunch",
                    "nutrients": {
                        "energy_kcal": 330,
                        "protein_g": 62,
                        "carbohydrate_g": 0,
                        "fat_g": 7
                    },
                    "logged_at": now
                },
                {
                    "id": "meal2",
                    "user_id": self.test_user_id,
                    "date": today,
                    "food_name": "Rice",
                    "portion_grams": 200,
                    "meal_type": "lunch",
                    "nutrients": {
                        "energy_kcal": 260,
                        "protein_g": 5,
                        "carbohydrate_g": 57,
                        "fat_g": 0.6
                    },
                    "logged_at": now
                },
                {
                    "id": "meal3",
                    "user_id": self.test_user_id,
                    "date": yesterday,
                    "food_name": "Salmon",
                    "portion_grams": 150,
                    "meal_type": "dinner",
                    "nutrients": {
                        "energy_kcal": 312,
                        "protein_g": 34,
                        "carbohydrate_g": 0,
                        "fat_g": 19
                    },
                    "logged_at": now - timedelta(days=1)
                }
            ]
            
            for meal in meals:
                await db.meals.insert_one(meal)
            
            client.close()
            print(f"✅ Created test user: {self.test_user_id}")
            print(f"✅ Created session token: {self.test_session_token}")
            print(f"✅ Created {len(meals)} test meals")
            return True
            
        except Exception as e:
            print(f"❌ Failed to create test user and data: {e}")
            import traceback
            traceback.print_exc()
            return False
            
    async def cleanup_test_user(self):
        """Clean up test user and related data"""
        try:
            client = AsyncIOMotorClient("mongodb://localhost:27017")
            db = client.nutrient_mapper
            
            # Delete user data
            await db.users.delete_many({"user_id": self.test_user_id})
            await db.user_sessions.delete_many({"user_id": self.test_user_id})
            await db.meals.delete_many({"user_id": self.test_user_id})
            
            client.close()
            print(f"✅ Cleaned up test user: {self.test_user_id}")
            
        except Exception as e:
            print(f"⚠️ Cleanup warning: {e}")
            
    async def test_metabolic_profile_main(self):
        """Test 1: GET /api/metabolic/profile - Main metabolic profile endpoint"""
        test_name = "GET /api/metabolic/profile - Main metabolic profile endpoint"
        try:
            headers = {
                "Authorization": f"Bearer {self.test_session_token}",
                "Content-Type": "application/json"
            }
            
            async with self.session.get(
                f"{BACKEND_URL}/metabolic/profile",
                headers=headers
            ) as response:
                status = response.status
                data = await response.json()
                
                if status == 200:
                    # Verify response has required fields
                    required_fields = ["bmr", "tdee", "macros", "hydration", "metabolic_identity", "meals_summary_7d", "formula"]
                    missing_fields = [field for field in required_fields if field not in data]
                    
                    if not missing_fields:
                        # Verify BMR calculation for male/80kg/180cm/28yo
                        expected_bmr = (10*80) + (6.25*180) - (5*28) + 5  # = 800+1125-140+5 = 1790
                        actual_bmr = data.get("bmr")
                        
                        # Verify TDEE = BMR * 1.725 (active) ≈ 3087.75
                        expected_tdee = round(expected_bmr * 1.725, 1)
                        actual_tdee = data.get("tdee")
                        
                        # Verify macros.calories has surplus for muscle_gain goal (+300)
                        expected_calories = round(expected_tdee + 300)
                        actual_calories = data.get("macros", {}).get("calories")
                        
                        # Verify macros.protein_pct = 30 (muscle_gain profile)
                        expected_protein_pct = 30
                        actual_protein_pct = data.get("macros", {}).get("protein_pct")
                        
                        # Verify formula = "Mifflin-St Jeor"
                        formula = data.get("formula")
                        
                        # Verify metabolic_identity has primary label and qualifiers
                        metabolic_identity = data.get("metabolic_identity", {})
                        has_primary = "primary" in metabolic_identity
                        has_qualifiers = "qualifiers" in metabolic_identity
                        
                        # Verify hydration.daily_target_ml is calculated correctly
                        hydration = data.get("hydration", {})
                        has_daily_target = "daily_target_ml" in hydration
                        
                        # Check all verifications
                        verifications = [
                            (actual_bmr == expected_bmr, f"BMR: expected {expected_bmr}, got {actual_bmr}"),
                            (actual_tdee == expected_tdee, f"TDEE: expected {expected_tdee}, got {actual_tdee}"),
                            (actual_calories == expected_calories, f"Calories: expected {expected_calories}, got {actual_calories}"),
                            (actual_protein_pct == expected_protein_pct, f"Protein %: expected {expected_protein_pct}, got {actual_protein_pct}"),
                            (formula == "Mifflin-St Jeor", f"Formula: expected 'Mifflin-St Jeor', got '{formula}'"),
                            (has_primary and has_qualifiers, f"Metabolic identity: primary={has_primary}, qualifiers={has_qualifiers}"),
                            (has_daily_target, f"Hydration daily target: {has_daily_target}")
                        ]
                        
                        failed_verifications = [msg for passed, msg in verifications if not passed]
                        
                        if not failed_verifications:
                            self.test_results.append({
                                "test": test_name,
                                "status": "✅ PASS",
                                "details": f"Status: {status}, BMR: {actual_bmr}, TDEE: {actual_tdee}, Calories: {actual_calories}, Protein %: {actual_protein_pct}, Formula: {formula}"
                            })
                            print(f"✅ {test_name}: PASS")
                            return True
                        else:
                            self.test_results.append({
                                "test": test_name,
                                "status": "❌ FAIL",
                                "details": f"Verification failures: {'; '.join(failed_verifications)}"
                            })
                            print(f"❌ {test_name}: FAIL - {'; '.join(failed_verifications)}")
                            return False
                    else:
                        self.test_results.append({
                            "test": test_name,
                            "status": "❌ FAIL",
                            "details": f"Missing fields: {missing_fields}"
                        })
                        print(f"❌ {test_name}: FAIL - Missing fields: {missing_fields}")
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
            
    async def test_user_profile_update(self):
        """Test 2: PUT /api/user/profile - Verify new fields are saved"""
        test_name = "PUT /api/user/profile - Verify new fields are saved"
        try:
            headers = {
                "Authorization": f"Bearer {self.test_session_token}",
                "Content-Type": "application/json"
            }
            
            payload = {
                "sleep_hours": 5,
                "diet_type": "keto"
            }
            
            async with self.session.put(
                f"{BACKEND_URL}/user/profile",
                json=payload,
                headers=headers
            ) as response:
                status = response.status
                data = await response.json()
                
                if status == 200 and data.get("message") == "Profile updated":
                    self.test_results.append({
                        "test": test_name,
                        "status": "✅ PASS",
                        "details": f"Status: {status}, Message: {data.get('message')}"
                    })
                    print(f"✅ {test_name}: PASS - Profile updated successfully")
                    return True
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
            
    async def test_metabolic_profile_after_update(self):
        """Test 3: GET /api/metabolic/profile after profile update - Verify sleep_hours: 5 and hydration adjustment"""
        test_name = "GET /api/metabolic/profile after update - Verify sleep adjustment"
        try:
            headers = {
                "Authorization": f"Bearer {self.test_session_token}",
                "Content-Type": "application/json"
            }
            
            async with self.session.get(
                f"{BACKEND_URL}/metabolic/profile",
                headers=headers
            ) as response:
                status = response.status
                data = await response.json()
                
                if status == 200:
                    # Verify sleep_hours is 5
                    user_profile = data.get("user_profile", {})
                    sleep_hours = user_profile.get("sleep_hours")
                    
                    # Verify hydration has sleep_adj_ml > 0 (since sleep < 6 hours)
                    hydration = data.get("hydration", {})
                    sleep_adj_ml = hydration.get("sleep_adj_ml", 0)
                    
                    if sleep_hours == 5 and sleep_adj_ml > 0:
                        self.test_results.append({
                            "test": test_name,
                            "status": "✅ PASS",
                            "details": f"Status: {status}, Sleep hours: {sleep_hours}, Sleep adjustment: {sleep_adj_ml}ml"
                        })
                        print(f"✅ {test_name}: PASS - Sleep hours: {sleep_hours}, Sleep adjustment: {sleep_adj_ml}ml")
                        return True
                    else:
                        self.test_results.append({
                            "test": test_name,
                            "status": "❌ FAIL",
                            "details": f"Sleep hours: {sleep_hours} (expected 5), Sleep adjustment: {sleep_adj_ml}ml (expected > 0)"
                        })
                        print(f"❌ {test_name}: FAIL - Sleep hours: {sleep_hours}, Sleep adjustment: {sleep_adj_ml}ml")
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
            
    async def test_metabolic_profile_female(self):
        """Test 4: GET /api/metabolic/profile with female user - Verify BMR uses female formula"""
        test_name = "GET /api/metabolic/profile with female user - Verify female BMR formula"
        try:
            # First update user to female
            client = AsyncIOMotorClient("mongodb://localhost:27017")
            db = client.nutrient_mapper
            await db.users.update_one(
                {"user_id": self.test_user_id},
                {"$set": {"sex": "female"}}
            )
            client.close()
            
            headers = {
                "Authorization": f"Bearer {self.test_session_token}",
                "Content-Type": "application/json"
            }
            
            async with self.session.get(
                f"{BACKEND_URL}/metabolic/profile",
                headers=headers
            ) as response:
                status = response.status
                data = await response.json()
                
                if status == 200:
                    # Verify BMR uses female formula: (10*80)+(6.25*180)-(5*28)-161 = 1624
                    expected_bmr = (10*80) + (6.25*180) - (5*28) - 161  # = 800+1125-140-161 = 1624
                    actual_bmr = data.get("bmr")
                    
                    if actual_bmr == expected_bmr:
                        self.test_results.append({
                            "test": test_name,
                            "status": "✅ PASS",
                            "details": f"Status: {status}, Female BMR: {actual_bmr} (expected {expected_bmr})"
                        })
                        print(f"✅ {test_name}: PASS - Female BMR: {actual_bmr}")
                        return True
                    else:
                        self.test_results.append({
                            "test": test_name,
                            "status": "❌ FAIL",
                            "details": f"BMR: expected {expected_bmr}, got {actual_bmr}"
                        })
                        print(f"❌ {test_name}: FAIL - BMR: expected {expected_bmr}, got {actual_bmr}")
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
        """Run all Metabolic Profile Engine tests"""
        print("🧪 Starting Metabolic Profile Engine Backend Tests")
        print(f"📍 Backend URL: {BACKEND_URL}")
        print("=" * 60)
        
        # Setup
        await self.setup_session()
        
        # Create test user and data
        if not await self.create_test_user_and_data():
            print("❌ Failed to create test user and data. Aborting tests.")
            await self.cleanup_session()
            return False
            
        try:
            # Run tests in sequence
            test_results = []
            test_results.append(await self.test_metabolic_profile_main())
            test_results.append(await self.test_user_profile_update())
            test_results.append(await self.test_metabolic_profile_after_update())
            test_results.append(await self.test_metabolic_profile_female())
            
            # Count results
            passed = sum(1 for result in test_results if result is True)
            total = len(test_results)
            
            print("\n" + "=" * 60)
            print("📊 TEST SUMMARY")
            print("=" * 60)
            
            for test_result in self.test_results:
                print(f"{test_result['status']} {test_result['test']}")
                print(f"   {test_result['details']}")
                print()
                
            print(f"🎯 OVERALL RESULT: {passed}/{total} tests passed ({passed/total*100:.1f}%)")
            
            if passed == total:
                print("✅ ALL METABOLIC PROFILE ENGINE TESTS PASSED")
                return True
            else:
                print("❌ SOME TESTS FAILED")
                return False
                
        finally:
            # Cleanup
            await self.cleanup_test_user()
            await self.cleanup_session()

async def main():
    """Main test runner"""
    tester = MetabolicProfileTester()
    success = await tester.run_all_tests()
    sys.exit(0 if success else 1)

if __name__ == "__main__":
    asyncio.run(main())