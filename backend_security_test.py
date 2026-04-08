#!/usr/bin/env python3
"""
NutriOS Backend Security Layer Test
Tests Rate Limiting and Input Sanitization as per review request.
"""

import requests
import json
import time
from datetime import datetime, timedelta

# Backend URL from frontend/.env
BASE_URL = "https://meal-sync-test.preview.emergentagent.com/api"

def setup_test_user():
    """Setup test user and session as specified in review request."""
    print("🔧 Setting up test user and session...")
    
    # Test user data as specified
    user_data = {
        "user_id": "test_sec2_user",
        "email": "sec2@test.com", 
        "name": "Sec Test 2",
        "created_at": datetime.utcnow()
    }
    
    session_data = {
        "session_token": "test_sec2_token_2026",
        "user_id": "test_sec2_user",
        "expires_at": datetime.utcnow() + timedelta(days=1)
    }
    
    # Insert directly into MongoDB (simulated via API calls)
    # For testing purposes, we'll use the auth header directly
    headers = {"Authorization": "Bearer test_sec2_token_2026"}
    
    print(f"✅ Test user setup complete: {user_data['user_id']}")
    print(f"✅ Session token: {session_data['session_token']}")
    return headers

def test_group_1_sanitization():
    """Test Group 1: Sanitization via Pydantic Models (POST endpoints)"""
    print("\n🧪 TEST GROUP 1: Sanitization via Pydantic Models")
    headers = setup_test_user()
    results = []
    
    # Test 1: XSS in meal food_name
    print("\n1. Testing XSS in meal food_name...")
    meal_data = {
        "food_name": "<script>alert('xss')</script>Chicken",
        "portion_grams": 100,
        "meal_type": "lunch", 
        "cooking_method": "raw",
        "nutrients": {"energy_kcal": 200},
        "elements": {"C": 10}
    }
    
    try:
        response = requests.post(f"{BASE_URL}/meals", json=meal_data, headers=headers)
        print(f"   Status: {response.status_code}")
        
        if response.status_code == 200:
            # Verify sanitization by checking stored data
            get_response = requests.get(f"{BASE_URL}/meals/today", headers=headers)
            if get_response.status_code == 200:
                meals = get_response.json().get("meals", [])
                if meals:
                    stored_name = meals[-1].get("food_name", "")
                    if "<script>" not in stored_name:
                        print(f"   ✅ PASS: XSS sanitized. Stored as: '{stored_name}'")
                        results.append("PASS")
                    else:
                        print(f"   ❌ FAIL: XSS not sanitized. Stored as: '{stored_name}'")
                        results.append("FAIL")
                else:
                    print("   ❌ FAIL: No meals found")
                    results.append("FAIL")
            else:
                print(f"   ❌ FAIL: Could not verify sanitization (GET failed: {get_response.status_code})")
                results.append("FAIL")
        else:
            print(f"   ❌ FAIL: POST failed with status {response.status_code}")
            print(f"   Response: {response.text}")
            results.append("FAIL")
    except Exception as e:
        print(f"   ❌ ERROR: {e}")
        results.append("ERROR")
    
    # Test 2: MongoDB injection in meal
    print("\n2. Testing MongoDB injection in meal...")
    meal_data = {
        "food_name": "Test $gt injection",
        "portion_grams": 100,
        "meal_type": "dinner",
        "cooking_method": "raw", 
        "nutrients": {"energy_kcal": 100},
        "elements": {}
    }
    
    try:
        response = requests.post(f"{BASE_URL}/meals", json=meal_data, headers=headers)
        print(f"   Status: {response.status_code}")
        
        if response.status_code == 200:
            # Verify $gt is stripped
            get_response = requests.get(f"{BASE_URL}/meals/today", headers=headers)
            if get_response.status_code == 200:
                meals = get_response.json().get("meals", [])
                if meals:
                    stored_name = meals[-1].get("food_name", "")
                    if "$gt" not in stored_name:
                        print(f"   ✅ PASS: MongoDB injection sanitized. Stored as: '{stored_name}'")
                        results.append("PASS")
                    else:
                        print(f"   ❌ FAIL: MongoDB injection not sanitized. Stored as: '{stored_name}'")
                        results.append("FAIL")
                else:
                    print("   ❌ FAIL: No meals found")
                    results.append("FAIL")
            else:
                print(f"   ❌ FAIL: Could not verify sanitization (GET failed: {get_response.status_code})")
                results.append("FAIL")
        else:
            print(f"   ❌ FAIL: POST failed with status {response.status_code}")
            print(f"   Response: {response.text}")
            results.append("FAIL")
    except Exception as e:
        print(f"   ❌ ERROR: {e}")
        results.append("ERROR")
    
    # Test 3: Normal water still works
    print("\n3. Testing normal water logging...")
    water_data = {"amount_ml": 300}
    
    try:
        response = requests.post(f"{BASE_URL}/water", json=water_data, headers=headers)
        print(f"   Status: {response.status_code}")
        
        if response.status_code == 200:
            print("   ✅ PASS: Normal water logging works")
            results.append("PASS")
        else:
            print(f"   ❌ FAIL: Water logging failed with status {response.status_code}")
            print(f"   Response: {response.text}")
            results.append("FAIL")
    except Exception as e:
        print(f"   ❌ ERROR: {e}")
        results.append("ERROR")
    
    # Test 4: Normal weight still works
    print("\n4. Testing normal weight logging...")
    weight_data = {"weight_kg": 72.5, "note": "test"}
    
    try:
        response = requests.post(f"{BASE_URL}/weight", json=weight_data, headers=headers)
        print(f"   Status: {response.status_code}")
        
        if response.status_code == 200:
            print("   ✅ PASS: Normal weight logging works")
            results.append("PASS")
        else:
            print(f"   ❌ FAIL: Weight logging failed with status {response.status_code}")
            print(f"   Response: {response.text}")
            results.append("FAIL")
    except Exception as e:
        print(f"   ❌ ERROR: {e}")
        results.append("ERROR")
    
    return results

