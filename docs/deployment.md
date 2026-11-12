# Deployment configuration

Elite Stocks loads safely even when no Supabase environment variables are supplied. Public pages
remain available; sign-in/sign-up show a small unavailable state rather than crashing the root route.
No placeholder connection, fake account, or successful financial transaction is invented.

## Host-independent public configuration

Configure `supabase.public.config.json` once with the existing project's HTTPS URL and browser-safe
publishable key or legacy `anon` JWT. Both browser and server use that file as their default, so those
public values do not have to be repeated in Vercel, Lovable or another hosting provider. The existing
project URL is present; the key remains `null` until the real public key is supplied. Without a valid
public pair, public browsing works but live authentication cannot operate. This JSON is bundled into
the browser: **never put a service-role/secret key, access token or database password in it.**

For deployment-specific connections, optionally override both values at server runtime:

- `SUPABASE_URL` — the intended Supabase project URL.
- `SUPABASE_PUBLISHABLE_KEY` (or `SUPABASE_ANON_KEY`) — its browser-safe key.

Overrides must be a complete valid pair. Partial overrides do not silently mix credentials from
another project. The runtime endpoint is authoritative when available; the committed browser-safe
configuration remains a fallback if that endpoint is unreachable. Changing the committed defaults
requires a rebuild; changing complete server/runtime overrides does not.

The application exposes only an allowlisted public runtime object containing those two values (or
`null`), the two boolean feature flags, and `configured`. It never returns
`SUPABASE_SERVICE_ROLE_KEY`, `INVESTMENT_JOB_SECRET`, or arbitrary environment values.

## Required private server configuration

Financial and trusted administrative server functions still require secure server credentials:

- `SUPABASE_SERVICE_ROLE_KEY` — server-only service-role credential used by the existing financial
  operations. It must not be placed in a `VITE_*` variable or sent to the browser.
- `INVESTMENT_JOB_SECRET` — server-only secret for the existing investment processor/scheduled job
  when that processor is enabled.

Missing Supabase settings do not prevent public informational pages from rendering. Authentication
and protected financial requests report an unavailable configuration instead of crashing the app.

## Optional feature flags

- `MAINTENANCE_MODE=true` renders the maintenance gate (the `/maintenance` page remains available).
- `IN_APP_SUPPORT=true` enables the authenticated support widget and admin support tab.

Omitted flags default to `false`. For compatibility with older deployments, the runtime reader also
accepts `VITE_SUPABASE_URL`, `VITE_SUPABASE_PUBLISHABLE_KEY`, `VITE_MAINTENANCE_MODE`, and
`VITE_FEATURE_IN_APP_SUPPORT`; new deployments should use the unprefixed server variables. Do not
use frontend `process.env` fallbacks.

## Managed hosting and release procedure

Use the committed public configuration for the default project, or configure a complete public
override pair in the hosting provider's server/runtime scope for deployment-specific projects.
Keep service-role and job secrets in server-only scopes or the host's managed secret system. Hosting
still requires a server runtime compatible with the existing TanStack Start application; deploying
only static files does not provide authenticated financial server functions.

The authoritative Node dependency lockfile is `package-lock.json`. `bun.lock` is stale compatibility
metadata and should not be used as the release lockfile. Install dependencies with the package
manager that matches the npm lockfile, then run the repository's existing build command. No new
runtime dependency is required for deployment independence.

Database migrations are a separate operational step. Apply the required Supabase migrations through
the normal migration process before enabling financial operations; this change does not run or verify
a live database migration and no live credentials are included here. Validate each environment's
secrets and database separately after deployment rather than treating a successful frontend build as
live verification.

## Investment engine rollout and preserved contracts

The new migration is `supabase/migrations/20261112190000_investment_engine.sql`. It is designed to run after the existing migrations against the application's existing database. Back up and review the target schema first. The historical repository references `public.user_roles` but does not contain the original migration that created it; verify that this established authorization table exists in the target environment. The local regression fixture models that dependency; it is not a replacement production schema.

The migration preserves existing amount/rate/duration/maturity/status and ledger fields. Existing rows gain interval/provenance columns only. Config updates affect new positions only; frontend and server reads load the current persistent configuration. Withdrawal limits remain synchronized with legacy platform settings. Financial limits are in native asset units for deposits/withdrawals and USDT for investments/copy trades, matching the current workflows.

