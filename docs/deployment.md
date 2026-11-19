# Deployment configuration

Elite Stocks uses the checked-in browser-safe Supabase configuration and requires no public
Supabase environment variables. No placeholder connection, fake account, or successful financial
transaction is invented.

## Host-independent public configuration

`supabase.public.config.json` is the single source for the intended project's HTTPS URL and
browser-safe publishable key. The browser and server use this checked-in public configuration, so
these values do not need to be duplicated in Vercel, Lovable, or another hosting provider. Changing
projects means intentionally updating both values together and rebuilding.

This JSON is bundled into the browser. A Supabase publishable key (or legacy `anon` JWT) is designed
for public clients; **never put a service-role/secret key, access token, or database password in it.**

The application exposes only an allowlisted public runtime object containing those two values (or
`null`), the two optional boolean feature flags, and `configured`. It never returns
`SUPABASE_SERVICE_ROLE_KEY`, `INVESTMENT_JOB_SECRET`, or arbitrary environment values.

## Required private server configuration

Financial and trusted administrative server functions still require secure server credentials:

- `SUPABASE_SERVICE_ROLE_KEY` — server-only service-role credential used by the existing financial
  operations. It must not be placed in a `VITE_*` variable or sent to the browser.
- `INVESTMENT_JOB_SECRET` — server-only secret for the existing investment processor/scheduled job
  when that processor is enabled.

Missing server-side privileged credentials do not prevent public informational pages or Supabase
Auth from loading. Protected financial/admin operations report an unavailable server credential
instead of crashing the app.

## Optional feature flags

- `MAINTENANCE_MODE=true` renders the maintenance gate (the `/maintenance` page remains available).
- `IN_APP_SUPPORT=true` enables the authenticated support widget and admin support tab.

Omitted flags default to `false`. Public Supabase settings are not read from `VITE_*` or Vercel
variables. Do not use frontend `process.env` fallbacks.

Supabase Auth redirect URLs must allow the deployed origin's `/wallet` and `/reset-password` paths.
The reset email callback depends on `/reset-password` being present in the project's Auth redirect
allow list.

## Managed hosting and release procedure

Use the committed public configuration; no public Supabase Vercel variables are required. Keep
service-role and job secrets in server-only scopes or the host's managed secret system. Hosting still
requires a server runtime compatible with the existing TanStack Start application; deploying only
static files does not provide authenticated financial server functions.

The authoritative Node dependency lockfile is `package-lock.json`. `bun.lock` is stale compatibility
metadata and should not be used as the release lockfile. Install dependencies with the package
manager that matches the npm lockfile, then run the repository's existing build command. No new
runtime dependency is required for deployment independence.

Database migrations are a separate operational step. Review and apply
`supabase/migrations/20261119210000_auth_financial_security_hardening.sql` manually only after
confirming that the target has the preceding investment-engine migration, the expected `profiles`
owner-scoped UPDATE policy, and the established `user_roles` table. The migration checks these
preconditions and aborts if they are not met. It does not alter user/financial rows or run against
Supabase from this repository task. A successful frontend build is not live database verification;
the publishable key in the browser config is public, but no private database/service credentials are
included.

## Investment engine rollout and preserved contracts

The new migration is `supabase/migrations/20261112190000_investment_engine.sql`. It is designed to run after the existing migrations against the application's existing database. Back up and review the target schema first. The historical repository references `public.user_roles` but does not contain the original migration that created it; verify that this established authorization table exists in the target environment. The local regression fixture models that dependency; it is not a replacement production schema.

The migration preserves existing amount/rate/duration/maturity/status and ledger fields. Existing rows gain interval/provenance columns only. Config updates affect new positions only; frontend and server reads load the current persistent configuration. Withdrawal limits remain synchronized with legacy platform settings. Financial limits are in native asset units for deposits/withdrawals and USDT for investments/copy trades, matching the current workflows.

Maturity releases principal once using the existing lifecycle. **A configured percentage is a projection, not evidence of performance, and is never automatically credited as actual profit.** Actual profit requires an administrator-attested immutable performance record with independently verifiable evidence and contractual references. The application records the attestation/references; it does not fetch or authenticate the contents of external evidence. No external performance feed was supplied or invented. Integrate the existing protected `recordVerifiedPerformance` server function or service-role-only `engine_record_performance` RPC with the organization's verified performance/reconciliation process. This workflow accepts non-negative actual profit, including zero; investment-loss reconciliation and corrections are not newly implemented. Historical already-settled positions cannot receive another profit record; their unverified historical ledger remains unchanged.

The existing processor path remains `/api/public/hooks/process-jobs`. Change the existing scheduler to an authenticated **POST** with `Authorization: Bearer <INVESTMENT_JOB_SECRET>`. GET now returns 405 and never mutates records. A missing secret produces 503; an invalid secret produces 401. This task did not create, replace, or schedule automation. Ensure the existing scheduler is updated before the release so maturity processing continues.

Before switching traffic, retire old worker/scheduler/application instances that could run the previous percentage-based processor or direct balance writes. Old and new worker implementations must not process financial records concurrently. Run the new migration and application release together in a controlled maintenance window, then use a staging environment and authorized test accounts to validate the real Supabase auth/session/provider behavior and deployment integration. Do not use production customer transactions as regression fixtures.

With the hardening migration applied, elapsed time alone no longer credits a user-submitted deposit or marks a withdrawal successful. Deposits remain pending for the existing administrator review path; the application still does not independently verify blockchain/payment evidence or execute a payout. Successful local database tests do not establish that real funds were received or withdrawals were executed on-chain. Reconcile external payment and payout operations separately.

## Local verification commands

Use `npm ci --ignore-scripts --no-audit --no-fund`, `npm run typecheck`, `npm test`, and `npm run build`. `npm run test:database` requires PostgreSQL 16 tooling and Python 3; it creates a temporary local Unix-socket-only cluster and removes it on exit. It never reads production URLs or secrets. The fixture skips the old extension-only `pg_cron`/`pg_net` migration because vanilla local PostgreSQL does not provide Supabase's `pg_net`; no engine logic depends on those extensions.

For an HTTP smoke test, run the generated `.output/server/index.mjs` locally with `PORT=3100`, no Supabase credentials/optional flags/job secret, then run `python3 scripts/test-runtime-smoke.py`. This checks all declared existing HTML pages and safe job-route failures, not browser hydration or live financial authorization. Inspect only `.output/public` when scanning browser output for secret leakage; server output legitimately references server-only credential names.

The existing full-repository lint command reports inherited formatting issues in untouched files. Upgrade-owned files are linted separately to avoid a broad unrelated formatting rewrite. The existing auth module retains its two React Fast Refresh warnings. No dependency or lockfile upgrade is included.

## Target project verification boundary

The selected project URL differs from the repository's earlier public-config default. Its public Auth
settings endpoint was read without modifying accounts and reported email signup enabled with email
auto-confirm enabled at the time checked. That does not prove that a registration email, reset email,
database migration, storage policy, or financial operation succeeds. No Supabase database migration
has been applied by this task. Confirm this project's installed migration history, schema and RLS
policies before applying the guarded SQL migration. Local fixtures are test-only and must never be
pasted into a production SQL Editor.
