# EliteStocks — targeted investment engine upgrade

## Scope and approach

Continue the existing `AtlasCODM/elitestocks` checkout on `main`; preserve the React/TanStack Start/Vite/Nitro application, Supabase authentication, black/gold interface, route/component structure, user relationships, and existing workflows. No new project, repository, infrastructure, GitHub push, production deployment, or live database changes are part of this implementation.

Introduce an additive database configuration singleton and immutable configuration audit history. Seed the six established plans (3/7/14/21/30/60 days) with the existing rates solely in the database migration. Administrators edit financial limits, independent plan rates/durations/enabled flags, and hourly/daily simple term projection frequency through the existing restricted console. Synchronize legacy withdrawal settings so both settings interfaces retain compatibility. Read current configuration for each new financial operation, validate within the database transaction, and snapshot version/rate/duration/interval on creation. Existing investment amount, rate, maturity, and statuses are never rewritten by configuration changes.

Use exact PostgreSQL numeric arithmetic and row locks for balance changes, position creation/cancellation, and maturity settlement. Projection accrual is simple, not compounded, calculated only at complete hourly/daily intervals with a final maturity catch-up. Projection accrual does not credit a wallet. Real profit settlement requires a privileged verified-performance record with evidence and contractual references; rates alone never create actual earnings. Historical returns are not retroactively recategorized or deleted. At maturity principal can be released once; a verified profit can be credited once, including later verification. Record those distinctions in transaction metadata and position summaries. The existing processor URL is retained but requires a server-only job secret for state-changing requests; unauthenticated GET cannot mutate financial records.

Keep public/non-sensitive configuration separate from secrets. Make Supabase public connection settings discoverable from the existing server at runtime, retain legacy public build variables as optional compatibility overrides, preserve server-only service-role credentials, and default optional feature flags safely. Missing mandatory Supabase configuration should produce a useful unavailable state rather than an unhandled frontend crash. No optional integrations or unrelated visual redesigns are introduced.

## Existing structure and ownership

- `src/routes/`: existing public, auth, wallet, history, investment, and admin screens.
- `src/components/`: existing UI/site components; one new configuration panel is mounted in the admin console.
- `src/lib/`: centralized financial configuration schema, pure projection helper, and existing server-function workflows.
- `src/integrations/supabase/`: existing clients, database types, and auth middleware.
- `supabase/migrations/`: one non-destructive upgrade migration; never applied to the connected live project by this task.
- `tests/` and `scripts/`: deterministic local regression and database integration checks, without real user transactions.
- `docs/`: deployment prerequisites, exact changes, limitations, and test evidence.

## Deployment boundary

Prepare and test code locally. Applying the migration and configuring the existing deployment's managed secrets are explicit rollout steps, not performed silently. There is no investment-performance feed in the existing repository: the upgrade must not manufacture one, guarantee future earnings, or claim live authentication/financial workflows were verified without access and an authorized test environment.
