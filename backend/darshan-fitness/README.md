# Darshan Eeshwar Fitness

The complete frontend runs at https://darshan-eeshwar.github.io/fitness/.
Username/password registration and login happen in that page. No ChatGPT sign-in
or navigation to the old Stride host is required. The private API runs as the
Supabase function darshan-fitness-api, with dedicated df_ tables in the existing
free-plan project. The public frontend includes no server secret.

The backend validates every session and derives account ownership server-side.
Only hashed session tokens and salted PBKDF2 password hashes are stored. Tokens
live in sessionStorage in the browser, and expire after seven days. RLS and grants
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
