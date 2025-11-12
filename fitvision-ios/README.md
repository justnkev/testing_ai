# FitVision iOS

Native SwiftUI client for the FitVision platform. The app mirrors the web experience with onboarding, personalized plans, progress logging, AI visualizations, dashboards, and optional HealthKit sync.

## Requirements

- Xcode 15.0+
- iOS 16.0+ deployment target
- Swift 5.9+
- Ruby/Bundler for Fastlane

## Project Structure

```
fitvision-ios/
  FitVision.xcodeproj
  Config/
  FitVision/
  fastlane/
  README.md
```

All runtime code lives under `FitVision/` and is organized by feature (Auth, Onboarding, Plan, Progress, Visualize, Dashboard, HealthKit, API, Storage, Common).

## Configuration

Three build configurations (Dev/Staging/Prod) are defined. Environment-specific values are stored in `Config/*.xcconfig` and exposed via `EnvironmentConfigurationLoader`. Base URLs can be overridden at runtime through Settings.

| Build Config | Base URL                              |
|--------------|---------------------------------------|
| Dev          | `https://dev.api.fitvision.example`    |
| Staging      | `https://staging.api.fitvision.example`|
| Prod         | `https://api.fitvision.example`        |

## Secrets

The app never bundles provider secrets. JWT tokens returned from `POST /auth/apple` are stored securely in the Keychain. Upload queues are encrypted at rest by the system.

## Running the App

1. Open `FitVision.xcodeproj` in Xcode.
2. Select the `FitVision` scheme.
3. Choose the desired build configuration (Dev, Staging, Prod).
4. Build & run on an iOS 16+ simulator or device.

## Testing

- Unit tests: `Cmd+U`
- UI smoke tests (launch check): `Cmd+U` with `FitVisionUITests`

## Fastlane

```
bundle install
fastlane beta   # Increment build number and upload to TestFlight
fastlane release # Build and submit to App Store Connect
```

## Features

- **Sign in with Apple** – exchanges tokens with FitVision backend for JWT session.
- **Onboarding → Plan** – captures lifestyle inputs and fetches a personalized plan.
- **Progress logging** – offline-first queue for workouts, meals, sleep, and habits.
- **AI visualizations** – prompts + optional photos sent to backend Gemini proxy; durable caching.
- **Dashboard** – charts and metrics for calories, steps, workouts, habits, and sleep.
- **HealthKit** – optional data ingestion with BackgroundTasks retries.
- **Settings** – environment switcher, HealthKit toggle, logout, legal links.

## Privacy

Usage descriptions and a privacy manifest are included for HealthKit, camera, and photo library access. The app does not track users across apps.
