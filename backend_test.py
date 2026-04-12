#!/usr/bin/env python3
"""
NutriOS Backend API Testing - Smart Micronutrient Engine Focus
Testing the new Smart Micronutrient Engine endpoints and basic regression tests.
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
TEST_USER_ID = "test_micro_user"
TEST_EMAIL = "test@nutrios.com"
TEST_NAME = "Test User"
TEST_SESSION_TOKEN = "test_micro_token_123"

class NutriOSAPITester:
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
        
        # Create session token
        session_doc = {
            "session_token": TEST_SESSION_TOKEN,
            "user_id": TEST_USER_ID,
            "expires_at": datetime.now(timezone.utc) + timedelta(days=30),
            "created_at": datetime.now(timezone.utc)
        }
        
        self.db.user_sessions.replace_one({"session_token": TEST_SESSION_TOKEN}, session_doc, upsert=True)
        print(f"✅ Created session token: {TEST_SESSION_TOKEN}")
        
    async def cleanup(self):
        """Cleanup test data"""
        print("🧹 Cleaning up test data...")
        if self.db is not None:
            self.db.users.delete_one({"user_id": TEST_USER_ID})
            self.db.user_sessions.delete_one({"session_token": TEST_SESSION_TOKEN})
            self.db.meals.delete_many({"user_id": TEST_USER_ID})
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
    
    async def test_dashboard(self):
        """Test dashboard endpoint (requires auth)"""
        print("\n🔍 Testing Dashboard...")
        status, response = await self.make_request("GET", "/dashboard")
        
        if status == 200:
            print(f"✅ Dashboard passed: Keys present - {list(response.keys())}")
            return True
        else:
            print(f"❌ Dashboard failed: {status} - {response}")
            return False
    
    async def add_test_meal(self):
        """Add a test meal with nutrients for micronutrient testing"""
        print("\n🍗 Adding test meal with nutrients...")
        
        meal_data = {
            "food_name": "Test Chicken",
            "portion_grams": 150,
            "meal_type": "lunch",
            "cooking_method": "baking",
            "nutrients": {
                "energy_kcal": 250,
                "protein_g": 40,
                "iron_mg": 2.5,
                "vitamin_c_mg": 15,
                "calcium_mg": 30,
                "magnesium_mg": 25,
                "zinc_mg": 3,
                "vitamin_d_mcg": 1.2,
                "vitamin_b12_mcg": 0.8,
                "potassium_mg": 300,
                "sodium_mg": 80
            }
        }
        
        status, response = await self.make_request("POST", "/meals", meal_data)
        
        if status == 200:
            print(f"✅ Test meal added successfully")
            return True
        else:
            print(f"❌ Failed to add test meal: {status} - {response}")
            return False
    
    async def test_micronutrient_progress(self):
        """Test GET /api/progress/micronutrients - 7-day rolling micronutrient averages"""
        print("\n🧬 Testing Micronutrient Progress...")
        status, response = await self.make_request("GET", "/progress/micronutrients")
        
        if status == 200:
            required_keys = ["chart_data", "density_score", "days_tracked", "total_nutrients_tracked"]
            missing_keys = [key for key in required_keys if key not in response]
            
            if not missing_keys:
                chart_data = response.get("chart_data", [])
                print(f"✅ Micronutrient progress passed:")
                print(f"   - Chart data entries: {len(chart_data)}")
                print(f"   - Density score: {response.get('density_score')}")
                print(f"   - Days tracked: {response.get('days_tracked')}")
                print(f"   - Total nutrients tracked: {response.get('total_nutrients_tracked')}")
                
                # Check if we have some expected nutrients
                nutrient_names = [item.get("name") for item in chart_data]
                expected_nutrients = ["Iron", "Vitamin C", "Calcium", "Magnesium", "Zinc"]
                found_nutrients = [n for n in expected_nutrients if n in nutrient_names]
                print(f"   - Found expected nutrients: {found_nutrients}")
                
                return True
            else:
                print(f"❌ Micronutrient progress missing keys: {missing_keys}")
                return False
        else:
            print(f"❌ Micronutrient progress failed: {status} - {response}")
            return False
    
    async def test_bioavailability_insights(self):
        """Test GET /api/progress/bioavailability - Nutrient interaction insights"""
        print("\n🔬 Testing Bioavailability Insights...")
        status, response = await self.make_request("GET", "/progress/bioavailability")
        
        if status == 200:
            required_keys = ["insights", "total_interactions_checked"]
            missing_keys = [key for key in required_keys if key not in response]
            
            if not missing_keys:
                insights = response.get("insights", [])
                print(f"✅ Bioavailability insights passed:")
                print(f"   - Insights found: {len(insights)}")
                print(f"   - Total interactions checked: {response.get('total_interactions_checked')}")
                
                if insights:
                    for insight in insights[:3]:  # Show first 3
                        print(f"   - {insight.get('title')}: {insight.get('severity')} severity")
                
                return True
            else:
                print(f"❌ Bioavailability insights missing keys: {missing_keys}")
                return False
        else:
            print(f"❌ Bioavailability insights failed: {status} - {response}")
            return False
    
    async def test_symptom_correlation(self):
        """Test POST /api/progress/symptom-correlation - Symptom correlation analysis"""
        print("\n🩺 Testing Symptom Correlation...")
        
        symptom_data = {"symptoms": ["fatigue", "cramps"]}
        status, response = await self.make_request("POST", "/progress/symptom-correlation", symptom_data)
        
        if status == 200:
            if "correlations" in response:
                correlations = response.get("correlations", [])
                print(f"✅ Symptom correlation passed:")
                print(f"   - Correlations found: {len(correlations)}")
                
                for corr in correlations:
                    symptom = corr.get("symptom")
                    strength = corr.get("correlation_strength")
                    deficient_count = len(corr.get("deficient_nutrients", []))
                    print(f"   - {symptom}: {strength} correlation ({deficient_count} deficient nutrients)")
                
                return True
            else:
                print(f"❌ Symptom correlation missing 'correlations' key")
                return False
        else:
            print(f"❌ Symptom correlation failed: {status} - {response}")
            return False
    
    async def test_gap_analysis(self):
        """Test GET /api/progress/gap-analysis - AI gap analysis"""
        print("\n🤖 Testing Gap Analysis...")
        status, response = await self.make_request("GET", "/progress/gap-analysis")
        
        if status == 200:
            required_keys = ["top_gaps", "all_deficiencies"]
            missing_keys = [key for key in required_keys if key not in response]
            
            if not missing_keys:
                top_gaps = response.get("top_gaps", [])
                all_deficiencies = response.get("all_deficiencies", [])
                ai_suggestions = response.get("ai_suggestions", [])
                
                print(f"✅ Gap analysis passed:")
                print(f"   - Top gaps: {len(top_gaps)}")
                print(f"   - All deficiencies: {len(all_deficiencies)}")
                print(f"   - AI suggestions: {len(ai_suggestions)}")
                print(f"   - Foods in library: {response.get('foods_in_library', 0)}")
                
                if top_gaps:
                    for gap in top_gaps[:3]:
                        name = gap.get("name")
                        pct_rda = gap.get("pct_rda")
                        print(f"   - {name}: {pct_rda}% of RDA")
                
                return True
            else:
                print(f"❌ Gap analysis missing keys: {missing_keys}")
                return False
        else:
            print(f"❌ Gap analysis failed: {status} - {response}")
            return False
    
    async def run_all_tests(self):
        """Run all tests in sequence"""
        print("🚀 Starting NutriOS Smart Micronutrient Engine API Tests")
        print(f"🌐 Base URL: {BASE_URL}")
        print(f"👤 Test User: {TEST_USER_ID}")
        
        results = {}
        
        try:
            await self.setup()
            
            # Basic regression tests
            results["health_check"] = await self.test_health_check()
            results["dashboard"] = await self.test_dashboard()
            results["add_test_meal"] = await self.add_test_meal()
            
            # After adding meal, test micronutrients again to verify data-based responses
            print("\n📊 Testing micronutrients with meal data...")
            
            # Smart Micronutrient Engine tests (P0 priority)
            results["micronutrient_progress"] = await self.test_micronutrient_progress()
            results["bioavailability_insights"] = await self.test_bioavailability_insights()
            results["symptom_correlation"] = await self.test_symptom_correlation()
            results["gap_analysis"] = await self.test_gap_analysis()
            
            # Summary
            print("\n" + "="*60)
            print("📋 TEST SUMMARY")
            print("="*60)
            
            passed = sum(1 for result in results.values() if result)
            total = len(results)
            
            for test_name, result in results.items():
                status = "✅ PASS" if result else "❌ FAIL"
                print(f"{status} {test_name.replace('_', ' ').title()}")
            
            print(f"\n🎯 Overall: {passed}/{total} tests passed ({(passed/total)*100:.1f}%)")
            
            if passed == total:
                print("🎉 ALL TESTS PASSED - Smart Micronutrient Engine is fully operational!")
            else:
                print("⚠️  Some tests failed - see details above")
                
        except Exception as e:
            print(f"💥 Test execution error: {e}")
            
        finally:
            await self.cleanup()

async def main():
    tester = NutriOSAPITester()
    await tester.run_all_tests()

if __name__ == "__main__":
    asyncio.run(main())