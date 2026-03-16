"""
Routine Scheduling & Tracking System - Backend API Tests
Tests all routine endpoints including:
- Templates (no auth)
- Routine CRUD (auth required)  
- Activity tracking (auth required)
- Analytics and streaks (auth required)
"""

import pytest
import requests
import os
from datetime import datetime, timedelta

# Use the public URL from environment 
BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', 'https://wellness-workflow-1.preview.emergentagent.com')
if BASE_URL.endswith('/'):
    BASE_URL = BASE_URL.rstrip('/')

# Test session token - created via mongosh
SESSION_TOKEN = "test_routine_session_1773692141549"


@pytest.fixture
def api_client():
    """Shared requests session"""
    session = requests.Session()
    session.headers.update({"Content-Type": "application/json"})
    return session


@pytest.fixture
def auth_client(api_client):
    """Authenticated session with Bearer token"""
    api_client.headers.update({"Authorization": f"Bearer {SESSION_TOKEN}"})
    return api_client


class TestNoAuthEndpoints:
    """Test endpoints that don't require authentication"""
    
    def test_templates_endpoint_returns_3_templates(self, api_client):
        """GET /api/routines/templates - should return 3 pre-built templates without auth"""
        response = api_client.get(f"{BASE_URL}/api/routines/templates")
        
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        
        data = response.json()
        assert "templates" in data, "Response should have 'templates' key"
        templates = data["templates"]
        
        # Should have 3 templates: productivity, fitness, student
        assert len(templates) == 3, f"Expected 3 templates, got {len(templates)}"
        
        # Validate template structure
        template_ids = [t["id"] for t in templates]
        assert "productivity" in template_ids, "Should have productivity template"
        assert "fitness" in template_ids, "Should have fitness template"
        assert "student" in template_ids, "Should have student template"
        
        # Check template has required fields
        for template in templates:
            assert "id" in template
            assert "name" in template
            assert "description" in template
            assert "activities" in template
            assert len(template["activities"]) > 0, f"Template {template['id']} should have activities"
    
    def test_activity_categories_returns_10_categories(self, api_client):
        """GET /api/reference/activity-categories - should return 10 categories without auth"""
        response = api_client.get(f"{BASE_URL}/api/reference/activity-categories")
        
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        
        data = response.json()
        assert "categories" in data, "Response should have 'categories' key"
        
        categories = data["categories"]
        assert len(categories) == 10, f"Expected 10 categories, got {len(categories)}"
        
        # Check expected categories
        expected = ["work", "health", "personal", "sleep", "focus", "break", "exercise", "meal", "learning", "social"]
        for cat_key in expected:
            assert cat_key in categories, f"Missing category: {cat_key}"
            assert "name" in categories[cat_key]
            assert "color" in categories[cat_key]


class TestAuthRequiredEndpoints:
    """Test that auth-required endpoints return 401 without token"""
    
    def test_get_routines_requires_auth(self, api_client):
        """GET /api/routines - should return 401 without auth"""
        response = api_client.get(f"{BASE_URL}/api/routines")
        assert response.status_code == 401, f"Expected 401 without auth, got {response.status_code}"
    
    def test_create_routine_requires_auth(self, api_client):
        """POST /api/routines - should return 401 without auth"""
        response = api_client.post(f"{BASE_URL}/api/routines", json={"name": "Test"})
        assert response.status_code == 401, f"Expected 401 without auth, got {response.status_code}"
    
    def test_today_status_requires_auth(self, api_client):
        """GET /api/routines/today/status - should return 401 without auth"""
        response = api_client.get(f"{BASE_URL}/api/routines/today/status")
        assert response.status_code == 401, f"Expected 401 without auth, got {response.status_code}"
    
    def test_analytics_requires_auth(self, api_client):
        """GET /api/routines/analytics - should return 401 without auth"""
        response = api_client.get(f"{BASE_URL}/api/routines/analytics")
        assert response.status_code == 401, f"Expected 401 without auth, got {response.status_code}"
    
    def test_streak_requires_auth(self, api_client):
        """GET /api/routines/streak - should return 401 without auth"""
        response = api_client.get(f"{BASE_URL}/api/routines/streak")
        assert response.status_code == 401, f"Expected 401 without auth, got {response.status_code}"


