# Mobile Packaging (Android & iOS)

This project is prepared to be packaged as a native mobile application using
[Capacitor](https://capacitorjs.com). The web application, Supabase database,
authentication, roles, dashboards and business logic remain unchanged; only a
native shell is added on top.

## What is already configured

- `capacitor.config.ts` — Capacitor project configuration (app id, name, splash
  screen, keyboard, status bar).
- Capacitor runtime and plugins installed:
  - `@capacitor/core`, `@capacitor/cli`
  - `@capacitor/android`, `@capacitor/ios`
  - `@capacitor/app`, `@capacitor/status-bar`
  - `@capacitor/keyboard`, `@capacitor/splash-screen`
- `src/lib/native.ts` — safely initialises status bar, keyboard, splash screen
  and back-button handling only when running inside the native shell.
- Mobile-safe CSS: safe-area insets, no horizontal scroll, 16px input font to
  prevent iOS zoom, touch-friendly tap targets, keyboard-aware bottom
  navigation.
- Meta viewport with `viewport-fit=cover` and `format-detection` tags.
- Service worker is disabled inside the native shell so Supabase auth and
  network requests behave predictably.

## One-time native setup (on a developer machine)

The following steps must be run on a workstation with the native toolchains
installed (Android Studio + JDK 17 for Android, Xcode 15+ for iOS on macOS).

```bash
# Build the web bundle
npm install
npm run build

# Add the native platforms (creates android/ and ios/ folders)
npm run cap:add:android
npm run cap:add:ios   # macOS only

# Sync the web bundle and Capacitor plugins into the native projects
npm run cap:sync
```

## Everyday workflow

```bash
# After UI or logic changes
npm run mobile:android   # builds, syncs, and opens Android Studio
npm run mobile:ios       # builds, syncs, and opens Xcode
```

Then run the app from Android Studio / Xcode on a device or emulator. All
Supabase requests use the same production endpoint as the web application, so
existing accounts and data appear immediately.

## Store submission checklist

- Set signing keys in Android Studio / Xcode.
- Update the version fields in `android/app/build.gradle` and
  `ios/App/App.xcodeproj` when publishing.
- Provide the required app icons and splash screens through the standard
  Capacitor asset workflow (`@capacitor/assets`) if needed.
