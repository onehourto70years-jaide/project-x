#!/usr/bin/env python3
"""
Comprehensive Backend API Testing for Molecular Nutrition Engine
Tests all endpoints as specified in the review request
"""

import asyncio
import httpx
import json
import sys
from typing import Dict, Any, List

# Backend URL from frontend .env
BACKEND_URL = "https://elemental-nutrition.preview.emergentagent.com"
API_BASE = f"{BACKEND_URL}/api"

class NutritionAPITester:
    def __init__(self):
        self.client = httpx.AsyncClient(timeout=30.0)
        self.test_results = []
        self.failed_tests = []
        self.passed_tests = []

    async def log_test(self, test_name: str, success: bool, details: str = "", response_data: Any = None):
        """Log test results"""
        result = {
            "test": test_name,
            "success": success,
            "details": details,
            "response_data": response_data
        }
        self.test_results.append(result)
        
        if success:
            self.passed_tests.append(test_name)
            print(f"✅ {test_name}: {details}")
        else:
            self.failed_tests.append(test_name)
            print(f"❌ {test_name}: {details}")

    async def test_health_check(self):
        """Test GET /api/ - Health check endpoint"""
        try:
            response = await self.client.get(f"{API_BASE}/")
            
            if response.status_code == 200:
                data = response.json()
                if "message" in data and "status" in data:
                    await self.log_test(
                        "Health Check", 
                        True, 
                        f"API healthy - {data.get('message', '')}", 
                        data
                    )
                else:
                    await self.log_test(
                        "Health Check", 
                        False, 
                        f"Missing expected fields in response: {data}"
                    )
            else:
                await self.log_test(
                    "Health Check", 
                    False, 
                    f"HTTP {response.status_code}: {response.text}"
                )
        except Exception as e:
            await self.log_test("Health Check", False, f"Exception: {str(e)}")

    async def test_food_search(self):
        """Test POST /api/foods/search - Search foods with USDA integration"""
        try:
            search_data = {"query": "salmon", "page_size": 5}
            response = await self.client.post(
                f"{API_BASE}/foods/search",
                json=search_data
            )
            
            if response.status_code == 200:
                data = response.json()
                if "foods" in data and isinstance(data["foods"], list):
                    foods = data["foods"]
                    if len(foods) > 0:
                        # Check if foods have required fields
                        first_food = foods[0]
                        required_fields = ["fdc_id", "description"]
                        missing_fields = [f for f in required_fields if f not in first_food]
                        
                        if not missing_fields:
                            await self.log_test(
                                "Food Search", 
                                True, 
                                f"Found {len(foods)} foods, first: {first_food.get('description', 'N/A')}", 
                                {"count": len(foods), "sample": first_food}
                            )
                        else:
                            await self.log_test(
                                "Food Search", 
                                False, 
                                f"Missing required fields: {missing_fields}"
                            )
                    else:
                        await self.log_test(
                            "Food Search", 
                            False, 
                            "No foods returned in search results"
                        )
                else:
                    await self.log_test(
                        "Food Search", 
                        False, 
                        f"Invalid response structure: {data}"
                    )
            else:
                await self.log_test(
                    "Food Search", 
                    False, 
                    f"HTTP {response.status_code}: {response.text}"
                )
        except Exception as e:
            await self.log_test("Food Search", False, f"Exception: {str(e)}")

    async def test_food_analysis(self):
        """Test POST /api/foods/analyze - Analyze food with elemental composition"""
        try:
            # Using salmon FDC ID from USDA database
            analysis_data = {
                "fdc_id": 175167,
                "portion_grams": 150,
                "cooking_method": "steaming"
            }
            response = await self.client.post(
                f"{API_BASE}/foods/analyze",
                json=analysis_data
            )
            
            if response.status_code == 200:
                data = response.json()
                required_fields = ["nutrients", "elements", "biological_effects", "cooking_recommendations"]
                missing_fields = [f for f in required_fields if f not in data]
                
                if not missing_fields:
                    # Check nutrients structure
                    nutrients = data.get("nutrients", {})
                    if "raw" in nutrients and "cooked" in nutrients:
                        # Check elements structure
                        elements = data.get("elements", {})
                        if "mass_grams" in elements:
                            # Check for key elements (C, H, O, N, S)
                            mass_grams = elements["mass_grams"]
                            key_elements = ["C", "H", "O", "N", "S"]
                            found_elements = [e for e in key_elements if e in mass_grams and mass_grams[e] > 0]
                            
                            await self.log_test(
                                "Food Analysis", 
                                True, 
                                f"Complete analysis with {len(found_elements)} key elements: {found_elements}", 
                                {
                                    "food_name": data.get("food_name"),
                                    "elements_found": found_elements,
                                    "has_biological_effects": len(data.get("biological_effects", {})) > 0
                                }
                            )
                        else:
                            await self.log_test(
                                "Food Analysis", 
                                False, 
                                "Missing mass_grams in elements structure"
                            )
                    else:
                        await self.log_test(
                            "Food Analysis", 
                            False, 
                            "Missing raw/cooked nutrients structure"
                        )
                else:
                    await self.log_test(
                        "Food Analysis", 
                        False, 
                        f"Missing required fields: {missing_fields}"
                    )
            else:
                await self.log_test(
                    "Food Analysis", 
                    False, 
                    f"HTTP {response.status_code}: {response.text}"
                )
        except Exception as e:
            await self.log_test("Food Analysis", False, f"Exception: {str(e)}")

    async def test_retention_factors(self):
        """Test GET /api/foods/retention-factors - Get cooking retention factors"""
        try:
            response = await self.client.get(f"{API_BASE}/foods/retention-factors")
            
            if response.status_code == 200:
                data = response.json()
                if "retention_factors" in data and "cooking_methods" in data:
                    retention_factors = data["retention_factors"]
                    cooking_methods = data["cooking_methods"]
                    
                    # Check for expected cooking methods
                    expected_methods = ["boiling", "steaming", "frying", "baking", "raw"]
                    found_methods = [m for m in expected_methods if m in cooking_methods]
                    
                    await self.log_test(
                        "Retention Factors", 
                        True, 
                        f"Found {len(found_methods)} cooking methods: {found_methods}", 
                        {"methods_count": len(cooking_methods), "methods": cooking_methods}
                    )
                else:
                    await self.log_test(
                        "Retention Factors", 
                        False, 
                        f"Missing expected fields in response: {data}"
                    )
            else:
                await self.log_test(
                    "Retention Factors", 
                    False, 
                    f"HTTP {response.status_code}: {response.text}"
                )
        except Exception as e:
            await self.log_test("Retention Factors", False, f"Exception: {str(e)}")

    async def test_safe_temperatures(self):
        """Test GET /api/foods/safe-temps - Get safe cooking temperatures"""
        try:
            response = await self.client.get(f"{API_BASE}/foods/safe-temps")
            
            if response.status_code == 200:
                data = response.json()
                if "temperatures" in data:
                    temperatures = data["temperatures"]
                    
                    # Check for expected food types
                    expected_types = ["poultry", "ground_meat", "beef_steak", "pork", "fish"]
                    found_types = [t for t in expected_types if t in temperatures]
                    
                    await self.log_test(
                        "Safe Temperatures", 
                        True, 
                        f"Found {len(found_types)} food types with safe temps: {found_types}", 
                        {"types_count": len(temperatures), "types": list(temperatures.keys())}
                    )
                else:
                    await self.log_test(
                        "Safe Temperatures", 
                        False, 
                        f"Missing temperatures field in response: {data}"
                    )
            else:
                await self.log_test(
                    "Safe Temperatures", 
                    False, 
                    f"HTTP {response.status_code}: {response.text}"
                )
        except Exception as e:
            await self.log_test("Safe Temperatures", False, f"Exception: {str(e)}")

    async def test_elements_info(self):
        """Test GET /api/elements/info - Get element information"""
        try:
            response = await self.client.get(f"{API_BASE}/elements/info")
            
            if response.status_code == 200:
                data = response.json()
                expected_fields = ["elements", "biological_effects", "elemental_fractions"]
                missing_fields = [f for f in expected_fields if f not in data]
                
                if not missing_fields:
                    elements = data["elements"]
                    bio_effects = data["biological_effects"]
                    
                    # Check for key elements
                    key_elements = ["C", "H", "O", "N", "S", "Fe", "Ca", "K", "Mg", "Zn"]
                    found_elements = [e for e in key_elements if e in elements]
                    
                    await self.log_test(
                        "Elements Info", 
                        True, 
                        f"Found {len(found_elements)} key elements with atomic weights and biological effects", 
                        {"elements_count": len(elements), "bio_effects_count": len(bio_effects)}
                    )
                else:
                    await self.log_test(
                        "Elements Info", 
                        False, 
                        f"Missing required fields: {missing_fields}"
                    )
            else:
                await self.log_test(
                    "Elements Info", 
                    False, 
                    f"HTTP {response.status_code}: {response.text}"
                )
        except Exception as e:
            await self.log_test("Elements Info", False, f"Exception: {str(e)}")

    async def test_allergens_list(self):
        """Test GET /api/allergens/list - Get allergen categories"""
        try:
            response = await self.client.get(f"{API_BASE}/allergens/list")
            
            if response.status_code == 200:
                data = response.json()
                if "allergen_categories" in data and "all_keywords" in data:
                    categories = data["allergen_categories"]
                    keywords = data["all_keywords"]
                    
                    # Check for expected allergen categories
                    expected_categories = ["peanuts", "tree nuts", "dairy", "eggs", "wheat/gluten", "soy", "fish", "shellfish"]
                    found_categories = [c for c in expected_categories if c in categories]
                    
                    await self.log_test(
                        "Allergens List", 
                        True, 
                        f"Found {len(found_categories)} allergen categories with {len(keywords)} keywords", 
                        {"categories": categories, "keywords_count": len(keywords)}
                    )
                else:
                    await self.log_test(
                        "Allergens List", 
                        False, 
                        f"Missing expected fields in response: {data}"
                    )
            else:
                await self.log_test(
                    "Allergens List", 
                    False, 
                    f"HTTP {response.status_code}: {response.text}"
                )
        except Exception as e:
            await self.log_test("Allergens List", False, f"Exception: {str(e)}")

    async def test_ai_recommendations(self):
        """Test POST /api/ai/recommendations - Get AI recommendations"""
        try:
            recommendation_data = {
                "goal": "brain_health",
                "current_foods": [],
                "dietary_restrictions": []
            }
            response = await self.client.post(
                f"{API_BASE}/ai/recommendations",
                json=recommendation_data
            )
            
            if response.status_code == 200:
                data = response.json()
                if "recommendations" in data and isinstance(data["recommendations"], list):
                    recommendations = data["recommendations"]
                    if len(recommendations) > 0:
                        # Check structure of first recommendation
                        first_rec = recommendations[0]
                        required_fields = ["food", "key_nutrients", "key_elements", "health_benefit"]
                        missing_fields = [f for f in required_fields if f not in first_rec]
                        
                        if not missing_fields:
                            await self.log_test(
                                "AI Recommendations", 
                                True, 
                                f"Got {len(recommendations)} recommendations for brain health", 
                                {
                                    "count": len(recommendations),
                                    "sample_food": first_rec.get("food"),
                                    "ai_model": data.get("ai_model", "unknown")
                                }
                            )
                        else:
                            await self.log_test(
                                "AI Recommendations", 
                                False, 
                                f"Missing required fields in recommendation: {missing_fields}"
                            )
                    else:
                        await self.log_test(
                            "AI Recommendations", 
                            False, 
                            "No recommendations returned"
                        )
                else:
                    await self.log_test(
                        "AI Recommendations", 
                        False, 
                        f"Invalid response structure: {data}"
                    )
            else:
                await self.log_test(
                    "AI Recommendations", 
                    False, 
                    f"HTTP {response.status_code}: {response.text}"
                )
        except Exception as e:
            await self.log_test("AI Recommendations", False, f"Exception: {str(e)}")

    async def test_auth_me_unauthorized(self):
        """Test GET /api/auth/me - Should return 401 without token"""
        try:
            response = await self.client.get(f"{API_BASE}/auth/me")
            
            if response.status_code == 401:
                await self.log_test(
                    "Auth Me (Unauthorized)", 
                    True, 
                    "Correctly returned 401 for unauthenticated request"
                )
            else:
                await self.log_test(
                    "Auth Me (Unauthorized)", 
                    False, 
                    f"Expected 401 but got HTTP {response.status_code}: {response.text}"
                )
        except Exception as e:
            await self.log_test("Auth Me (Unauthorized)", False, f"Exception: {str(e)}")

    async def test_tracking_daily_unauthorized(self):
        """Test GET /api/tracking/daily - Should return 401 without token"""
        try:
            response = await self.client.get(f"{API_BASE}/tracking/daily")
            
            if response.status_code == 401:
                await self.log_test(
                    "Tracking Daily (Unauthorized)", 
                    True, 
                    "Correctly returned 401 for unauthenticated request"
                )
            else:
                await self.log_test(
                    "Tracking Daily (Unauthorized)", 
                    False, 
                    f"Expected 401 but got HTTP {response.status_code}: {response.text}"
                )
        except Exception as e:
            await self.log_test("Tracking Daily (Unauthorized)", False, f"Exception: {str(e)}")

    async def run_all_tests(self):
        """Run all backend API tests"""
        print(f"🧪 Starting Molecular Nutrition Engine Backend API Tests")
        print(f"🔗 Backend URL: {BACKEND_URL}")
        print("=" * 80)
        
        # Run all tests
        await self.test_health_check()
        await self.test_food_search()
        await self.test_food_analysis()
        await self.test_retention_factors()
        await self.test_safe_temperatures()
        await self.test_elements_info()
        await self.test_allergens_list()
        await self.test_ai_recommendations()
        await self.test_auth_me_unauthorized()
        await self.test_tracking_daily_unauthorized()
        
        # Summary
        print("\n" + "=" * 80)
        print(f"📊 TEST SUMMARY")
        print(f"✅ Passed: {len(self.passed_tests)}")
        print(f"❌ Failed: {len(self.failed_tests)}")
        print(f"📈 Success Rate: {len(self.passed_tests)}/{len(self.test_results)} ({len(self.passed_tests)/len(self.test_results)*100:.1f}%)")
        
        if self.failed_tests:
            print(f"\n❌ Failed Tests:")
            for test in self.failed_tests:
                print(f"   - {test}")
        
        if self.passed_tests:
            print(f"\n✅ Passed Tests:")
            for test in self.passed_tests:
                print(f"   - {test}")
        
        await self.client.aclose()
        return len(self.failed_tests) == 0

async def main():
    """Main test runner"""
    tester = NutritionAPITester()
    success = await tester.run_all_tests()
    
    # Exit with appropriate code
    sys.exit(0 if success else 1)

if __name__ == "__main__":
    asyncio.run(main())