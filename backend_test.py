#!/usr/bin/env python3
"""
NutriOS Payment System Backend Testing
Tests all payment endpoints and related functionality
"""

import requests
import json
import sys
import time
from datetime import datetime
import pymongo

# Configuration
BASE_URL = "http://localhost:8001"
API_BASE = f"{BASE_URL}/api"

# MongoDB connection for test setup
MONGO_URL = "mongodb://localhost:27017"
DB_NAME = "nutrient_mapper"

# Test user credentials from MongoDB
USER_ID = "user_0de05ad0fec8"
SESSION_TOKEN = "dIBgVnFBWv0OAJfRsOcXzWZtJJ46C_ocIKJ7c_VbZWw"

# Headers for authenticated requests
AUTH_HEADERS = {
    "Authorization": f"Bearer {SESSION_TOKEN}",
    "Content-Type": "application/json"
}

def log_test(test_name, status, details=""):
    """Log test results"""
    timestamp = datetime.now().strftime("%H:%M:%S")
    status_symbol = "✅" if status == "PASS" else "❌" if status == "FAIL" else "⚠️"
    print(f"[{timestamp}] {status_symbol} {test_name}")
    if details:
        print(f"    {details}")
    print()

def test_health_check():
    """Test basic health check endpoint"""
    try:
        response = requests.get(f"{API_BASE}/", timeout=10)
        if response.status_code == 200:
            log_test("Health Check", "PASS", f"Status: {response.status_code}")
            return True
        else:
            log_test("Health Check", "FAIL", f"Status: {response.status_code}")
            return False
    except Exception as e:
        log_test("Health Check", "FAIL", f"Error: {str(e)}")
        return False

def test_payment_status():
    """Test payment status endpoint"""
    try:
        response = requests.get(f"{API_BASE}/payments/status", headers=AUTH_HEADERS, timeout=10)
        
        if response.status_code == 200:
            data = response.json()
            required_fields = ["is_premium", "trial_active", "trial_days_remaining", "has_access", "price_eur"]
            
            missing_fields = [field for field in required_fields if field not in data]
            if missing_fields:
                log_test("Payment Status", "FAIL", f"Missing fields: {missing_fields}")
                return False
            
            # Validate trial_days_remaining is between 0-14
            trial_days = data.get("trial_days_remaining", -1)
            if not (0 <= trial_days <= 14):
                log_test("Payment Status", "FAIL", f"Invalid trial_days_remaining: {trial_days} (should be 0-14)")
                return False
            
            # Validate has_access is true (trial still active)
            if not data.get("has_access", False):
                log_test("Payment Status", "WARN", f"has_access is False - trial may have expired")
            
            log_test("Payment Status", "PASS", 
                    f"is_premium: {data['is_premium']}, trial_active: {data['trial_active']}, "
                    f"trial_days_remaining: {data['trial_days_remaining']}, has_access: {data['has_access']}, "
                    f"price_eur: {data['price_eur']}")
            return True
        else:
            log_test("Payment Status", "FAIL", f"Status: {response.status_code}, Response: {response.text}")
            return False
    except Exception as e:
        log_test("Payment Status", "FAIL", f"Error: {str(e)}")
        return False

def test_create_checkout():
    """Test create checkout session endpoint"""
    try:
        payload = {
            "origin_url": "https://meal-sync-test.preview.emergentagent.com"
        }
        
        response = requests.post(f"{API_BASE}/payments/create-checkout", 
                               headers=AUTH_HEADERS, 
                               json=payload, 
                               timeout=15)
        
        if response.status_code == 200:
            data = response.json()
            
            # Check required fields
            if "url" not in data or "session_id" not in data:
                log_test("Create Checkout", "FAIL", f"Missing url or session_id in response: {data}")
                return False, None
            
            # Validate URL starts with Stripe checkout
            if not data["url"].startswith("https://checkout.stripe.com"):
                log_test("Create Checkout", "FAIL", f"Invalid checkout URL: {data['url']}")
                return False, None
            
            # Validate session_id starts with cs_
            if not data["session_id"].startswith("cs_"):
                log_test("Create Checkout", "FAIL", f"Invalid session_id format: {data['session_id']}")
                return False, None
            
            log_test("Create Checkout", "PASS", 
                    f"URL: {data['url'][:50]}..., Session ID: {data['session_id']}")
            return True, data["session_id"]
        
        elif response.status_code == 400:
            # Check if already premium
            error_data = response.json()
            if "Already purchased" in error_data.get("detail", ""):
                log_test("Create Checkout", "PASS", "User already premium - expected behavior")
                return True, None
            else:
                log_test("Create Checkout", "FAIL", f"Status: {response.status_code}, Error: {error_data}")
                return False, None
        else:
            log_test("Create Checkout", "FAIL", f"Status: {response.status_code}, Response: {response.text}")
            return False, None
    except Exception as e:
        log_test("Create Checkout", "FAIL", f"Error: {str(e)}")
        return False, None

def test_checkout_status(session_id):
    """Test checkout status endpoint"""
    if not session_id:
        log_test("Checkout Status", "SKIP", "No session_id available")
        return True
    
    try:
        response = requests.get(f"{API_BASE}/payments/checkout/status/{session_id}", 
                              headers=AUTH_HEADERS, 
                              timeout=10)
        
        if response.status_code == 200:
            data = response.json()
            
            # Check required fields
            required_fields = ["status", "payment_status"]
            missing_fields = [field for field in required_fields if field not in data]
            if missing_fields:
                log_test("Checkout Status", "FAIL", f"Missing fields: {missing_fields}")
                return False
            
            log_test("Checkout Status", "PASS", 
                    f"Status: {data['status']}, Payment Status: {data['payment_status']}")
            return True
        else:
            log_test("Checkout Status", "FAIL", f"Status: {response.status_code}, Response: {response.text}")
            return False
    except Exception as e:
        log_test("Checkout Status", "FAIL", f"Error: {str(e)}")
        return False

