#!/usr/bin/env python3

import requests
import sys
import json
from datetime import datetime, timedelta

class HealthTrackingAPITester:
    def __init__(self, base_url="https://element-eats.preview.emergentagent.com"):
        self.base_url = base_url
        self.session_token = "test_health_session_123"
        self.headers = {
            'Authorization': f'Bearer {self.session_token}',
            'Content-Type': 'application/json'
        }
        self.tests_run = 0
        self.tests_passed = 0
        self.failed_tests = []
        self.today = datetime.now().strftime('%Y-%m-%d')

    def run_test(self, name, method, endpoint, expected_status, data=None, query_params=None):
        """Run a single API test"""
        url = f"{self.base_url}/api/{endpoint}"
        if query_params:
            url += f"?{query_params}"
        
        self.tests_run += 1
        print(f"\n🔍 Testing {name} [{method} {endpoint}]...")
        
        try:
            if method == 'GET':
                response = requests.get(url, headers=self.headers)
            elif method == 'POST':
                response = requests.post(url, headers=self.headers, json=data)
            elif method == 'PUT':
                response = requests.put(url, headers=self.headers, json=data)
            elif method == 'DELETE':
                response = requests.delete(url, headers=self.headers)

            success = response.status_code == expected_status
            if success:
                self.tests_passed += 1
                print(f"✅ Passed - Status: {response.status_code}")
                try:
                    response_data = response.json() if response.text else {}
                    return True, response_data
                except:
                    return True, {}
            else:
                self.failed_tests.append({
                    'test': name,
                    'expected': expected_status, 
                    'actual': response.status_code,
                    'response': response.text[:500] if response.text else 'No response body'
                })
                print(f"❌ Failed - Expected {expected_status}, got {response.status_code}")
                print(f"   Response: {response.text[:200]}...")
                return False, {}

        except Exception as e:
            self.failed_tests.append({'test': name, 'error': str(e)})
            print(f"❌ Failed - Error: {str(e)}")
            return False, {}

    def test_auth(self):
        """Test authentication"""
        return self.run_test("Authentication", "GET", "auth/me", 200)

    def test_goals_apis(self):
        """Test goals management"""
        print("\n📝 Testing Goals APIs...")
        
        # Get current goals
        success, goals = self.run_test("Get Goals", "GET", "goals", 200)
        
        if success:
            # Update goals
            updated_goals = {
                "calories": 2200,
                "protein": 160,
                "carbs": 220,
                "fat": 70,
                "water": 9,
                "steps": 12000,
                "net_carbs_mode": True,
                "goal_type": "muscle_gain"
            }
            return self.run_test("Update Goals", "PUT", "goals", 200, updated_goals)
        return False

    def test_food_log_apis(self):
        """Test food logging"""
        print("\n🍽️ Testing Food Log APIs...")
        
        # Get food log for today
        success, food_log = self.run_test("Get Food Log", "GET", "food-log", 200, query_params=f"date={self.today}")
        
        if success:
            # Add food entry
            food_entry = {
                "name": "Test Apple",
                "calories": 95,
                "protein": 0.5,
                "carbs": 25,
                "fat": 0.3,
                "fiber": 4,
                "amount": 1,
                "unit": "medium",
                "meal_type": "breakfast"
            }
            success, entry = self.run_test("Add Food Entry", "POST", "food-log", 200, food_entry, f"date={self.today}")
            
            if success and 'entry_id' in entry:
                # Delete food entry
                self.run_test("Delete Food Entry", "DELETE", f"food-log/{entry['entry_id']}", 200, query_params=f"date={self.today}")
        
        return success

    def test_water_log_apis(self):
        """Test water tracking"""
        print("\n💧 Testing Water Log APIs...")
        
        # Get water log
        success, water_log = self.run_test("Get Water Log", "GET", "water-log", 200, query_params=f"date={self.today}")
        
        if success:
            # Add water entry
            water_entry = {"glasses": 2, "notes": "Morning hydration"}
            success, entry = self.run_test("Add Water", "POST", "water-log", 200, water_entry, f"date={self.today}")
            
            # Quick add water
            if success:
                self.run_test("Quick Add Water", "POST", "water-log/quick", 200, query_params=f"glasses=1&date={self.today}")
        
        return success

    def test_workout_apis(self):
        """Test workout logging"""
        print("\n💪 Testing Workout APIs...")
        
        # Get workouts
        success, workouts = self.run_test("Get Workouts", "GET", "workouts", 200, query_params=f"date={self.today}")
        
        if success:
            # Add workout
            workout_entry = {
                "workout_type": "cardio",
                "name": "Test Running",
                "duration_minutes": 30,
                "calories_burned": 300,
                "notes": "Good pace"
            }
            success, entry = self.run_test("Add Workout", "POST", "workouts", 200, workout_entry, f"date={self.today}")
            
            if success and 'workout_id' in entry:
                # Delete workout
                self.run_test("Delete Workout", "DELETE", f"workouts/{entry['workout_id']}", 200, query_params=f"date={self.today}")
        
        return success

    def test_weight_apis(self):
        """Test weight tracking"""
        print("\n⚖️ Testing Weight APIs...")
        
        # Get weight history
        success, weight_history = self.run_test("Get Weight History", "GET", "weight", 200, query_params="days=30")
        
        if success:
            # Log weight
            weight_entry = {"weight": 75.5, "unit": "kg", "notes": "Morning weight"}
            self.run_test("Log Weight", "POST", "weight", 200, weight_entry, f"date={self.today}")
        
        return success

    def test_steps_apis(self):
        """Test steps tracking"""
        print("\n👣 Testing Steps APIs...")
        
        # Get steps
        success, steps = self.run_test("Get Steps", "GET", "steps", 200, query_params=f"date={self.today}")
        
        if success:
            # Log steps
            steps_entry = {"steps": 8500, "source": "manual"}
            self.run_test("Log Steps", "POST", "steps", 200, steps_entry, f"date={self.today}")
        
        return success

    def test_dashboard_api(self):
        """Test comprehensive dashboard"""
        print("\n📊 Testing Dashboard API...")
        return self.run_test("Get Dashboard", "GET", "dashboard", 200, query_params=f"date={self.today}")

    def test_progress_api(self):
        """Test progress tracking"""
        print("\n📈 Testing Progress API...")
        return self.run_test("Get Progress", "GET", "progress", 200, query_params="days=7")

    def test_meal_planner_apis(self):
        """Test meal planning"""
        print("\n📅 Testing Meal Planner APIs...")
        
        # Get meal plan
        week_start = (datetime.now() - timedelta(days=datetime.now().weekday())).strftime('%Y-%m-%d')
        success, meal_plan = self.run_test("Get Meal Plan", "GET", "meal-plan", 200, query_params=f"week_start={week_start}")
        
        if success:
            # Add meal to plan
            meal_entry = {
                "day_of_week": 0,  # Monday
                "meal_type": "breakfast",
                "food_name": "Test Oatmeal",
                "calories": 150
            }
            success, entry = self.run_test("Add Meal to Plan", "POST", "meal-plan", 200, meal_entry, f"week_start={week_start}")
            
            if success and 'meal_id' in entry:
                # Remove meal from plan
                self.run_test("Remove Meal from Plan", "DELETE", f"meal-plan/{entry['meal_id']}", 200, query_params=f"week_start={week_start}")
        
        return success

    def test_connected_apps_api(self):
        """Test fitness integrations"""
        print("\n📱 Testing Connected Apps APIs...")
        return self.run_test("Get Connected Apps", "GET", "connected-apps", 200)

    def test_food_search_apis(self):
        """Test USDA food search"""
        print("\n🔍 Testing Food Search APIs...")
        
        # Search foods
        search_data = {"query": "apple", "page_size": 5}
        success, foods = self.run_test("Search Foods", "POST", "foods/search", 200, search_data)
        
        if success and foods.get('foods'):
            # Get food details
            first_food = foods['foods'][0]
            if 'fdc_id' in first_food:
                self.run_test("Get Food Details", "GET", f"foods/{first_food['fdc_id']}", 200)
        
        return success

    def test_reference_apis(self):
        """Test reference data endpoints"""
        print("\n📚 Testing Reference APIs...")
        
        self.run_test("Get Workout Types", "GET", "reference/workout-types", 200)
        self.run_test("Get Cooking Methods", "GET", "reference/cooking-methods", 200)
        return True