class TestRoutineCRUD:
    """Test routine CRUD operations with auth"""
    
    def test_auth_me_works(self, auth_client):
        """Verify auth token works"""
        response = auth_client.get(f"{BASE_URL}/api/auth/me")
        assert response.status_code == 200, f"Auth failed: {response.status_code} - {response.text}"
        data = response.json()
        assert "user_id" in data
        print(f"Authenticated as user: {data.get('name', data.get('email'))}")
    
    def test_create_routine_with_activities(self, auth_client):
        """POST /api/routines - create routine with activities"""
        routine_data = {
            "name": "TEST_Morning_Routine",
            "description": "Test routine for automated testing",
            "schedule_type": "daily",
            "days_of_week": [0, 1, 2, 3, 4],  # Monday-Friday
            "activities": [
                {
                    "title": "TEST_Wake Up",
                    "start_time": "06:00",
                    "end_time": "06:30",
                    "category": "personal",
                    "priority": "high"
                },
                {
                    "title": "TEST_Exercise",
                    "start_time": "06:30",
                    "end_time": "07:30",
                    "category": "exercise",
                    "priority": "high"
                },
                {
                    "title": "TEST_Breakfast",
                    "start_time": "07:30",
                    "end_time": "08:00",
                    "category": "meal",
                    "priority": "medium"
                }
            ]
        }
        
        response = auth_client.post(f"{BASE_URL}/api/routines", json=routine_data)
        
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        
        data = response.json()
        assert "routine_id" in data, "Response should have routine_id"
        assert data["name"] == routine_data["name"]
        assert len(data["activities"]) == 3, "Should have 3 activities"
        
        # Store for later tests
        pytest.created_routine_id = data["routine_id"]
        pytest.created_activity_id = data["activities"][0]["activity_id"]
        
        print(f"Created routine: {data['routine_id']}")
    
    def test_get_routines_list(self, auth_client):
        """GET /api/routines - list user's routines"""
        response = auth_client.get(f"{BASE_URL}/api/routines")
        
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        
        data = response.json()
        assert "routines" in data, "Response should have 'routines' key"
        assert isinstance(data["routines"], list)
        
        # Should find our created routine
        if hasattr(pytest, 'created_routine_id'):
            routine_ids = [r["routine_id"] for r in data["routines"]]
            assert pytest.created_routine_id in routine_ids, "Created routine should be in list"
    
    def test_get_specific_routine(self, auth_client):
        """GET /api/routines/{routine_id} - get specific routine"""
        if not hasattr(pytest, 'created_routine_id'):
            pytest.skip("No routine created in previous test")
        
        response = auth_client.get(f"{BASE_URL}/api/routines/{pytest.created_routine_id}")
        
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        
        data = response.json()
        assert data["routine_id"] == pytest.created_routine_id
        assert data["name"] == "TEST_Morning_Routine"
        assert len(data["activities"]) == 3
    
    def test_update_routine_with_activities(self, auth_client):
        """PUT /api/routines/{routine_id} - update routine with new activities"""
        if not hasattr(pytest, 'created_routine_id'):
            pytest.skip("No routine created in previous test")
        
        update_data = {
            "name": "TEST_Morning_Routine_Updated",
            "activities": [
                {
                    "title": "TEST_Updated_Wake_Up",
                    "start_time": "05:30",
                    "end_time": "06:00",
                    "category": "personal",
                    "priority": "critical"
                },
                {
                    "title": "TEST_Updated_Yoga",
                    "start_time": "06:00",
                    "end_time": "07:00",
                    "category": "health",
                    "priority": "high"
                }
            ]
        }
        
        response = auth_client.put(
            f"{BASE_URL}/api/routines/{pytest.created_routine_id}",
            json=update_data
        )
        
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        
        data = response.json()
        assert data["name"] == "TEST_Morning_Routine_Updated"
        assert len(data["activities"]) == 2, f"Should have 2 activities after update, got {len(data['activities'])}"
        
        # Verify GET returns updated data
        get_response = auth_client.get(f"{BASE_URL}/api/routines/{pytest.created_routine_id}")
        get_data = get_response.json()
        assert get_data["name"] == "TEST_Morning_Routine_Updated"
        
        # Store updated activity ID for later tests
        pytest.updated_activity_id = data["activities"][0]["activity_id"]
    
    def test_get_routine_404_for_invalid_id(self, auth_client):
        """GET /api/routines/{routine_id} - should return 404 for non-existent routine"""
        response = auth_client.get(f"{BASE_URL}/api/routines/invalid_routine_id_12345")
        assert response.status_code == 404, f"Expected 404, got {response.status_code}"