def test_delete_account():
    """Test delete account endpoint with separate test user"""
    try:
        # Connect to MongoDB to create test user
        client = pymongo.MongoClient(MONGO_URL)
        db = client[DB_NAME]
        
        # Create test user
        test_user = {
            "user_id": "delete_test_123",
            "email": "delete@test.com",
            "name": "Delete Test",
            "created_at": "2026-03-24T00:00:00Z"
        }
        db.users.insert_one(test_user)
        
        # Create test session
        test_session = {
            "session_token": "delete_test_token_abc",
            "user_id": "delete_test_123",
            "expires_at": "2027-01-01T00:00:00Z"
        }
        db.user_sessions.insert_one(test_session)
        
        # Test delete account
        delete_headers = {
            "Authorization": "Bearer delete_test_token_abc",
            "Content-Type": "application/json"
        }
        
        response = requests.delete(f"{API_BASE}/user/account", 
                                 headers=delete_headers, 
                                 timeout=10)
        
        if response.status_code == 200:
            data = response.json()
            if "deleted" in data.get("message", "").lower():
                # Verify user is gone from database
                user_check = db.users.find_one({"user_id": "delete_test_123"})
                if user_check is None:
                    log_test("Delete Account", "PASS", f"Account deleted successfully: {data['message']}")
                    return True
                else:
                    log_test("Delete Account", "FAIL", "User still exists in database after deletion")
                    return False
            else:
                log_test("Delete Account", "FAIL", f"Unexpected response: {data}")
                return False
        else:
            log_test("Delete Account", "FAIL", f"Status: {response.status_code}, Response: {response.text}")
            return False
            
    except Exception as e:
        log_test("Delete Account", "FAIL", f"Error: {str(e)}")
        return False
    finally:
        # Cleanup - remove test user if still exists
        try:
            client = pymongo.MongoClient(MONGO_URL)
            db = client[DB_NAME]
            db.users.delete_many({"user_id": "delete_test_123"})
            db.user_sessions.delete_many({"user_id": "delete_test_123"})
        except:
            pass

def test_user_settings():
    """Test user settings endpoints"""
    try:
        # Test GET user settings
        response = requests.get(f"{API_BASE}/user/settings", headers=AUTH_HEADERS, timeout=10)
        
        if response.status_code != 200:
            log_test("User Settings GET", "FAIL", f"Status: {response.status_code}, Response: {response.text}")
            return False
        
        settings_data = response.json()
        log_test("User Settings GET", "PASS", f"Retrieved settings: {list(settings_data.keys())}")
        
        # Test PUT user settings
        update_payload = {
            "notifications_enabled": True,
            "water_reminder_enabled": True,
            "meal_reminder_enabled": True,
            "routine_reminder_enabled": True
        }
        
        response = requests.put(f"{API_BASE}/user/settings", 
                              headers=AUTH_HEADERS, 
                              json=update_payload, 
                              timeout=10)
        
        if response.status_code == 200:
            data = response.json()
            log_test("User Settings PUT", "PASS", f"Settings updated: {data.get('message', 'Success')}")
            return True
        else:
            log_test("User Settings PUT", "FAIL", f"Status: {response.status_code}, Response: {response.text}")
            return False
            
    except Exception as e:
        log_test("User Settings", "FAIL", f"Error: {str(e)}")
        return False

def test_stripe_webhook():
    """Test Stripe webhook endpoint"""
    try:
        # Send empty body to webhook endpoint (no auth needed)
        response = requests.post(f"{API_BASE}/webhook/stripe", 
                               json={}, 
                               timeout=10)
        
        # Should return 200 (not 404/405)
        if response.status_code == 200:
            log_test("Stripe Webhook", "PASS", f"Webhook endpoint accessible, Status: {response.status_code}")
            return True
        else:
            log_test("Stripe Webhook", "FAIL", f"Status: {response.status_code}, Response: {response.text}")
            return False
    except Exception as e:
        log_test("Stripe Webhook", "FAIL", f"Error: {str(e)}")
        return False

def main():
    """Run all payment system tests"""
    print("🧬 NutriOS Payment System Backend Testing")
    print("=" * 50)
    print(f"Base URL: {BASE_URL}")
    print(f"User ID: {USER_ID}")
    print(f"Session Token: {SESSION_TOKEN[:20]}...")
    print()
    
    results = []
    
    # Test 1: Health Check
    results.append(test_health_check())
    
    # Test 2: Payment Status Check
    results.append(test_payment_status())
    
    # Test 3: Create Checkout Session
    checkout_success, session_id = test_create_checkout()
    results.append(checkout_success)
    
    # Test 4: Check Checkout Status
    results.append(test_checkout_status(session_id))
    
    # Test 5: Delete Account Test
    results.append(test_delete_account())
    
    # Test 6: User Settings
    results.append(test_user_settings())
    
    # Test 7: Stripe Webhook
    results.append(test_stripe_webhook())
    
    # Summary
    print("=" * 50)
    print("📊 TEST SUMMARY")
    print("=" * 50)
    
    passed = sum(1 for r in results if r)
    total = len(results)
    
    print(f"✅ Passed: {passed}/{total}")
    print(f"❌ Failed: {total - passed}/{total}")
    print(f"📈 Success Rate: {(passed/total)*100:.1f}%")
    
    if passed == total:
        print("\n🎉 All payment system tests passed!")
        return 0
    else:
        print(f"\n⚠️  {total - passed} test(s) failed. Check logs above.")
        return 1

if __name__ == "__main__":
    sys.exit(main())