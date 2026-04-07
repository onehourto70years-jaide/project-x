#!/usr/bin/env python3
"""
NutriOS Reports & Data Export API Testing
Testing NEW Reports & Data Export API endpoints as per review request.
"""

import requests
import json
from datetime import datetime, timedelta
import pymongo
from pymongo import MongoClient
import uuid

# Configuration
BACKEND_URL = "https://meal-sync-test.preview.emergentagent.com/api"
MONGO_URL = "mongodb://localhost:27017/nutrient_mapper"

# Test data
TEST_USER_ID = "test_report_user"
TEST_EMAIL = "report_test@test.com"
TEST_NAME = "Report Test"
TEST_SESSION_TOKEN = "test_report_token_2026"

def setup_test_data():
    """Setup test user and sample data in MongoDB as per review request."""
    print("🔧 Setting up test data in MongoDB...")
    
    client = MongoClient(MONGO_URL)
    db = client.nutrient_mapper
    
    # Get today's date and 7 days ago
    today = datetime.now().strftime("%Y-%m-%d")
    week_ago = (datetime.now() - timedelta(days=7)).strftime("%Y-%m-%d")
    
    # 1. Insert test user
    user_doc = {
        "user_id": TEST_USER_ID,
        "email": TEST_EMAIL,
        "name": TEST_NAME,
        "created_at": datetime.now()
    }
    db.users.insert_one(user_doc)
    print(f"✅ Created test user: {TEST_USER_ID}")
    
    # 2. Insert session
    session_doc = {
        "session_token": TEST_SESSION_TOKEN,
        "user_id": TEST_USER_ID,
        "expires_at": datetime.now() + timedelta(days=1)
    }
    db.user_sessions.insert_one(session_doc)
    print(f"✅ Created session token: {TEST_SESSION_TOKEN}")
    
    # 3. Insert sample daily_summaries
    daily_summaries = [
        {
            "user_id": TEST_USER_ID,
            "date": today,
            "total_calories": 2100,
            "total_protein": 120,
            "total_carbs": 250,
            "total_fat": 70,
            "routines_completed": 3,
            "routines_total": 5
        },
        {
            "user_id": TEST_USER_ID,
            "date": week_ago,
            "total_calories": 1800,
            "total_protein": 100,
            "total_carbs": 200,
            "total_fat": 60,
            "routines_completed": 2,
            "routines_total": 4
        }
    ]
    db.daily_summaries.insert_many(daily_summaries)
    print(f"✅ Created daily summaries for {today} and {week_ago}")
    
    # 4. Insert sample water_logs
    water_logs = [
        {
            "user_id": TEST_USER_ID,
            "date": today,
            "amount_ml": 500
        },
        {
            "user_id": TEST_USER_ID,
            "date": week_ago,
            "amount_ml": 400
        }
    ]
    db.water_logs.insert_many(water_logs)
    print(f"✅ Created water logs for {today} and {week_ago}")
    
    # 5. Insert sample meals
    meal_doc = {
        "id": "test_meal_1",
        "user_id": TEST_USER_ID,
        "food_name": "Chicken Breast",
        "date": today,
        "meal_type": "lunch",
        "portion_grams": 200,
        "nutrients": {
            "energy_kcal": 330,
            "protein_g": 62
        },
        "cooking_method": "grilled"
    }
    db.meals.insert_one(meal_doc)
    print(f"✅ Created test meal for {today}")
    
    # 6. Insert sample weight_logs
    weight_doc = {
        "id": "test_wl_1",
        "user_id": TEST_USER_ID,
        "weight_kg": 75.0,
        "date": today,
        "note": "Morning"
    }
    db.weight_logs.insert_one(weight_doc)
    print(f"✅ Created weight log for {today}")
    
    client.close()
    print("🔧 Test data setup complete!")
    return today, week_ago

def cleanup_test_data():
    """Clean up all test data from MongoDB."""
    print("🧹 Cleaning up test data...")
    
    client = MongoClient(MONGO_URL)
    db = client.nutrient_mapper
    
    # Delete all test data
    collections = ['users', 'user_sessions', 'daily_summaries', 'water_logs', 'meals', 'weight_logs']
    for collection in collections:
        result = db[collection].delete_many({"user_id": TEST_USER_ID})
        print(f"✅ Deleted {result.deleted_count} documents from {collection}")
    
    client.close()
    print("🧹 Cleanup complete!")

def test_weekly_comparison_authorized():
    """Test GET /api/reports/weekly-comparison with authorization."""
    print("\n📊 Testing Weekly Comparison Report (Authorized)...")
    
    headers = {
        "Authorization": f"Bearer {TEST_SESSION_TOKEN}",
        "Content-Type": "application/json"
    }
    
    try:
        response = requests.get(f"{BACKEND_URL}/reports/weekly-comparison", headers=headers)
        print(f"Status Code: {response.status_code}")
        
        if response.status_code == 200:
            data = response.json()
            print("✅ PASS - Weekly comparison endpoint working")
            
            # Verify response structure
            required_keys = ['this_week', 'last_week', 'comparisons']
            for key in required_keys:
                if key not in data:
                    print(f"❌ FAIL - Missing key: {key}")
                    return False
            
            # Verify this_week structure
            this_week_keys = ['nutrition', 'water', 'routines', 'weight', 'meals_count']
            for key in this_week_keys:
                if key not in data['this_week']:
                    print(f"❌ FAIL - Missing this_week key: {key}")
                    return False
            
            # Verify last_week structure
            for key in this_week_keys:
                if key not in data['last_week']:
                    print(f"❌ FAIL - Missing last_week key: {key}")
                    return False
            
            # Verify comparisons structure
            comparison_keys = ['calories', 'protein', 'carbs', 'fat', 'water', 'routines']
            for key in comparison_keys:
                if key not in data['comparisons']:
                    print(f"❌ FAIL - Missing comparisons key: {key}")
                    return False
            
            print(f"📊 This week nutrition: {data['this_week']['nutrition']}")
            print(f"📊 Last week nutrition: {data['last_week']['nutrition']}")
            print(f"📊 Comparisons: {data['comparisons']}")
            
            return True
        else:
            print(f"❌ FAIL - Expected 200, got {response.status_code}")
            print(f"Response: {response.text}")
            return False
            
    except Exception as e:
        print(f"❌ FAIL - Exception: {e}")
        return False