def main():
    print("🏥 ElementEats Health Tracking API Test Suite")
    print("=" * 50)
    
    tester = HealthTrackingAPITester()
    
    # Test authentication first
    auth_success, user_data = tester.test_auth()
    if not auth_success:
        print("❌ Authentication failed! Cannot proceed with testing.")
        return 1
    
    print(f"✅ Authenticated as: {user_data.get('name', 'Unknown')}")
    
    # Run all tests
    test_functions = [
        tester.test_goals_apis,
        tester.test_food_log_apis,
        tester.test_water_log_apis,
        tester.test_workout_apis,
        tester.test_weight_apis,
        tester.test_steps_apis,
        tester.test_dashboard_api,
        tester.test_progress_api,
        tester.test_meal_planner_apis,
        tester.test_connected_apps_api,
        tester.test_food_search_apis,
        tester.test_reference_apis
    ]
    
    for test_func in test_functions:
        try:
            test_func()
        except Exception as e:
            print(f"❌ Test suite error: {e}")
    
    # Print summary
    print("\n" + "=" * 50)
    print(f"📊 FINAL RESULTS:")
    print(f"   Tests Run: {tester.tests_run}")
    print(f"   Tests Passed: {tester.tests_passed}")
    print(f"   Tests Failed: {len(tester.failed_tests)}")
    print(f"   Success Rate: {(tester.tests_passed/tester.tests_run)*100:.1f}%")
    
    if tester.failed_tests:
        print(f"\n❌ FAILED TESTS:")
        for failure in tester.failed_tests:
            test_name = failure.get('test', 'Unknown')
            if 'error' in failure:
                error_detail = failure.get('error')
            else:
                expected = failure.get('expected')
                actual = failure.get('actual')
                error_detail = f'Expected {expected}, got {actual}'
            print(f"   - {test_name}: {error_detail}")
    
    return 0 if len(tester.failed_tests) == 0 else 1

if __name__ == "__main__":
    sys.exit(main())