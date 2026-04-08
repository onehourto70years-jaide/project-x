# NutriOS — Google Play Data Safety Form Responses

Use this document to fill out the Google Play Console Data Safety form.
Last updated: April 2026

---

## Overview

NutriOS collects user data to provide personalized nutrition tracking, water intake monitoring, routine management, and AI-powered dietary insights. All data is stored on secure servers and is never sold to third parties.

---

## Section 1: Data Collection & Sharing

### Q: Does your app collect or share any of the required user data types?
**A: Yes**

### Q: Is all of the user data collected by your app encrypted in transit?
**A: Yes** — All API communication uses HTTPS/TLS.

### Q: Do you provide a way for users to request that their data is deleted?
**A: Yes** — Users can delete their account and all associated data from Settings → Delete Account. A confirmation email is sent upon deletion.

---

## Section 2: Data Types Collected

### 📧 Personal Information

| Data Type | Collected | Shared | Purpose | Optional |
|-----------|-----------|--------|---------|----------|
| **Name** | ✅ Yes | ❌ No | Account identification, personalized greetings | Required |
| **Email address** | ✅ Yes | ❌ No | Account authentication, transactional emails (welcome, deletion, subscription) | Required |
| **User IDs** | ✅ Yes | ❌ No | Internal account identification | Required |

**Collection method:** Google Sign-In (OAuth 2.0)  
**Processing:** Data is used for app functionality and transactional emails only.  
**Sharing:** Email is shared with Resend (email service) solely for sending transactional emails. Never shared for advertising.

---

### 🏥 Health & Fitness

| Data Type | Collected | Shared | Purpose | Optional |
|-----------|-----------|--------|---------|----------|
| **Health info** (nutrition goals, dietary preferences) | ✅ Yes | ❌ No | Personalized nutrition recommendations | Optional |
| **Fitness info** (daily routines, activity level) | ✅ Yes | ❌ No | Routine tracking and streak gamification | Optional |

**Collection method:** User manually inputs this data.  
**Processing:** Used to calculate daily goals, generate AI insights, and track progress.  
**Sharing:** Never shared with third parties. AI analysis uses Google Gemini API but sends only aggregated/anonymized meal data, not personal identifiers.

---

### 📊 App Activity

| Data Type | Collected | Shared | Purpose | Optional |
|-----------|-----------|--------|---------|----------|
| **App interactions** (features used, screens visited) | ✅ Yes | ❌ No | App functionality, crash prevention | Required |
| **In-app search history** (food searches) | ✅ Yes | ❌ No | Food logging, nutrition analysis | Optional |
| **Other user-generated content** (meal logs, water logs, recipes, AI chat history) | ✅ Yes | ❌ No | Core app functionality | Optional |

**Collection method:** User actions within the app.  
**Processing:** Stored to provide tracking history, progress charts, and AI recommendations.  
**Sharing:** Food search queries are sent to the USDA FoodData Central API (a US government public database) for nutritional information. No personal identifiers are included in these queries.

---

### 💰 Financial Information

| Data Type | Collected | Shared | Purpose | Optional |
|-----------|-----------|--------|---------|----------|
| **Purchase history** (subscription status, plan type) | ✅ Yes | ❌ No | Subscription management | Optional |

**Collection method:** Stripe payment processing.  
**Processing:** We store only subscription status (active/cancelled/trial) and plan type. We do NOT store credit card numbers, CVV, or full payment details — these are handled entirely by Stripe.  
**Sharing:** Payment data is processed by Stripe Inc. under their own privacy policy.

---

### 📱 Device or Other IDs

| Data Type | Collected | Shared | Purpose | Optional |
|-----------|-----------|--------|---------|----------|
| **Device ID / Push token** | ✅ Yes | ❌ No | Push notifications (meal reminders, hydration alerts) | Optional |

**Collection method:** Expo push notification registration.  
**Processing:** Stored to deliver scheduled notifications.  
**Sharing:** Push tokens are sent to Expo's push notification service for delivery only.

---

### 🏋️ Body Measurements

| Data Type | Collected | Shared | Purpose | Optional |
|-----------|-----------|--------|---------|----------|
| **Weight** | ✅ Yes | ❌ No | Weight tracking, BMI calculation, progress charts | Optional |
| **Height** | ❌ No | ❌ No | — | — |

---

## Section 3: Data NOT Collected

❌ Location data  
❌ Photos/Videos (camera is used only for barcode scanning — images are not stored)  
❌ Contacts  
❌ SMS/Call logs  
❌ Audio/Music files  
❌ Files and documents  
❌ Calendar events  
❌ Browsing history  
❌ Advertising ID / GAID  
❌ Diagnostics / Crash logs (no analytics SDK installed)  

---

## Section 4: Data Handling Practices

| Practice | Answer |
|----------|--------|
| Data encrypted in transit? | ✅ Yes (HTTPS/TLS) |
| Data encrypted at rest? | ✅ Yes (MongoDB encryption) |
| Users can request data deletion? | ✅ Yes (Settings → Delete Account) |
| Data deletion is complete? | ✅ Yes — All collections (meals, water_logs, routines, recipes, badges, sessions, settings, weight_logs, chat_history, favorites, push_tokens, insights, daily_summaries, email_logs) are purged |
| Data retained after deletion? | ❌ No — All data is permanently deleted immediately |
| Data shared with third parties for advertising? | ❌ No |
| Data shared with third parties for analytics? | ❌ No |
| Data used for tracking across apps? | ❌ No |

---

## Section 5: Third-Party Services Used

| Service | Data Shared | Purpose |
|---------|-------------|----------|
| **Google Sign-In** | Email, name, profile picture | Authentication |
| **Stripe** | Subscription events (no card data stored by us) | Payment processing |
| **Resend** | Email address | Transactional emails |
| **USDA FoodData Central** | Food search queries (no personal data) | Nutritional database |
| **Google Gemini AI** | Anonymized meal summaries | AI nutrition insights |
| **Expo Push Notifications** | Device push token | Notification delivery |

---

## Privacy Policy URL

Include your hosted privacy policy URL in the Play Console listing:  
`https://nutrios.app/privacy` *(update with your actual URL)*
