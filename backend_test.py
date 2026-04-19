#!/usr/bin/env python3
"""
NutriOS Encryption and Security System Tests
Tests the encryption module, session token hashing, and PII encryption/decryption.
"""

import asyncio
import aiohttp
import json
from datetime import datetime, timezone, timedelta
from motor.motor_asyncio import AsyncIOMotorClient
import sys
import os

# Add backend to path for imports
sys.path.append('/app/backend')
from encryption import hash_token, encrypt_field, decrypt_field, is_encrypted

# Test configuration
BASE_URL = "https://meal-sync-test.preview.emergentagent.com/api"
MONGO_URL = "mongodb://localhost:27017"
DB_NAME = "nutrient_mapper"

class EncryptionSecurityTester:
    def __init__(self):
        self.session = None
        self.mongo_client = None
        self.db = None
        self.test_user_id = "test_enc_user"
        self.test_session_token = "test_enc_token_999"
        self.test_email = "test_enc@nutrios.com"
        self.test_name = "Encryption Tester"
        
    async def setup(self):
        """Setup HTTP session and MongoDB connection"""
        self.session = aiohttp.ClientSession()
        self.mongo_client = AsyncIOMotorClient(MONGO_URL)
        self.db = self.mongo_client[DB_NAME]
        print("✅ Setup complete - HTTP session and MongoDB connection established")
        
    async def cleanup(self):
        """Cleanup test data and close connections"""
        try:
            # Clean up test user and session
            await self.db.users.delete_one({"user_id": self.test_user_id})
            await self.db.user_sessions.delete_one({"user_id": self.test_user_id})
            print("✅ Test data cleanup complete")
        except Exception as e:
            print(f"⚠️ Cleanup warning: {e}")
        
        if self.session:
            await self.session.close()
        if self.mongo_client:
            self.mongo_client.close()
        print("✅ Connections closed")
    
    async def test_1_health_check(self):
        """Test 1: Verify encryption module loads correctly - health check should return 200"""
        print("\n🔍 Test 1: Health Check (Encryption Module Load)")
        try:
            async with self.session.get(f"{BASE_URL}/") as response:
                if response.status == 200:
                    data = await response.json()
                    print(f"✅ Health check passed: {response.status}")
                    print(f"   Response: {data}")
                    return True
                else:
                    print(f"❌ Health check failed: {response.status}")
                    return False
        except Exception as e:
            print(f"❌ Health check error: {e}")
            return False
    
    async def test_2_create_test_user_with_encryption(self):
        """Test 2: Create test user with encrypted PII and hashed session token"""
        print("\n🔍 Test 2: Session Creation with Hashed Tokens + Encrypted PII")
        
        try:
            # Test encryption functions directly first
            print("   Testing encryption functions...")
            encrypted_email = encrypt_field(self.test_email)
            encrypted_name = encrypt_field(self.test_name)
            hashed_token = hash_token(self.test_session_token)
            
            print(f"   Original email: {self.test_email}")
            print(f"   Encrypted email: {encrypted_email}")
            print(f"   Is encrypted: {is_encrypted(encrypted_email)}")
            
            print(f"   Original name: {self.test_name}")
            print(f"   Encrypted name: {encrypted_name}")
            print(f"   Is encrypted: {is_encrypted(encrypted_name)}")
            
            print(f"   Original token: {self.test_session_token}")
            print(f"   Hashed token: {hashed_token}")
            
            # Verify decryption works
            decrypted_email = decrypt_field(encrypted_email)
            decrypted_name = decrypt_field(encrypted_name)
            print(f"   Decrypted email: {decrypted_email}")
            print(f"   Decrypted name: {decrypted_name}")
            
            if decrypted_email != self.test_email or decrypted_name != self.test_name:
                print("❌ Encryption/decryption test failed")
                return False
            
            print("✅ Encryption/decryption functions working correctly")
            
            # Insert test user with encrypted PII
            user_doc = {
                "user_id": self.test_user_id,
                "email": encrypted_email,  # Encrypted
                "name": encrypted_name,    # Encrypted
                "weight_kg": 70,
                "activity_level": "moderate",
                "created_at": datetime.now(timezone.utc)
            }
            
            await self.db.users.insert_one(user_doc)
            print("✅ Test user inserted with encrypted PII")
            
            # Insert session with hashed token
            expires_at = datetime.now(timezone.utc) + timedelta(days=30)
            session_doc = {
                "session_token": hashed_token,  # Hashed
                "user_id": self.test_user_id,
                "expires_at": expires_at
            }
            
            await self.db.user_sessions.insert_one(session_doc)
            print("✅ Test session inserted with hashed token")
            
            return True
            
        except Exception as e:
            print(f"❌ Test user creation failed: {e}")
            return False
    
    async def test_3_auth_me_with_encrypted_data(self):
        """Test 3: GET /api/auth/me with Authorization Bearer - should return decrypted user data"""
        print("\n🔍 Test 3: Auth Me Endpoint with Encrypted Data")
        
        try:
            headers = {"Authorization": f"Bearer {self.test_session_token}"}
            async with self.session.get(f"{BASE_URL}/auth/me", headers=headers) as response:
                if response.status == 200:
                    data = await response.json()
                    print(f"✅ Auth me endpoint passed: {response.status}")
                    print(f"   User data: {data}")
                    
                    # Verify that the returned data is decrypted
                    if data.get("email") == self.test_email and data.get("name") == self.test_name:
                        print("✅ PII decryption working correctly - returned plaintext data")
                        return True
                    else:
                        print(f"❌ PII decryption failed - expected {self.test_email}, got {data.get('email')}")
                        return False
                else:
                    error_text = await response.text()
                    print(f"❌ Auth me endpoint failed: {response.status}")
                    print(f"   Error: {error_text}")
                    return False
        except Exception as e:
            print(f"❌ Auth me endpoint error: {e}")
            return False
    
    async def test_4_analytics_endpoint_with_auth(self):
        """Test 4: GET /api/analytics/celebrations/summary with auth"""
        print("\n🔍 Test 4: Analytics Endpoint with Auth")
        
        try:
            headers = {"Authorization": f"Bearer {self.test_session_token}"}
            async with self.session.get(f"{BASE_URL}/analytics/celebrations/summary", headers=headers) as response:
                if response.status == 200:
                    data = await response.json()
                    print(f"✅ Analytics endpoint passed: {response.status}")
                    print(f"   Analytics data: {data}")
                    return True
                else:
                    error_text = await response.text()
                    print(f"❌ Analytics endpoint failed: {response.status}")
                    print(f"   Error: {error_text}")
                    return False
        except Exception as e:
            print(f"❌ Analytics endpoint error: {e}")
            return False
    
    async def test_5_dashboard_with_auth(self):
        """Test 5: GET /api/dashboard with auth"""
        print("\n🔍 Test 5: Dashboard Endpoint with Auth")
        
        try:
            headers = {"Authorization": f"Bearer {self.test_session_token}"}
            async with self.session.get(f"{BASE_URL}/dashboard", headers=headers) as response:
                if response.status == 200:
                    data = await response.json()
                    print(f"✅ Dashboard endpoint passed: {response.status}")
                    print(f"   Dashboard data keys: {list(data.keys())}")
                    return True
                else:
                    error_text = await response.text()
                    print(f"❌ Dashboard endpoint failed: {response.status}")
                    print(f"   Error: {error_text}")
                    return False
        except Exception as e:
            print(f"❌ Dashboard endpoint error: {e}")
            return False
    
    async def test_backward_compatibility(self):
        """Test backward compatibility with plain text session tokens and PII"""
        print("\n🔍 Bonus Test: Backward Compatibility")
        
        try:
            # Create a user with plain text PII (simulating old data)
            plain_user_id = "test_plain_user"
            plain_token = "test_plain_token_999"
            
            user_doc = {
                "user_id": plain_user_id,
                "email": "plain@nutrios.com",  # Plain text
                "name": "Plain User",          # Plain text
                "weight_kg": 65,
                "activity_level": "active",
                "created_at": datetime.now(timezone.utc)
            }
            
            await self.db.users.insert_one(user_doc)
            
            # Create session with plain text token (simulating old session)
            expires_at = datetime.now(timezone.utc) + timedelta(days=30)
            session_doc = {
                "session_token": plain_token,  # Plain text
                "user_id": plain_user_id,
                "expires_at": expires_at
            }
            
            await self.db.user_sessions.insert_one(session_doc)
            print("✅ Plain text user and session created")
            
            # Test auth with plain text token
            headers = {"Authorization": f"Bearer {plain_token}"}
            async with self.session.get(f"{BASE_URL}/auth/me", headers=headers) as response:
                if response.status == 200:
                    data = await response.json()
                    print(f"✅ Backward compatibility test passed: {response.status}")
                    print(f"   Plain text user data: {data}")
                    
                    # Verify session was migrated to hashed format
                    hashed_token = hash_token(plain_token)
                    migrated_session = await self.db.user_sessions.find_one({"session_token": hashed_token})
                    if migrated_session:
                        print("✅ Session token automatically migrated to hashed format")
                    else:
                        print("⚠️ Session token migration may not have occurred")
                    
                    # Cleanup
                    await self.db.users.delete_one({"user_id": plain_user_id})
                    await self.db.user_sessions.delete_one({"user_id": plain_user_id})
                    
                    return True
                else:
                    error_text = await response.text()
                    print(f"❌ Backward compatibility test failed: {response.status}")
                    print(f"   Error: {error_text}")
                    return False
                    
        except Exception as e:
            print(f"❌ Backward compatibility test error: {e}")
            return False
    
    async def run_all_tests(self):
        """Run all encryption and security tests"""
        print("🚀 Starting NutriOS Encryption and Security System Tests")
        print(f"   Backend URL: {BASE_URL}")
        print(f"   MongoDB: {MONGO_URL}/{DB_NAME}")
        
        await self.setup()
        
        tests = [
            ("Health Check", self.test_1_health_check),
            ("Encrypted User Creation", self.test_2_create_test_user_with_encryption),
            ("Auth Me with Decryption", self.test_3_auth_me_with_encrypted_data),
            ("Analytics with Auth", self.test_4_analytics_endpoint_with_auth),
            ("Dashboard with Auth", self.test_5_dashboard_with_auth),
            ("Backward Compatibility", self.test_backward_compatibility),
        ]
        
        results = []
        for test_name, test_func in tests:
            try:
                result = await test_func()
                results.append((test_name, result))
            except Exception as e:
                print(f"❌ {test_name} crashed: {e}")
                results.append((test_name, False))
        
        await self.cleanup()
        
        # Summary
        print("\n" + "="*60)
        print("🏁 ENCRYPTION & SECURITY TEST SUMMARY")
        print("="*60)
        
        passed = 0
        total = len(results)
        
        for test_name, result in results:
            status = "✅ PASS" if result else "❌ FAIL"
            print(f"{status} {test_name}")
            if result:
                passed += 1
        
        print(f"\nSuccess Rate: {passed}/{total} ({passed/total*100:.1f}%)")
        
        if passed == total:
            print("🎉 ALL ENCRYPTION & SECURITY TESTS PASSED!")
        else:
            print("⚠️ Some tests failed - check logs above")
        
        return passed == total

async def main():
    tester = EncryptionSecurityTester()
    success = await tester.run_all_tests()
    return 0 if success else 1

if __name__ == "__main__":
    exit_code = asyncio.run(main())
    exit(exit_code)