# Darshan Eeshwar Fitness Android 1.1

Personal fitness companion using the phone TYPE_STEP_COUNTER sensor. No Samsung Health or Health Connect dependency, import controls, or health-data read permissions.

## Build
JDK 17, Gradle 8.11.1, Android SDK 36. Run `gradle -p android/fitness :app:assembleDebug :app:testDebugUnitTest`. GitHub Actions publishes the signed test APK to fitness/downloads. Debug signing keys can differ between builds; sync local pending steps before uninstalling an older build if an update cannot install.

## Automatic steps
After account sign-in, tracking is enabled by default and Android requests Physical activity and notification permission. Permission denial is respected. Resume retries the permission flow. Reopening resumes enabled tracking if permission is already granted. Pause in the app or notification is remembered per account on this phone. Logout stops the service. No third-party health connection is used.

Steps begin at the initial sensor baseline, save privately per user, and sync about once a minute. Distance is a stride-based estimate; workout minutes and calories are recorded by the user. Existing journal data is preserved. Reboot, force-stop, battery controls and process death can interrupt counting; reopen the app to resume. Sensor batches are assigned to delivery hour. No reboot receiver or background-start bypass.

## Validation
GitHub Actions compiles the APK. Physical-phone installation, permission denial, pause/resume, account switching and locked-screen counting must be verified on a real device.
