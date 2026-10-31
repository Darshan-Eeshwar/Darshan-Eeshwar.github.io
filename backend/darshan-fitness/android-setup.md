# Darshan Eeshwar Fitness Android companion

Build with JDK 17, Gradle 8.11.1, Android SDK Platform 36 and Build Tools 35.0.0:

    gradle -p android/fitness :app:assembleDebug

The GitHub workflow builds a signed debug/testing APK and publishes it at
fitness/downloads/darshan-fitness.apk. It is not a Play Store production release.
Fresh CI builds use fresh debug signing keys, so a later APK may require
uninstalling the old test build. Sync pending phone steps before uninstalling.

The app displays the live fitness website and retains its username/password
sign-in. Tokens are encrypted by Android Keystore. Background sensor steps are
scoped per account, stored privately on the phone and sent to the account's
backend about once a minute. Network failures retain pending records for retry.
Logout stops tracking and clears the encrypted session. No server key is shipped.

## Using automatic phone steps

Install the APK, sign in, allow Physical activity and optionally notifications,
then tap Start automatic steps. Keep the phone with you. The persistent
notification includes a Stop action. The hardware counter establishes a baseline
at start; it does not reconstruct earlier steps. Force-stop, reboot, battery
restrictions or process loss can create gaps. Reopen and restart after those
interruptions. A delta spanning midnight is skipped instead of assigned to the
wrong day. Sensor batches are placed in their delivery hour, so hourly phone bars
are approximate. These limits require physical-device testing.

## Importing Samsung Health

Enable sharing in Samsung Health > Settings > Health Connect. In this app, tap
Import Samsung Health, choose data permissions, and approve. The foreground
import reads the last 30 days from Samsung Health's Health Connect data origin.
It imports the activity types available and permitted, including steps, hourly
steps, active/total energy and distance. Active time comes from exercise-session
durations with overlap removed. Samsung Health may not share every displayed
Samsung metric; missing fields are left missing. Import timing follows Samsung
Health's own synchronization. No continuous background Health Connect reads or
heart-rate, oxygen, sleep or GPS access is requested in this version.

The dashboard uses the maximum available automatic daily steps across phone and
Health Connect records, not their sum. Manual step entries add extra steps.
Imported calories are source-reported values and are not generated from steps.
The app is a personal fitness journal, not a medical device.

## Verification

The GitHub workflow compiled the APK successfully. Backend tests cover
session isolation, data validation and device-record upserts. UI calculations
cover duplicate-source handling. Installation, Samsung permissions and sensor
behavior with the screen locked still need a real Android phone test.
