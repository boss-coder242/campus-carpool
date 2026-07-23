# Campus Carpool

Ride-sharing app for Chitkara University students. React + Vite + Supabase.
Students post rides (e.g. Main Gate → Panchkula) and other students claim seats.

## Stack

- **Frontend:** React 18, Vite, plain JSX (no TypeScript), inline `<style>` blocks per component — no CSS framework
- **Backend:** Supabase (Postgres + Auth + RLS). Project: "Chitkara car pool"
- **Lint:** oxlint (`npm run lint`)
- **Env:** `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY` in `.env` (gitignored)

## Auth

Supabase email OTP (6-digit code, not magic link — the email template must
contain `{{ .Token }}`).

Signups restricted to `@chitkara.edu.in`. **Enforced server-side** by the
`enforce_chitkara_domain` trigger on `auth.users`, which fires before the auth
user is created. The frontend check in `isAllowedEmail()` is only for instant
feedback — it is not the security boundary.

Flow: email → OTP verify → profile setup (name, phone, branch, year) → app.
`AuthFlow.jsx` wraps the whole app and only renders children once the profile
is complete.

## Database

Migrations are saved in the Supabase SQL Editor with numbered names, and
mirrored in `supabase/migrations/`. Run in order:

| File | Contents |
|---|---|
| `01_users_table_and_auth_rls` | users table, domain trigger, profile auto-create, RLS |
| `02_verify_triggers_and_policies` | verification SELECTs (not a schema change) |
| `03_rides_table_and_rls` | rides table, seat init, status sync, RLS |
| `04_ride_passengers_and_rls` | join/leave RPCs, public_profiles view, RLS |
| `05_ratings_table_and_rls` | ratings table, rate_user RPC, recalc trigger, RLS |
| `06_reports_table_and_rls` | reports table, insert-own / select-own RLS |
| `07_gender_and_women_only` | users.gender, rides.women_only, women-only enforcement |
| `08_ride_contacts_rpc` | get_ride_contacts RPC — scoped phone reveal to co-riders |
| `99_scratch_debug` | throwaway queries — reuse, never rename |

### Schema

```
users             id, email, phone, name, branch, year, gender,
                  rating_avg, rating_count, created_at
rides             id, driver_id, "from", "to", date, time,
                  seats_total, seats_left, price, note, status,
                  women_only, created_at
ride_passengers   id, ride_id, user_id, joined_at, left_at
ratings           id, ride_id, rater_id, rated_id, stars, created_at
reports           id, reporter_id, reported_id, reason, ride_id, created_at
```

`rides.status` is one of `open | full | completed | cancelled`.

## Conventions — read before touching the DB or data layer

- **Never let the client write `email`, `rating_avg`, `rating_count`, `created_at`.**
  The `protect_user_columns` trigger silently reverts self-edits to those columns.
  Same idea on rides: `protect_ride_columns` freezes `driver_id` and `created_at`.
- **Seats change only through `join_ride()` / `leave_ride()` RPCs.** These are
  `security definer` and lock the ride row with `FOR UPDATE`, so two students
  tapping Join at the same instant can't both take the last seat. There are no
  INSERT/UPDATE policies on `ride_passengers` — the RPCs are the only path.
  Their `raise exception` strings are written to be shown to users verbatim.
- **Read driver info from the `public_profiles` view, never from `users`.**
  RLS on `users` locks each row to its owner, so a passenger literally cannot
  read the driver's name. The view exposes id/name/branch/year/rating only —
  no email, no phone.
- **Phone is revealed only through `get_ride_contacts(ride)`.** Phone stays out
  of `public_profiles`; this `security definer` RPC is the one scoped path —
  the driver gets active passengers' numbers, a passenger gets the driver's,
  and only for a ride they're actually on. MyRides surfaces it as call/WhatsApp.
- **`rides.from` and `rides.to` are reserved SQL keywords.** Quote them in raw
  SQL (`"from"`). The JS client is fine with `.select('from, to')`.
- **Rides are never deleted, only cancelled** (`status = 'cancelled'`), so
  passengers who already joined don't have rides vanish. No delete policy exists.
- Terminal statuses (`completed`, `cancelled`) win over the auto open/full sync.
- **`users.gender` is private** — own-row RLS only, never added to
  `public_profiles`. It exists solely to gate opt-in women-only rides.
  Values: `female | male | na` (na = prefer not to say).
- **Women-only rides are enforced server-side, not in the UI.** A woman opts
  a ride in at post time (`rides.women_only`). The `enforce_women_only_post`
  trigger blocks a non-woman from posting/flipping one on, and `join_ride()`
  rejects a non-woman trying to join (`'This ride is reserved for women'`).
  The Post toggle and feed filter are convenience; the triggers are the
  boundary. Caveat: gender is self-set and editable, so true enforcement
  needs ID verification (future work).

## Files

```
src/
  supabaseClient.js   Supabase client + isAllowedEmail() + ALLOWED_DOMAIN
  AuthFlow.jsx        3-step auth gate, wraps the app
  App.jsx             <AuthFlow><Shell/></AuthFlow> — bottom tab-bar shell
  RidesFeed.jsx       browse open rides, join/leave (Rides tab)
  PostRide.jsx        post-a-ride form, inserts into rides (Post tab)
  MyRides.jsx         driving + riding, cancel/complete/leave, rate, report
  Profile.jsx         view/edit own profile + rating, sign out
supabase/migrations/  the numbered .sql files
```

Navigation is a 4-tab bottom bar in `App.jsx` (Shell): Rides / Post /
My Rides / Profile. Each screen owns its layout via an inline `<style>` block.

## Known issues / watch for

- If a `.select()` with an embedded `driver:public_profiles!driver_id (...)`
  join errors with "Could not find a relationship", PostgREST can't infer the
  FK through the view — fetch drivers in a separate query instead.
- Supabase free tier sends ~2 auth emails/hour. Swap in custom SMTP (Resend)
  under Auth → SMTP Settings before real students use this.
- OTP codes expire after 1 hour by default.

## Ratings & reports (built)

- **`rate_user(p_ride_id, p_rated_id, p_stars)`** is the only write path into
  `ratings` (mirrors join/leave). It enforces: ride is `completed`, both
  parties were on it, no self-rating, once per (ride, rater, rated). The
  `recalc_user_rating` trigger recomputes `rating_avg` / `rating_count` — it's
  `security definer` so it bypasses both `users` RLS and `protect_user_columns`
  (which only freezes a user's edits to their *own* row).
- **`reports`** is a plain insert (no RPC): `reports_insert_own` lets you file
  as yourself about someone else; `reports_select_own` means you only read your
  own reports. Immutable — no update/delete. Review out of band (service role).

## Next up

1. Realtime seat updates (Supabase channels) so the feed reflects joins live.
2. Admin/moderation view over `reports` (service-role dashboard, not client).
3. Push/email notification when your ride fills or someone joins.

## Style notes

Dark green palette: bg `#0e1512`, card `#16201b`, border `#24332b`,
accent `#5fd08a`, muted text `#93a69a`. Inter / system sans.
Keep responses and code concise — prefer mechanism over explanation.
