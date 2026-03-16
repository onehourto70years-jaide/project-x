# ElementEats - Mobile App Build Guide

## What's Already Done
- Capacitor 6 configured with Android + iOS platforms
- App icons generated for all Android densities
- Dark splash screen with ElementEats logo
- Native plugins: SplashScreen, StatusBar, App lifecycle
- PWA features: Service worker, manifest, bottom navigation, safe area insets

---

## Prerequisites

### For Android (.apk / .aab)
- **Android Studio** (latest) — [Download](https://developer.android.com/studio)
- Java 17+ (bundled with Android Studio)

### For iOS (.ipa)
- **macOS** computer (required by Apple)
- **Xcode 15+** — [Mac App Store](https://apps.apple.com/app/xcode/id497799835)
- Apple Developer account ($99/year) for App Store publishing

---

## Step 1: Get the Code

Use the **"Save to Github"** button in Emergent's chat, then clone the repo:
```bash
git clone <your-repo-url>
cd frontend
```

## Step 2: Install Dependencies
```bash
npm install
# or
yarn install
```

## Step 3: Configure API URL

Before building, update `capacitor.config.ts` to point to your **production backend URL**:
```typescript
server: {
  url: 'https://your-production-api.com',  // Add this for live server
  androidScheme: 'https',
  iosScheme: 'https',
},
```

> **Note:** If you skip this, the app will load from the bundled web files (works offline but needs the API URL set in your `.env` during build).

## Step 4: Build Web Assets
```bash
npm run build
# or
yarn build
```

## Step 5: Sync to Native Projects
```bash
npx cap sync
```

---

## Build Android APK

### Option A: Using Android Studio (Recommended)
```bash
npx cap open android
```
This opens Android Studio. Then:
1. Wait for Gradle sync to finish
2. Go to **Build → Build Bundle(s) / APK(s) → Build APK(s)**
3. The APK will be at: `android/app/build/outputs/apk/debug/app-debug.apk`

### Option B: Command Line (requires Android SDK)
```bash
cd android
./gradlew assembleDebug
```
APK location: `android/app/build/outputs/apk/debug/app-debug.apk`

### For Play Store (Release Build)
```bash
cd android
./gradlew bundleRelease
```
This generates an `.aab` (Android App Bundle) for Play Store upload.

> You'll need to set up signing keys. See: [Android Signing Guide](https://developer.android.com/studio/publish/app-signing)

---

## Build iOS App

```bash
npx cap open ios
```
This opens Xcode. Then:
1. Select your **Team** (Apple Developer account) in project settings
2. Set the **Bundle Identifier** to `com.elementeats.app`
3. Select a connected device or simulator
4. Press **Cmd + R** to build and run
5. For App Store: **Product → Archive** → Upload to App Store Connect

---

## Test on Device

### Android
- Enable **USB Debugging** on your phone (Settings → Developer Options)
- Connect via USB
- Run: `npx cap run android`

### iOS
- Connect your iPhone via USB
- Trust the developer certificate on the phone
- Run: `npx cap run ios`

---

## Updating the App

After making changes to the web code:
```bash
npm run build    # Rebuild web assets
npx cap sync     # Copy to native projects
npx cap open android   # or ios
```

---

## Project Structure
```
frontend/
├── capacitor.config.ts     # Capacitor configuration
├── android/                # Android native project
│   └── app/src/main/
│       ├── res/            # Icons, splash, colors
│       └── AndroidManifest.xml
├── ios/                    # iOS native project  
│   └── App/
├── build/                  # Built web assets (after yarn build)
└── public/
    ├── manifest.json       # PWA manifest
    ├── sw.js              # Service worker
    ├── icon-192.png       # App icons
    └── icon-512.png
```

## Troubleshooting

| Issue | Fix |
|-------|-----|
| Gradle sync fails | File → Invalidate Caches → Restart Android Studio |
| White screen on launch | Run `npx cap sync` again after `yarn build` |
| API calls fail | Check `capacitor.config.ts` server URL or `.env` |
| iOS build fails | Run `cd ios && pod install` then retry |