class TestTemplateApply:
    """Test applying templates to create routines"""
    
    def test_apply_productivity_template(self, auth_client):
        """POST /api/routines/templates/{template_id}/apply - create routine from template"""
        response = auth_client.post(f"{BASE_URL}/api/routines/templates/productivity/apply")
        
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        
        data = response.json()
        assert "routine_id" in data
        assert data["name"] == "Productivity Master"
        assert len(data["activities"]) > 0
        
        # Store for cleanup
        pytest.template_routine_id = data["routine_id"]
        print(f"Created routine from template: {data['routine_id']}")
    
    def test_apply_invalid_template_returns_404(self, auth_client):
        """POST /api/routines/templates/{template_id}/apply - 404 for invalid template"""
        response = auth_client.post(f"{BASE_URL}/api/routines/templates/invalid_template_xyz/apply")
        assert response.status_code == 404, f"Expected 404, got {response.status_code}"


class TestTodayStatus:
    """Test today's status endpoint"""
    
    def test_today_status_structure(self, auth_client):
        """GET /api/routines/today/status - check response structure"""
        response = auth_client.get(f"{BASE_URL}/api/routines/today/status")
        
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        
        data = response.json()
        
        # Should have either routine or message
        if data.get("has_routine"):
            assert "routine_name" in data
            assert "routine_id" in data
            assert "activities" in data
            assert "today_progress" in data
            assert "today_completed" in data
            assert "today_total" in data
            print(f"Active routine: {data.get('routine_name')}, Progress: {data.get('today_progress')}%")
        else:
            assert "message" in data
            print("No active routine for today")


class TestActivityTracking:
    """Test activity start/complete/skip endpoints"""
    
    def test_start_activity(self, auth_client):
        """POST /api/routines/activities/{activity_id}/start - start an activity"""
        if not hasattr(pytest, 'updated_activity_id'):
            pytest.skip("No activity ID from previous tests")
        
        response = auth_client.post(f"{BASE_URL}/api/routines/activities/{pytest.updated_activity_id}/start")
        
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        
        data = response.json()
        assert data["status"] == "in_progress"
        assert "actual_start" in data
        print(f"Started activity at: {data.get('actual_start')}")
    
    def test_complete_activity(self, auth_client):
        """POST /api/routines/activities/{activity_id}/complete - complete an activity"""
        if not hasattr(pytest, 'updated_activity_id'):
            pytest.skip("No activity ID from previous tests")
        
        response = auth_client.post(f"{BASE_URL}/api/routines/activities/{pytest.updated_activity_id}/complete")
        
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        
        data = response.json()
        assert data["status"] == "completed"
        assert "actual_end" in data
        print(f"Completed activity at: {data.get('actual_end')}")
    
    def test_skip_activity(self, auth_client):
        """POST /api/routines/activities/{activity_id}/skip - skip an activity"""
        # Create a test activity to skip
        routine_data = {
            "name": "TEST_Skip_Routine",
            "activities": [
                {"title": "TEST_Skip_Activity", "start_time": "23:00", "end_time": "23:30", "category": "personal", "priority": "low"}
            ]
        }
        
        create_resp = auth_client.post(f"{BASE_URL}/api/routines", json=routine_data)
        if create_resp.status_code != 200:
            pytest.skip(f"Could not create test routine: {create_resp.text}")
        
        skip_activity_id = create_resp.json()["activities"][0]["activity_id"]
        pytest.skip_routine_id = create_resp.json()["routine_id"]
        
        response = auth_client.post(f"{BASE_URL}/api/routines/activities/{skip_activity_id}/skip")
        
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        
        data = response.json()
        assert data["status"] == "skipped"
        print(f"Skipped activity: {skip_activity_id}")