Maturity releases principal once using the existing lifecycle. **A configured percentage is a projection, not evidence of performance, and is never automatically credited as actual profit.** Actual profit requires an administrator-attested immutable performance record with independently verifiable evidence and contractual references. The application records the attestation/references; it does not fetch or authenticate the contents of external evidence. No external performance feed was supplied or invented. Integrate the existing protected `recordVerifiedPerformance` server function or service-role-only `engine_record_performance` RPC with the organization's verified performance/reconciliation process. This workflow accepts non-negative actual profit, including zero; investment-loss reconciliation and corrections are not newly implemented. Historical already-settled positions cannot receive another profit record; their unverified historical ledger remains unchanged.

The existing processor path remains `/api/public/hooks/process-jobs`. Change the existing scheduler to an authenticated **POST** with `Authorization: Bearer <INVESTMENT_JOB_SECRET>`. GET now returns 405 and never mutates records. A missing secret produces 503; an invalid secret produces 401. This task did not create, replace, or schedule automation. Ensure the existing scheduler is updated before the release so maturity processing continues.

Before switching traffic, retire old worker/scheduler/application instances that could run the previous percentage-based processor or direct balance writes. Old and new worker implementations must not process financial records concurrently. Run the new migration and application release together in a controlled maintenance window, then use a staging environment and authorized test accounts to validate the real Supabase auth/session/provider behavior and deployment integration. Do not use production customer transactions as regression fixtures.

The existing user-confirmed/time-based deposit workflow is preserved; it is not upgraded to blockchain/payment-provider verification. Successful local database tests do not establish that real funds were received or that withdrawals were executed on-chain. Reconcile those existing operational integrations separately.

## Local verification commands

Use `npm ci --ignore-scripts --no-audit --no-fund`, `npm run typecheck`, `npm test`, and `npm run build`. `npm run test:database` requires PostgreSQL 16 tooling and Python 3; it creates a temporary local Unix-socket-only cluster and removes it on exit. It never reads production URLs or secrets. The fixture skips the old extension-only `pg_cron`/`pg_net` migration because vanilla local PostgreSQL does not provide Supabase's `pg_net`; no engine logic depends on those extensions.

For an HTTP smoke test, run the generated `.output/server/index.mjs` locally with `PORT=3100`, no Supabase credentials/optional flags/job secret, then run `python3 scripts/test-runtime-smoke.py`. This checks all declared existing HTML pages and safe job-route failures, not browser hydration or live financial authorization. Inspect only `.output/public` when scanning browser output for secret leakage; server output legitimately references server-only credential names.

The existing full-repository lint command reports inherited formatting issues in untouched files. Upgrade-owned files are linted separately to avoid a broad unrelated formatting rewrite. The existing auth module retains its two React Fast Refresh warnings. No dependency or lockfile upgrade is included.

## Confirmed live-schema compatibility correction

The user-supplied Supabase metadata shows an existing `platform_settings` table with per-asset wallet fields, legacy `addr_*` aliases, unrestricted `numeric` withdrawal limits, fee fields and enabled switches, but no generic `wallet_address` or `updated_by`. The corrected migration does not add or depend on a generic wallet column. It adds only a nullable `updated_by` editor pointer, retains existing settings and addresses on installation, uses exact numeric `trim_scale` for the withdrawal-limit seed, and synchronizes legacy wallet aliases only when an authorized administrator intentionally edits the corresponding address. Existing deposit/withdrawal enabled switches are honored when present. Fee and unrelated mining/maintenance values are retained, not redefined; no new fee formula or on-chain verification is introduced.

Use the corrected v2 SQL Editor handoff instead of the previous file. This correction is based on the supplied column metadata and existing function signatures; live constraints, triggers, function bodies and operational integrations have not been inspected directly. Keep the database backup, controlled worker transition and staging checks described above. No assistant-run changes have been applied to the live Supabase database.

`npm run test:database:live-schema` uses the same disposable local-only database runner but reproduces the supplied per-asset/legacy wallet layout, absent editor field and unrestricted numeric withdrawal limits before applying the upgrade. Both files named `tests/*fixture.sql` and all regression seeds/assertions are test-only and must never be pasted into a production Supabase SQL Editor.