def test_export_data_authorized():
    """Test GET /api/reports/export-data with authorization."""
    print("\n📤 Testing Data Export (Authorized)...")
    
    headers = {
        "Authorization": f"Bearer {TEST_SESSION_TOKEN}",
        "Content-Type": "application/json"
    }
    
    try:
        response = requests.get(f"{BACKEND_URL}/reports/export-data", headers=headers)
        print(f"Status Code: {response.status_code}")
        
        if response.status_code == 200:
            data = response.json()
            print("✅ PASS - Data export endpoint working")
            
            # Verify response structure
            required_keys = ['meals', 'water', 'weight', 'daily_summaries', 'exported_at', 'user_email']
            for key in required_keys:
                if key not in data:
                    print(f"❌ FAIL - Missing key: {key}")
                    return False
            
            # Verify meals array contains our test meal
            meals = data['meals']
            if not isinstance(meals, list):
                print("❌ FAIL - meals should be an array")
                return False
            
            test_meal_found = False
            for meal in meals:
                if meal.get('food_name') == 'Chicken Breast':
                    test_meal_found = True
                    break
            
            if not test_meal_found:
                print("❌ FAIL - Test meal not found in export")
                return False
            
            # Verify water array contains our test water data
            water = data['water']
            if not isinstance(water, list):
                print("❌ FAIL - water should be an array")
                return False
            
            # Verify weight array contains our test weight log
            weight = data['weight']
            if not isinstance(weight, list):
                print("❌ FAIL - weight should be an array")
                return False
            
            test_weight_found = False
            for weight_entry in weight:
                if weight_entry.get('weight_kg') == 75.0:
                    test_weight_found = True
                    break
            
            if not test_weight_found:
                print("❌ FAIL - Test weight log not found in export")
                return False
            
            # Verify user_email matches
            if data['user_email'] != TEST_EMAIL:
                print(f"❌ FAIL - Expected email {TEST_EMAIL}, got {data['user_email']}")
                return False
            
            print(f"📤 Exported {len(meals)} meals, {len(water)} water entries, {len(weight)} weight entries")
            print(f"📤 User email: {data['user_email']}")
            print(f"📤 Export timestamp: {data['exported_at']}")
            
            return True
        else:
            print(f"❌ FAIL - Expected 200, got {response.status_code}")
            print(f"Response: {response.text}")
            return False
            
    except Exception as e:
        print(f"❌ FAIL - Exception: {e}")
        return False

def test_weekly_comparison_unauthorized():
    """Test GET /api/reports/weekly-comparison without authorization."""
    print("\n🔒 Testing Weekly Comparison Report (Unauthorized)...")
    
    try:
        response = requests.get(f"{BACKEND_URL}/reports/weekly-comparison")
        print(f"Status Code: {response.status_code}")
        
        if response.status_code == 401:
            print("✅ PASS - Unauthorized access properly blocked")
            return True
        else:
            print(f"❌ FAIL - Expected 401, got {response.status_code}")
            print(f"Response: {response.text}")
            return False
            
    except Exception as e:
        print(f"❌ FAIL - Exception: {e}")
        return False

def main():
    """Main test execution."""
    print("🚀 Starting NutriOS Reports & Data Export API Tests")
    print(f"Backend URL: {BACKEND_URL}")
    print(f"MongoDB URL: {MONGO_URL}")
    
    # Setup test data
    today, week_ago = setup_test_data()
    
    # Track test results
    test_results = []
    
    try:
        # Test 1: Weekly comparison (authorized)
        result1 = test_weekly_comparison_authorized()
        test_results.append(("Weekly Comparison (Authorized)", result1))
        
        # Test 2: Data export (authorized)
        result2 = test_export_data_authorized()
        test_results.append(("Data Export (Authorized)", result2))
        
        # Test 3: Weekly comparison (unauthorized)
        result3 = test_weekly_comparison_unauthorized()
        test_results.append(("Weekly Comparison (Unauthorized)", result3))
        
    finally:
        # Always cleanup
        cleanup_test_data()
    
    # Print summary
    print("\n" + "="*60)
    print("📋 TEST SUMMARY")
    print("="*60)
    
    passed = 0
    total = len(test_results)
    
    for test_name, result in test_results:
        status = "✅ PASS" if result else "❌ FAIL"
        print(f"{status} - {test_name}")
        if result:
            passed += 1
    
    print(f"\n🎯 Results: {passed}/{total} tests passed ({(passed/total)*100:.1f}%)")
    
    if passed == total:
        print("🎉 All tests passed! Reports & Data Export API is working correctly.")
    else:
        print("⚠️  Some tests failed. Please check the issues above.")

if __name__ == "__main__":
    main()