class TestAnalyticsAndStreak:
    """Test analytics and streak endpoints"""
    
    def test_analytics_returns_correct_structure(self, auth_client):
        """GET /api/routines/analytics - check analytics response structure"""
        response = auth_client.get(f"{BASE_URL}/api/routines/analytics?days=7")
        
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        
        data = response.json()
        
        assert "summary" in data, "Should have summary"
        assert "daily_breakdown" in data, "Should have daily_breakdown"
        assert "categories" in data, "Should have categories"
        
        summary = data["summary"]
        assert "adherence_rate" in summary
        assert "completed" in summary
        assert "total_activities" in summary
        
        daily = data["daily_breakdown"]
        assert isinstance(daily, list)
        
        # Each day should have date, completed, total, adherence
        if len(daily) > 0:
            day = daily[0]
            assert "date" in day
            assert "completed" in day
            assert "total" in day
            assert "adherence" in day
        
        print(f"Analytics: Adherence rate = {summary.get('adherence_rate')}%, Completed = {summary.get('completed')}")
    
    def test_streak_returns_correct_structure(self, auth_client):
        """GET /api/routines/streak - check streak response structure"""
        response = auth_client.get(f"{BASE_URL}/api/routines/streak")
        
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        
        data = response.json()
        
        assert "current_streak" in data
        assert "longest_streak" in data
        assert "adherence_rate" in data
        assert "total_completed" in data
        
        print(f"Streak: Current = {data.get('current_streak')} days, Longest = {data.get('longest_streak')} days")


class TestRoutineDeletion:
    """Test routine deletion - run last for cleanup"""
    
    def test_delete_created_routine(self, auth_client):
        """DELETE /api/routines/{routine_id} - delete routine and verify removal"""
        if not hasattr(pytest, 'created_routine_id'):
            pytest.skip("No routine to delete")
        
        response = auth_client.delete(f"{BASE_URL}/api/routines/{pytest.created_routine_id}")
        
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        
        # Verify GET returns 404
        get_response = auth_client.get(f"{BASE_URL}/api/routines/{pytest.created_routine_id}")
        assert get_response.status_code == 404, "Deleted routine should return 404"
        
        print(f"Deleted routine: {pytest.created_routine_id}")
    
    def test_delete_template_routine(self, auth_client):
        """Cleanup - delete routine created from template"""
        if not hasattr(pytest, 'template_routine_id'):
            pytest.skip("No template routine to delete")
        
        response = auth_client.delete(f"{BASE_URL}/api/routines/{pytest.template_routine_id}")
        assert response.status_code == 200
        print(f"Deleted template routine: {pytest.template_routine_id}")
    
    def test_delete_skip_routine(self, auth_client):
        """Cleanup - delete skip test routine"""
        if not hasattr(pytest, 'skip_routine_id'):
            pytest.skip("No skip routine to delete")
        
        response = auth_client.delete(f"{BASE_URL}/api/routines/{pytest.skip_routine_id}")
        assert response.status_code == 200
        print(f"Deleted skip routine: {pytest.skip_routine_id}")
    
    def test_delete_invalid_routine_returns_404(self, auth_client):
        """DELETE /api/routines/{routine_id} - should return 404 for non-existent routine"""
        response = auth_client.delete(f"{BASE_URL}/api/routines/invalid_routine_id_12345")
        assert response.status_code == 404, f"Expected 404, got {response.status_code}"


if __name__ == "__main__":
    pytest.main([__file__, "-v", "--tb=short"])
