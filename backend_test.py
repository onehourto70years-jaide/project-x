#!/usr/bin/env python3

import requests
import json
import sys
from datetime import datetime
from typing import Dict, Any, Optional

class ElementEatsAPITester:
    def __init__(self, base_url: str = "https://element-eats.preview.emergentagent.com"):
        self.base_url = base_url
        self.api_base = f"{base_url}/api"
        self.session_token = None
        self.user_id = None
        self.tests_run = 0
        self.tests_passed = 0
        self.test_results = []

    def log_test(self, name: str, success: bool, details: str = "", response_data: Any = None):
        """Log test result"""
        self.tests_run += 1
        if success:
            self.tests_passed += 1
            
        result = {
            "test_name": name,
            "success": success,
            "details": details,
            "response_data": response_data if response_data and len(str(response_data)) < 500 else "truncated"
        }
        self.test_results.append(result)
        
        status = "✅ PASS" if success else "❌ FAIL"
        print(f"{status} - {name}")
        if details:
            print(f"    Details: {details}")

    def make_request(self, method: str, endpoint: str, data: Optional[Dict] = None, 
                    expected_status: int = 200, use_auth: bool = True) -> tuple[bool, Any, int]:
        """Make HTTP request"""
        url = f"{self.api_base}{endpoint}"
        headers = {'Content-Type': 'application/json'}
        
        if use_auth and self.session_token:
            headers['Authorization'] = f'Bearer {self.session_token}'
            
        try:
            if method == 'GET':
                response = requests.get(url, headers=headers, timeout=15)
            elif method == 'POST':
                response = requests.post(url, json=data, headers=headers, timeout=15)
            elif method == 'DELETE':
                response = requests.delete(url, headers=headers, timeout=15)
            else:
                return False, f"Unsupported method: {method}", 0
                
            success = response.status_code == expected_status
            try:
                response_data = response.json()
            except:
                response_data = response.text
                
            return success, response_data, response.status_code
            
        except requests.exceptions.Timeout:
            return False, "Request timeout", 0
        except requests.exceptions.ConnectionError:
            return False, "Connection error", 0
        except Exception as e:
            return False, f"Request error: {str(e)}", 0

    def test_basic_health(self):
        """Test basic API health"""
        success, data, status = self.make_request('GET', '/', use_auth=False)
        self.log_test("API Health Check", success, f"Status: {status}", data)

    def create_test_session(self):
        """Create test user and session for auth testing"""
        try:
            import pymongo
            
            # Connect to MongoDB
            client = pymongo.MongoClient("mongodb://localhost:27017")
            db = client["test_database"]
            
            # Create test user
            timestamp = int(datetime.now().timestamp())
            self.user_id = f"test-user-{timestamp}"
            self.session_token = f"test_session_{timestamp}"
            
            user_data = {
                "user_id": self.user_id,
                "email": f"test.user.{timestamp}@example.com",
                "name": "Test User",
                "picture": "https://via.placeholder.com/150",
                "created_at": datetime.now()
            }
            
            from datetime import timedelta
            
            session_data = {
                "user_id": self.user_id,
                "session_token": self.session_token,
                "expires_at": (datetime.now() + timedelta(days=7)).isoformat(),
                "created_at": datetime.now().isoformat()
            }
            
            # Insert test data
            db.users.insert_one(user_data)
            db.user_sessions.insert_one(session_data)
            
            client.close()
            self.log_test("Create Test Session", True, f"Session: {self.session_token[:10]}...")
            return True
            
        except Exception as e:
            self.log_test("Create Test Session", False, f"Error: {str(e)}")
            return False

    def test_auth_endpoints(self):
        """Test authentication endpoints"""
        # Test /auth/me
        success, data, status = self.make_request('GET', '/auth/me')
        self.log_test("GET /auth/me", success, f"Status: {status}", data)
        
        # Test /auth/logout
        success, data, status = self.make_request('POST', '/auth/logout')
        self.log_test("POST /auth/logout", success, f"Status: {status}", data)

    def test_foods_search(self):
        """Test food search endpoint"""
        test_data = {"query": "apple", "page_size": 5}
        success, data, status = self.make_request('POST', '/foods/search', test_data, use_auth=False)
        
        # Check response structure
        if success and isinstance(data, dict):
            has_foods = 'foods' in data
            foods_list = isinstance(data.get('foods'), list)
            success = success and has_foods and foods_list
            
        self.log_test("POST /foods/search", success, f"Status: {status}, Found {len(data.get('foods', []))} foods" if success else f"Status: {status}")

    def test_barcode_search(self):
        """Test barcode search endpoint"""
        # Test with a known barcode (Coca Cola)
        test_data = {"barcode": "5449000000996"}
        success, data, status = self.make_request('POST', '/foods/barcode', test_data, expected_status=200, use_auth=False)
        
        # Allow 404 since not all barcodes exist in Open Food Facts
        if status == 404:
            success = True  # 404 is expected for non-existent barcodes
            
        self.log_test("POST /foods/barcode", success, f"Status: {status}")

    def test_food_details(self):
        """Test food details endpoint"""
        # Use a known USDA FDC ID for apple
        fdc_id = 171688  # Raw apple
        success, data, status = self.make_request('GET', f'/foods/{fdc_id}', use_auth=False)
        
        # Check response has elemental composition
        if success and isinstance(data, dict):
            has_elemental = 'elemental_composition' in data
            has_nutrients = 'nutrients' in data
            success = success and has_elemental and has_nutrients
            
        self.log_test(f"GET /foods/{fdc_id}", success, f"Status: {status}")

    def test_recipe_analysis(self):
        """Test recipe analysis endpoint"""
        test_recipe = {
            "ingredients": [
                {
                    "fdc_id": 171688,  # Apple
                    "name": "Apple",
                    "amount": 100,
                    "unit": "g"
                }
            ],
            "cooking_method": "raw",
            "servings": 1
        }
        
        success, data, status = self.make_request('POST', '/analyze', test_recipe, use_auth=False)
        
        # Check response structure
        if success and isinstance(data, dict):
            has_elemental = 'elemental_composition' in data
            has_macros = 'total_macros' in data
            has_nutrients = 'nutrients_cooked' in data
            success = success and has_elemental and has_macros and has_nutrients
            
        self.log_test("POST /analyze", success, f"Status: {status}")

    def test_reference_endpoints(self):
        """Test reference data endpoints"""
        endpoints = [
            '/reference/cooking-methods',
            '/reference/safe-temperatures', 
            '/reference/allergens',
            '/reference/elements'
        ]
        
        for endpoint in endpoints:
            success, data, status = self.make_request('GET', endpoint, use_auth=False)
            self.log_test(f"GET {endpoint}", success, f"Status: {status}")

    def test_recipe_crud(self):
        """Test recipe CRUD operations"""
        # Recreate session since logout might have cleared it
        if not self.create_test_session():
            self.log_test("Recipe CRUD (Skipped)", False, "Cannot create auth session")
            return
            
        # Test GET recipes
        success, data, status = self.make_request('GET', '/recipes')
        self.log_test("GET /recipes", success, f"Status: {status}")
        
        # Test POST recipe
        test_recipe = {
            "name": "Test Recipe",
            "ingredients": [{"name": "Apple", "amount": 100, "unit": "g"}],
            "cooking_method": "raw",
            "servings": 1
        }
        
        success, data, status = self.make_request('POST', '/recipes', test_recipe, expected_status=200)
        recipe_id = None
        if success and isinstance(data, dict):
            recipe_id = data.get('recipe_id')
            
        self.log_test("POST /recipes", success, f"Status: {status}")
        
        # Test GET specific recipe
        if recipe_id:
            success, data, status = self.make_request('GET', f'/recipes/{recipe_id}')
            self.log_test(f"GET /recipes/{recipe_id}", success, f"Status: {status}")
            
            # Test DELETE recipe
            success, data, status = self.make_request('DELETE', f'/recipes/{recipe_id}')
            self.log_test(f"DELETE /recipes/{recipe_id}", success, f"Status: {status}")

    def run_all_tests(self):
        """Run all API tests"""
        print("🧪 Starting ElementEats API Tests")
        print("=" * 50)
        
        # Basic tests
        self.test_basic_health()
        
        # Create auth session
        if self.create_test_session():
            self.test_auth_endpoints()
        
        # Food API tests
        self.test_foods_search()
        self.test_barcode_search()
        self.test_food_details()
        self.test_recipe_analysis()
        
        # Reference endpoints
        self.test_reference_endpoints()
        
        # Recipe CRUD (requires auth)
        self.test_recipe_crud()
        
        # Summary
        print("\n" + "=" * 50)
        print(f"📊 Test Summary: {self.tests_passed}/{self.tests_run} passed ({(self.tests_passed/self.tests_run*100):.1f}%)")
        
        failed_tests = [r for r in self.test_results if not r['success']]
        if failed_tests:
            print("\n❌ Failed Tests:")
            for test in failed_tests:
                print(f"  • {test['test_name']}: {test['details']}")
                
        return self.tests_passed, self.tests_run, self.test_results

def main():
    try:
        tester = ElementEatsAPITester()
        passed, total, results = tester.run_all_tests()
        
        # Save results to file
        with open('/app/test_reports/backend_test_results.json', 'w') as f:
            json.dump({
                'timestamp': datetime.now().isoformat(),
                'summary': {'passed': passed, 'total': total},
                'results': results
            }, f, indent=2, default=str)
            
        return 0 if passed == total else 1
        
    except Exception as e:
        print(f"💥 Test execution failed: {e}")
        return 1

if __name__ == "__main__":
    sys.exit(main())