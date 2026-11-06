# Darshan Eeshwar Fitness

The complete frontend runs at https://darshan-eeshwar.github.io/fitness/.
The page opens directly without a visible login. A random private device key is
created in the browser and exchanged for short-lived cloud sessions; no shared
anonymous account is used. The private API runs as the
Supabase function darshan-fitness-api, with dedicated df_ tables in the existing
free-plan project. The public frontend includes no server secret.

The backend validates every session and derives account ownership server-side.
Only hashed device keys, hashed session tokens and legacy salted PBKDF2 password
hashes are stored. Session tokens live in sessionStorage and expire after seven
days; the private device key silently renews them. RLS and grants
deny all direct table access to anon and authenticated roles; the Edge Function
alone accesses the tables using its managed server key. CORS allows the GitHub
Pages origin. Every journal write uses an optimistic version check. Password
changes increment the account auth_version and revoke old sessions.

The first account and its journal were migrated without changing the password.
New sessions require signing in again. No credentials, user data or migration
seed rows are kept in this repository. schema.sql documents the applied schema;
do not replay it on an existing database. index.ts reads only managed runtime
variables; backend.mjs is the function implementation. Test passwords in the test
suite are disposable fake credentials and never describe a real account.

Manual logs: steps, workouts, water, food calories, sleep and weight. Distance is
estimated. Browser background sensor capture is not available. The separate old
Android development project is not a compiled APK or part of this web migration.

No email password reset exists yet. Use a password manager. The free backend can
pause after inactivity, so uninterrupted availability is not guaranteed. Regularly
export a JSON backup in Settings. Unsaved records remain in memory for retry or
export, with a page-leave warning; there is no offline synchronization queue.

## Extended fitness features

Workout stopwatch (elapsed time, not sensor tracking), strength sets/reps/load,
protein goals and entries, mood and energy self-ratings, centimetre body
measurements, daily reflections, daily goal checklist, seven-day summaries,
per-exercise highest logged loads and daily totals CSV export are included.
Additional journal fields remain compatible with version-1 records. The timer
is kept per account in sessionStorage and records a workout only when saved;
starting a timer does not create a background phone sensor service.

## Training toolkit update

Cloud-saved custom routines support up to 20 exercises each. Routine sessions log
completed sets and optionally actual duration into the selected journal date.
Existing journal entries can be edited while keeping their IDs and timestamps.
Progress includes a monthly activity calendar and journal search by keyword,
category and inclusive dates. The Train tab includes a visual rest countdown;
it sends no background notifications and does not run after this page closes.

## Automatic activity companion

The website now displays source-aware activity hearts, active time, recorded or
imported calories, total burned calories, distance, hourly step bars and monthly
goal totals. The compiled Android test APK provides foreground-service phone
steps and a foreground Samsung Health Connect import. See android-setup.md
for setup, privacy and test-build limits. Device activity is stored separately
from manual journal data in df_device_activity with denied direct client access.
