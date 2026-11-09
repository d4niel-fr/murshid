# Security

No website is impossible to attack. Murshid is built so that the common attacks fail, a mistake in one place does not
expose everything, and the things only the hosting provider can stop (floods of traffic) are switched on there.

## What is in place

- **Who can see what.** Every API route checks who is asking: students see their own data, teachers only their own
  classes, school admins only their own school, parents their child's plan read-only. Check-ins and health data are
  never shown to parents; private check-ins are never shown to teachers. Cross-school and cross-student tests run in CI.
- **Sign-in.** Supabase Auth with verified tokens (signature, expiry, audience and issuer checked). The demo's header
  sign-in only works when `AUTH_MODE` is not `jwt`.
- **Input.** Every request body is checked against a schema with maximum sizes; links must be http(s); uploaded files
  must really be the type they claim (photos, PDF, Office, text) and are served as downloads with `nosniff`.
- **No injection.** The database is reached through Supabase's REST API with parameters, never hand-built SQL. Notes
  and AI answers are rendered as React elements (no raw HTML); `javascript:` and other unsafe links are shown as text.
- **Limits.** Per-IP and per-person rate limits on every route, lockouts after repeated wrong codes or passcodes, a cap
  on requests in flight, and timeouts. Payment webhooks and the reminder job are checked by signature or secret.
- **Server-side calls.** Calls to outside URLs (calendar feeds, Microsoft, Stripe, Fitbit, Strava, Oura) only go to
  public addresses (no internal network), with timeouts.
- **Browser.** Content-Security-Policy, HSTS, no framing (clickjacking), `nosniff`, a strict referrer policy and a
  Permissions-Policy that only allows the microphone and camera on the student app. Sign-in redirects only go to
  pages on this site.
- **Secrets.** Keys live in Vercel environment variables, never in the code. Fitbit, Strava and Oura tokens are stored
  encrypted (AES-256-GCM, `HEALTH_TOKEN_KEY`). The Supabase service key is only used by the API; the browser key can
  only do what row-level security allows.
- **Privacy.** "Download my data" and "Delete my account" in settings; deleting removes the student's record, check-ins
  and health data.

## Switch these on when you deploy

1. **Vercel → Project → Firewall**
   - Bot Protection: on.
   - A rate-limit rule: path starts with `/api/`, 600 requests per minute per IP, action Deny (a school can share one
     IP, so do not set it much lower).
   - If the site is ever flooded: turn on Attack Challenge Mode until it stops. Vercel's network absorbs the traffic;
     the app's own limits handle the rest.
2. **Supabase → Authentication**: keep "Confirm email" on; turn on CAPTCHA under Attack Protection if fake sign-ups
   appear; set the Site URL and redirect URLs to your domain only.
3. **Keys**: use long random values for `CRON_SECRET`, `HEALTH_TOKEN_KEY`, `MS_STATE_SECRET` and
   `SURVEY_ADMIN_CODE`; give the service-role key to the API project only; rotate any key that was ever pasted into a
   chat, an email or a commit.
4. Leave `ADMIN_PASSCODE` empty in production unless you run the public demo there.

`TURNSTILE_SECRET_KEY` (Cloudflare's bot check) is supported by the API but the forms do not show the Cloudflare
widget yet: leave it empty, or sign-up, checkout and the survey will be refused.

## Reporting a problem

Email the address in `/.well-known/security.txt`. Please give us time to fix it before telling anyone else.
