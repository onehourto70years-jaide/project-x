#!/usr/bin/env python3
"""
NutriOS AI Photo Meal Analysis Backend Testing
Tests the NEW AI Photo endpoints: analyze-photo and photo-log-meal
"""

import asyncio
import aiohttp
import json
import base64
import uuid
from datetime import datetime, timezone, timedelta
from PIL import Image, ImageDraw
import io
import sys

# Backend URL from frontend .env
BACKEND_URL = "https://meal-sync-test.preview.emergentagent.com/api"

class AIPhotoTester:
    def __init__(self):
        self.session = None
        self.test_user_id = f"test_ai_photo_{uuid.uuid4().hex[:8]}"
        self.test_session_token = f"test_ai_photo_token_{uuid.uuid4().hex[:8]}"
        self.test_results = []
        
    async def setup_session(self):
        """Setup HTTP session"""
        self.session = aiohttp.ClientSession()
        
    async def cleanup_session(self):
        """Cleanup HTTP session"""
        if self.session:
            await self.session.close()
            
    def create_test_image(self) -> str:
        """Create a test food image with visual features (not blank)"""
        # Create a 400x300 image with food-like patterns
        img = Image.new('RGB', (400, 300), color='white')
        draw = ImageDraw.Draw(img)
        
        # Draw a plate (circle)
        draw.ellipse([50, 50, 350, 250], fill='lightgray', outline='gray', width=3)
        
        # Draw food items with different colors and shapes
        # Chicken breast (beige rectangle)
        draw.rectangle([100, 100, 200, 150], fill='#D2B48C', outline='#8B7355', width=2)
        
        # Vegetables (green circles for broccoli)
        draw.ellipse([220, 90, 260, 130], fill='green', outline='darkgreen', width=2)
        draw.ellipse([240, 110, 280, 150], fill='green', outline='darkgreen', width=2)
        
        # Rice (small white/yellow dots)
        for x in range(120, 180, 8):
            for y in range(160, 200, 8):
                draw.ellipse([x, y, x+4, y+4], fill='#FFFACD')
        
        # Carrots (orange strips)
        draw.rectangle([280, 120, 320, 140], fill='orange', outline='darkorange', width=1)
        draw.rectangle([280, 145, 320, 165], fill='orange', outline='darkorange', width=1)
        
        # Convert to base64
        buffer = io.BytesIO()
        img.save(buffer, format='JPEG', quality=85)
        img_bytes = buffer.getvalue()
        return base64.b64encode(img_bytes).decode('utf-8')
        
    async def create_test_user(self):
        """Create test user and session in MongoDB"""
        try:
            # Connect to MongoDB directly
            from motor.motor_asyncio import AsyncIOMotorClient
            client = AsyncIOMotorClient("mongodb://localhost:27017")
            db = client.nutrient_mapper
            
            # Create test user
            user_doc = {
                "user_id": self.test_user_id,
                "email": f"ai_photo_test_{uuid.uuid4().hex[:8]}@test.com",
                "name": "AI Photo Test User",
                "created_at": datetime.now(timezone.utc),
                "weight_kg": 70.0,
                "activity_level": "moderate",
                "language_preference": "en"
            }
            result = await db.users.insert_one(user_doc)
            
            # Create session
            session_doc = {
                "session_token": self.test_session_token,
                "user_id": self.test_user_id,
                "expires_at": datetime.now(timezone.utc) + timedelta(hours=24),
                "created_at": datetime.now(timezone.utc)
            }
            session_result = await db.user_sessions.insert_one(session_doc)
            
            client.close()
            print(f"✅ Created test user: {self.test_user_id}")
            print(f"✅ Created session token: {self.test_session_token}")
            return True
            
        except Exception as e:
            print(f"❌ Failed to create test user: {e}")
            import traceback
            traceback.print_exc()
            return False
            
    async def cleanup_test_user(self):
        """Clean up test user and related data"""
        try:
            from motor.motor_asyncio import AsyncIOMotorClient
            client = AsyncIOMotorClient("mongodb://localhost:27017")
            db = client.nutrient_mapper
            
            # Delete user data
            await db.users.delete_many({"user_id": self.test_user_id})
            await db.user_sessions.delete_many({"user_id": self.test_user_id})
            await db.meals.delete_many({"user_id": self.test_user_id})
            await db.photo_analyses.delete_many({"user_id": self.test_user_id})
            
            client.close()
            print(f"✅ Cleaned up test user: {self.test_user_id}")
            
        except Exception as e:
            print(f"⚠️ Cleanup warning: {e}")
            
    async def test_analyze_photo_valid(self):
        """Test 1: POST /api/ai/analyze-photo with valid image"""
        test_name = "Analyze Photo - Valid Image"
        try:
            image_base64 = self.create_test_image()
            
            payload = {
                "image_base64": image_base64,
                "mime_type": "image/jpeg",
                "meal_type": "lunch",
                "language": "en"
            }
            
            headers = {
                "Authorization": f"Bearer {self.test_session_token}",
                "Content-Type": "application/json"
            }
            
            async with self.session.post(
                f"{BACKEND_URL}/ai/analyze-photo",
                json=payload,
                headers=headers
            ) as response:
                status = response.status
                data = await response.json()
                
                if status == 200:
                    # Verify response structure
                    required_fields = ["foods", "meal_description", "total_calories", "health_score", "suggestions"]
                    missing_fields = [field for field in required_fields if field not in data]
                    
                    if not missing_fields and isinstance(data.get("foods"), list):
                        self.test_results.append({
                            "test": test_name,
                            "status": "✅ PASS",
                            "details": f"Status: {status}, Foods count: {len(data.get('foods', []))}, Calories: {data.get('total_calories', 0)}, Health score: {data.get('health_score', 0)}"
                        })
                        print(f"✅ {test_name}: PASS - {data.get('meal_description', 'No description')}")
                        return True
                    else:
                        self.test_results.append({
                            "test": test_name,
                            "status": "❌ FAIL",
                            "details": f"Missing fields: {missing_fields}, Response: {data}"
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
            
    async def test_analyze_photo_no_image(self):
        """Test 2: POST /api/ai/analyze-photo without image_base64"""
        test_name = "Analyze Photo - No Image"
        try:
            payload = {
                "meal_type": "lunch",
                "language": "en"
            }
            
            headers = {
                "Authorization": f"Bearer {self.test_session_token}",
                "Content-Type": "application/json"
            }
            
            async with self.session.post(
                f"{BACKEND_URL}/ai/analyze-photo",
                json=payload,
                headers=headers
            ) as response:
                status = response.status
                data = await response.json()
                
                if status == 400 and "image_base64 is required" in data.get("detail", ""):
                    self.test_results.append({
                        "test": test_name,
                        "status": "✅ PASS",
                        "details": f"Status: {status}, Error: {data.get('detail')}"
                    })
                    print(f"✅ {test_name}: PASS - Proper validation error")
                    return True
                else:
                    self.test_results.append({
                        "test": test_name,
                        "status": "❌ FAIL",
                        "details": f"Expected 400 with 'image_base64 is required', got {status}: {data}"
                    })
                    print(f"❌ {test_name}: FAIL - Expected 400 validation error")
                    return False
                    
        except Exception as e:
            self.test_results.append({
                "test": test_name,
                "status": "❌ ERROR",
                "details": f"Exception: {str(e)}"
            })
            print(f"❌ {test_name}: ERROR - {e}")
            return False
            
    async def test_analyze_photo_small_image(self):
        """Test 3: POST /api/ai/analyze-photo with too-small image"""
        test_name = "Analyze Photo - Small Image"
        try:
            # Create a very small base64 string (less than 1000 bytes)
            small_image = base64.b64encode(b"tiny").decode('utf-8')
            
            payload = {
                "image_base64": small_image,
                "mime_type": "image/jpeg",
                "meal_type": "lunch"
            }
            
            headers = {
                "Authorization": f"Bearer {self.test_session_token}",
                "Content-Type": "application/json"
            }
            
            async with self.session.post(
                f"{BACKEND_URL}/ai/analyze-photo",
                json=payload,
                headers=headers
            ) as response:
                status = response.status
                data = await response.json()
                
                if status == 400 and "too small" in data.get("detail", "").lower():
                    self.test_results.append({
                        "test": test_name,
                        "status": "✅ PASS",
                        "details": f"Status: {status}, Error: {data.get('detail')}"
                    })
                    print(f"✅ {test_name}: PASS - Proper size validation")
                    return True
                else:
                    self.test_results.append({
                        "test": test_name,
                        "status": "❌ FAIL",
                        "details": f"Expected 400 with 'too small', got {status}: {data}"
                    })
                    print(f"❌ {test_name}: FAIL - Expected size validation error")
                    return False
                    
        except Exception as e:
            self.test_results.append({
                "test": test_name,
                "status": "❌ ERROR",
                "details": f"Exception: {str(e)}"
            })
            print(f"❌ {test_name}: ERROR - {e}")
            return False
            
    async def test_photo_log_meal_valid(self):
        """Test 4: POST /api/ai/photo-log-meal with valid foods"""
        test_name = "Photo Log Meal - Valid Foods"
        try:
            foods = [
                {
                    "food_name": "Grilled Chicken Breast",
                    "portion_grams": 150,
                    "nutrients": {
                        "energy_kcal": 250,
                        "protein_g": 31,
                        "carbohydrate_g": 0,
                        "fat_g": 14,
                        "fiber_g": 0
                    },
                    "cooking_method": "grilled"
                },
                {
                    "food_name": "Steamed Broccoli",
                    "portion_grams": 100,
                    "nutrients": {
                        "energy_kcal": 34,
                        "protein_g": 3,
                        "carbohydrate_g": 7,
                        "fat_g": 0,
                        "fiber_g": 3
                    },
                    "cooking_method": "steamed"
                }
            ]
            
            payload = {
                "foods": foods,
                "meal_type": "lunch",
                "analysis_id": f"test_analysis_{uuid.uuid4().hex[:8]}"
            }
            
            headers = {
                "Authorization": f"Bearer {self.test_session_token}",
                "Content-Type": "application/json"
            }
            
            async with self.session.post(
                f"{BACKEND_URL}/ai/photo-log-meal",
                json=payload,
                headers=headers
            ) as response:
                status = response.status
                data = await response.json()
                
                if status == 200 and data.get("logged_count", 0) > 0:
                    self.test_results.append({
                        "test": test_name,
                        "status": "✅ PASS",
                        "details": f"Status: {status}, Logged: {data.get('logged_count')} foods, Message: {data.get('message')}"
                    })
                    print(f"✅ {test_name}: PASS - Logged {data.get('logged_count')} foods")
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
            
    async def test_photo_log_meal_empty(self):
        """Test 5: POST /api/ai/photo-log-meal with empty foods array"""
        test_name = "Photo Log Meal - Empty Foods"
        try:
            payload = {
                "foods": [],
                "meal_type": "lunch"
            }
            
            headers = {
                "Authorization": f"Bearer {self.test_session_token}",
                "Content-Type": "application/json"
            }
            
            async with self.session.post(
                f"{BACKEND_URL}/ai/photo-log-meal",
                json=payload,
                headers=headers
            ) as response:
                status = response.status
                data = await response.json()
                
                if status == 400 and "no foods" in data.get("detail", "").lower():
                    self.test_results.append({
                        "test": test_name,
                        "status": "✅ PASS",
                        "details": f"Status: {status}, Error: {data.get('detail')}"
                    })
                    print(f"✅ {test_name}: PASS - Proper validation error")
                    return True
                else:
                    self.test_results.append({
                        "test": test_name,
                        "status": "❌ FAIL",
                        "details": f"Expected 400 with 'no foods', got {status}: {data}"
                    })
                    print(f"❌ {test_name}: FAIL - Expected validation error")
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
        """Run all AI Photo Meal Analysis tests"""
        print("🧪 Starting AI Photo Meal Analysis Backend Tests")
        print(f"📍 Backend URL: {BACKEND_URL}")
        print("=" * 60)
        
        # Setup
        await self.setup_session()
        
        # Create test user
        if not await self.create_test_user():
            print("❌ Failed to create test user. Aborting tests.")
            await self.cleanup_session()
            return False
            
        try:
            # Run tests
            tests = [
                self.test_analyze_photo_valid(),
                self.test_analyze_photo_no_image(),
                self.test_analyze_photo_small_image(),
                self.test_photo_log_meal_valid(),
                self.test_photo_log_meal_empty()
            ]
            
            results = await asyncio.gather(*tests, return_exceptions=True)
            
            # Count results
            passed = sum(1 for result in results if result is True)
            total = len(tests)
            
            print("\n" + "=" * 60)
            print("📊 TEST SUMMARY")
            print("=" * 60)
            
            for test_result in self.test_results:
                print(f"{test_result['status']} {test_result['test']}")
                print(f"   {test_result['details']}")
                print()
                
            print(f"🎯 OVERALL RESULT: {passed}/{total} tests passed ({passed/total*100:.1f}%)")
            
            if passed == total:
                print("✅ ALL AI PHOTO MEAL ANALYSIS TESTS PASSED")
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
    tester = AIPhotoTester()
    success = await tester.run_all_tests()
    sys.exit(0 if success else 1)

if __name__ == "__main__":
    asyncio.run(main())