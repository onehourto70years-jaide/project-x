#!/usr/bin/env python3
"""
Setup test user and session for security testing
"""

import asyncio
from motor.motor_asyncio import AsyncIOMotorClient
from datetime import datetime, timezone, timedelta
import os

# MongoDB connection
MONGO_URL = os.environ.get("MONGO_URL", "mongodb://localhost:27017")
DB_NAME = "nutrient_mapper"

async def setup_test_user():
    """Create test user and session in MongoDB"""
    client = AsyncIOMotorClient(MONGO_URL)
    db = client[DB_NAME]
    
    # Test user data as specified in review request
    user_data = {
        "user_id": "test_sec2_user",
        "email": "sec2@test.com",
        "name": "Sec Test 2", 
        "created_at": datetime.now(timezone.utc),
        "weight_kg": 70.0,
        "activity_level": "moderate",
        "health_goals": []
    }
    
    # Session data as specified
    session_data = {
        "session_token": "test_sec2_token_2026",
        "user_id": "test_sec2_user",
        "expires_at": datetime.now(timezone.utc) + timedelta(days=1),
        "created_at": datetime.now(timezone.utc)
    }
    
    # User settings
    settings_data = {
        "user_id": "test_sec2_user",
        "daily_water_goal_ml": 2500,
        "daily_calorie_goal": 2000,
        "daily_protein_goal": 50,
        "wake_time": "07:00",
        "sleep_time": "23:00",
        "water_reminder_enabled": True,
        "meal_reminder_enabled": True,
        "routine_reminder_enabled": True
    }
    
    try:
        # Clean up any existing test data
        await db.users.delete_many({"user_id": "test_sec2_user"})
        await db.user_sessions.delete_many({"user_id": "test_sec2_user"})
        await db.user_settings.delete_many({"user_id": "test_sec2_user"})
        
        # Insert test user
        await db.users.insert_one(user_data)
        print(f"✅ Created test user: {user_data['user_id']}")
        
        # Insert session
        await db.user_sessions.insert_one(session_data)
        print(f"✅ Created session: {session_data['session_token']}")
        
        # Insert settings
        await db.user_settings.insert_one(settings_data)
        print(f"✅ Created user settings")
        
        # Verify user exists
        user = await db.users.find_one({"user_id": "test_sec2_user"}, {"_id": 0})
        session = await db.user_sessions.find_one({"session_token": "test_sec2_token_2026"}, {"_id": 0})
        
        if user and session:
            print("✅ Test user and session setup complete!")
            return True
        else:
            print("❌ Failed to verify test user setup")
            return False
            
    except Exception as e:
        print(f"❌ Error setting up test user: {e}")
        return False
    finally:
        client.close()

if __name__ == "__main__":
    success = asyncio.run(setup_test_user())
    exit(0 if success else 1)