# NutriOS — Health & Fitness Policy Compliance Declaration

This document addresses Google Play's Health & Fitness policies and requirements.
Last updated: April 2026

---

## 1. Policy Applicability

NutriOS is a **nutrition tracking and wellness app** that falls under Google Play's [Health & Fitness category policies](https://support.google.com/googleplay/android-developer/answer/13316080).

---

## 2. Health Data Handling

### What health data does NutriOS collect?

| Data Category | Specific Data | How Collected | How Used |
|--------------|---------------|---------------|----------|
| Nutrition | Calorie intake, macronutrients (protein, carbs, fat), micronutrients | User manually logs meals | Daily tracking, progress charts, AI recommendations |
| Hydration | Water intake (ml) | User manually logs water | Daily hydration tracking, goal progress |
| Body metrics | Weight (kg) | User manually inputs | Weight trend tracking, progress charts |
| Activity | Daily routines (morning, work, workout, evening) | User manually logs completion | Streak tracking, gamification |
| Dietary goals | Calorie/protein goals, health objectives | User sets during onboarding | Personalized recommendations |

### What health data does NutriOS NOT collect?

- ❌ Heart rate or blood pressure
- ❌ Sleep data (from device sensors)
- ❌ Step count or exercise metrics
- ❌ Medical conditions or medications
- ❌ Blood glucose or lab results
- ❌ Reproductive health data
- ❌ Data from Health Connect or Google Fit

---

## 3. Health Connect Integration

**Status: Not integrated**

NutriOS does **not** read from or write to Android Health Connect. All health data is manually entered by the user within the app. Therefore, Health Connect permissions and policies do not apply.

*If Health Connect integration is added in the future, this document and the app's permissions will be updated accordingly.*

---

## 4. Medical Disclaimer

NutriOS includes the following disclaimers:

> **NutriOS is not a medical device and does not provide medical advice.** The app is designed for general wellness and nutrition tracking purposes only. Users should consult a qualified healthcare professional before making any changes to their diet or exercise routine.

> **AI-generated insights are for informational purposes only** and should not be used as a substitute for professional medical or nutritional advice.

This disclaimer should be displayed:
- ✅ In the app's Privacy Policy (already implemented)
- ✅ In the Play Store listing description
- ✅ During onboarding (recommended addition)

---

## 5. Data Security Measures

| Measure | Implementation |
|---------|----------------|
| Encryption in transit | HTTPS/TLS for all API calls |
| Authentication | Google OAuth 2.0 + session tokens |
| Session management | Tokens expire, stored securely |
| Data isolation | Each user can only access their own data (user_id scoping) |
| Account deletion | Complete data purge across all collections |
| Password storage | N/A — uses Google Sign-In (no passwords stored) |

---

## 6. Compliance Checklist

| Requirement | Status | Notes |
|------------|--------|-------|
| Prominent privacy policy | ✅ Done | Mandatory gate before login |
| Accurate data safety form | ✅ Ready | See GOOGLE_PLAY_DATA_SAFETY.md |
| Medical disclaimer | ✅ In privacy policy | Add to Play Store description |
| No misleading health claims | ✅ Compliant | App doesn't claim to diagnose or treat |
| User data deletion | ✅ Done | Settings → Delete Account |
| Data encryption | ✅ Done | HTTPS + MongoDB encryption |
| Health Connect policy | ✅ N/A | Not integrated |
| Sensitive permissions justified | ✅ Done | Camera (barcode), Notifications (reminders) |
| Content rating | ⏳ Pending | Fill out during Play Console submission |

---

## 7. Recommended Play Store Content Rating

When filling out the Content Rating Questionnaire in Play Console:

- **Violence:** None
- **Sexual content:** None
- **Language:** None
- **Controlled substances:** None (food/nutrition is not classified as controlled)
- **User interaction:** Yes (AI chat feature)
- **Location sharing:** No
- **Personal data collection:** Yes

**Expected rating: PEGI 3 / Everyone**

---

## 8. App Category

**Primary:** Health & Fitness  
**Secondary:** Food & Drink  
**Tags:** nutrition tracker, calorie counter, water tracker, meal planner, diet app
