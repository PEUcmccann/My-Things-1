# Supabase project

- On 2026-11-27 the owner created a Supabase project for Milestone 3 (sync) and connected it to GitHub. Project URL: `https://mionebydpkthdqxljrow.supabase.co`.
- The publishable key was given in chat the same day. It is not a secret, because it ships in the web app; row-level security protects the data. The secret/`service_role` key was never shared, and it goes only through the environment's credential form if ever needed.
- The GitHub connection's folder and branch weren't confirmed on 2026-11-27, so the defaults were assumed: migrations in `supabase/`, deployed from `main`.
- On 2026-11-27 the host was added to the "My-Things-1" cloud environment. `GET /auth/v1/settings` with the publishable key returned 200: email sign-in on, sign-ups allowed, auto-confirm off.

Related: [Cloud environment](cloud-environment.md), ADR 0002 (local-first sync with Supabase).
