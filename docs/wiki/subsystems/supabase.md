# Supabase project

- On 2026-11-27 the owner created a Supabase project for Milestone 3 (sync) and connected it to GitHub. Project URL: `https://mionebydpkthdqxljrow.supabase.co`.
- The publishable key was given in chat the same day. It is not a secret, because it ships in the web app; row-level security protects the data. The secret/`service_role` key was never shared, and it goes only through the environment's credential form if ever needed.
- The GitHub connection's folder and branch weren't confirmed on 2026-11-27, so the defaults were assumed: migrations in `supabase/`, deployed from `main`.
- On 2026-11-27 the host was added to the "My-Things-1" cloud environment. `GET /auth/v1/settings` with the publishable key returned 200: email sign-in on, sign-ups allowed, auto-confirm off.

Related: [Cloud environment](cloud-environment.md), ADR 0002 (local-first sync with Supabase).

- 2026-11-27: at the owner's request, the official Supabase plugin was installed (`claude plugin marketplace add anthropics/claude-plugins-official`, then `claude plugin install supabase@claude-plugins-official`, version 0.1.16, user scope). Its MCP server is `https://mcp.supabase.com/mcp`.
  - That host was added to the "My-Things-1" environment.
  - The owner saved a Supabase personal access token through the environment's credential form, so the proxy injects it. The token can manage every project on the account, and the owner can revoke it under Account → Access Tokens.
  - An `initialize` call returned HTTP 200.
  - Plugins load when a session starts, so the tools weren't available in the session that installed it.
  - A user-scope install lives in the container and is lost when a fresh container starts, unless a setup script reinstalls it.