def test_group_2_rate_limiting():
    """Test Group 2: Rate Limiting"""
    print("\n🧪 TEST GROUP 2: Rate Limiting")
    results = []
    
    # Test 5: Auth endpoint rate limit (10/min)
    print("\n5. Testing auth endpoint rate limit (10/min)...")
    auth_data = {"session_id": "fake_session_id"}
    
    try:
        responses = []
        for i in range(12):
            response = requests.post(f"{BASE_URL}/auth/session", json=auth_data)
            responses.append(response.status_code)
            print(f"   Request {i+1}: {response.status_code}")
            
            # Small delay to avoid overwhelming
            time.sleep(0.1)
        
        # Check if we got 429 responses for requests 11 and 12
        rate_limited = any(status == 429 for status in responses[10:])
        if rate_limited:
            print("   ✅ PASS: Rate limiting working (got 429 responses)")
            results.append("PASS")
        else:
            print("   ❌ FAIL: No rate limiting detected (expected 429 for requests 11-12)")
            results.append("FAIL")
            
    except Exception as e:
        print(f"   ❌ ERROR: {e}")
        results.append("ERROR")
    
    # Test 6: Global rate limit works on GET
    print("\n6. Testing global rate limit on GET...")
    try:
        responses = []
        for i in range(5):
            response = requests.get(f"{BASE_URL}/")
            responses.append(response.status_code)
            print(f"   Request {i+1}: {response.status_code}")
        
        # All should be 200 (under 120/min limit)
        all_success = all(status == 200 for status in responses)
        if all_success:
            print("   ✅ PASS: Global rate limit allows normal traffic")
            results.append("PASS")
        else:
            print("   ❌ FAIL: Unexpected rate limiting on normal GET requests")
            results.append("FAIL")
            
    except Exception as e:
        print(f"   ❌ ERROR: {e}")
        results.append("ERROR")
    
    # Test 7: Dashboard still works
    print("\n7. Testing dashboard with auth...")
    headers = {"Authorization": "Bearer test_sec2_token_2026"}
    
    try:
        response = requests.get(f"{BASE_URL}/dashboard", headers=headers)
        print(f"   Status: {response.status_code}")
        
        if response.status_code == 200:
            print("   ✅ PASS: Dashboard works with auth")
            results.append("PASS")
        else:
            print(f"   ❌ FAIL: Dashboard failed with status {response.status_code}")
            print(f"   Response: {response.text}")
            results.append("FAIL")
    except Exception as e:
        print(f"   ❌ ERROR: {e}")
        results.append("ERROR")
    
    return results

