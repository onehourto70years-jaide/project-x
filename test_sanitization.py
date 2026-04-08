#!/usr/bin/env python3
"""
Test the sanitization function directly
"""

import sys
sys.path.append('/app/backend')

from security import sanitize

def test_sanitization_function():
    """Test the sanitize function directly"""
    print("🧪 Testing sanitization function directly...")
    
    test_cases = [
        # XSS tests
        ("<script>alert('xss')</script>Chicken", "Chicken"),
        ("<img src=x onerror=alert(1)>", ""),
        ("javascript:alert('xss')", "alert('xss')"),
        ("<div onclick='alert(1)'>text</div>", "text"),
        
        # MongoDB injection tests
        ("Test $gt injection", "Test  injection"),
        ("$where: function() { return true; }", ": function() { return true; }"),
        ("$regex: /.*admin.*/", ": /.admin./"),
        
        # SQL injection tests
        ("'; DROP TABLE users; --", " TABLE users "),
        ("UNION SELECT * FROM passwords", " * FROM passwords"),
        ("exec xp_cmdshell", " "),
        
        # Normal text (should be preserved)
        ("Normal chicken breast", "Normal chicken breast"),
        ("Grilled salmon with herbs", "Grilled salmon with herbs"),
        ("100g protein powder", "100g protein powder"),
    ]
    
    print("\nTest Results:")
    print("-" * 60)
    
    all_passed = True
    for i, (input_text, expected) in enumerate(test_cases, 1):
        result = sanitize(input_text)
        passed = result == expected
        status = "✅ PASS" if passed else "❌ FAIL"
        
        print(f"{i:2d}. {status}")
        print(f"    Input:    '{input_text}'")
        print(f"    Expected: '{expected}'")
        print(f"    Got:      '{result}'")
        print()
        
        if not passed:
            all_passed = False
    
    print(f"Overall: {'✅ ALL TESTS PASSED' if all_passed else '❌ SOME TESTS FAILED'}")
    return all_passed

if __name__ == "__main__":
    success = test_sanitization_function()
    exit(0 if success else 1)