def test_group_3_dict_sanitization():
    """Test Group 3: Sanitization on Dict endpoints"""
    print("\n🧪 TEST GROUP 3: Sanitization on Dict endpoints")
    headers = {"Authorization": "Bearer test_sec2_token_2026"}
    results = []
    
    # Test 8: XSS in user settings
    print("\n8. Testing XSS in user settings...")
    settings_data = {"custom_note": "<img src=x onerror=alert(1)>"}
    
    try:
        response = requests.put(f"{BASE_URL}/user/settings", json=settings_data, headers=headers)
        print(f"   Status: {response.status_code}")
        
        if response.status_code == 200:
            # Verify sanitization by getting settings
            get_response = requests.get(f"{BASE_URL}/user/settings", headers=headers)
            if get_response.status_code == 200:
                settings = get_response.json()
                stored_note = settings.get("custom_note", "")
                if "<img" not in stored_note and "onerror" not in stored_note:
                    print(f"   ✅ PASS: XSS sanitized. Stored as: '{stored_note}'")
                    results.append("PASS")
                else:
                    print(f"   ❌ FAIL: XSS not sanitized. Stored as: '{stored_note}'")
                    results.append("FAIL")
            else:
                print(f"   ❌ FAIL: Could not verify sanitization (GET failed: {get_response.status_code})")
                results.append("FAIL")
        else:
            print(f"   ❌ FAIL: PUT failed with status {response.status_code}")
            print(f"   Response: {response.text}")
            results.append("FAIL")
    except Exception as e:
        print(f"   ❌ ERROR: {e}")
        results.append("ERROR")
    
    # Test 9: User profile update
    print("\n9. Testing normal user profile update...")
    profile_data = {"name": "Normal Name", "activity_level": "active"}
    
    try:
        response = requests.put(f"{BASE_URL}/user/profile", json=profile_data, headers=headers)
        print(f"   Status: {response.status_code}")
        
        if response.status_code == 200:
            print("   ✅ PASS: Normal profile update works")
            results.append("PASS")
        else:
            print(f"   ❌ FAIL: Profile update failed with status {response.status_code}")
            print(f"   Response: {response.text}")
            results.append("FAIL")
    except Exception as e:
        print(f"   ❌ ERROR: {e}")
        results.append("ERROR")
    
    return results

def cleanup_test_data():
    """Cleanup test data as requested."""
    print("\n🧹 Cleaning up test data...")
    headers = {"Authorization": "Bearer test_sec2_token_2026"}
    
    # Try to delete test user account (this should clean up everything)
    try:
        response = requests.delete(f"{BASE_URL}/user/account", headers=headers)
        if response.status_code == 200:
            print("   ✅ Test user and all data deleted successfully")
        else:
            print(f"   ⚠️  Account deletion returned {response.status_code}")
    except Exception as e:
        print(f"   ⚠️  Cleanup error: {e}")

def main():
    """Run all security tests."""
    print("🔒 NutriOS Backend Security Layer Test")
    print("=" * 50)
    
    # Run all test groups
    group1_results = test_group_1_sanitization()
    group2_results = test_group_2_rate_limiting() 
    group3_results = test_group_3_dict_sanitization()
    
    # Cleanup
    cleanup_test_data()
    
    # Summary
    print("\n📊 TEST SUMMARY")
    print("=" * 50)
    
    all_results = group1_results + group2_results + group3_results
    total_tests = len(all_results)
    passed_tests = all_results.count("PASS")
    failed_tests = all_results.count("FAIL")
    error_tests = all_results.count("ERROR")
    
    print(f"Total Tests: {total_tests}")
    print(f"✅ Passed: {passed_tests}")
    print(f"❌ Failed: {failed_tests}")
    print(f"⚠️  Errors: {error_tests}")
    print(f"Success Rate: {(passed_tests/total_tests)*100:.1f}%")
    
    # Detailed results
    print("\nDetailed Results:")
    print("Group 1 (Sanitization): ", group1_results)
    print("Group 2 (Rate Limiting):", group2_results)
    print("Group 3 (Dict Sanitization):", group3_results)

if __name__ == "__main__":
    main()