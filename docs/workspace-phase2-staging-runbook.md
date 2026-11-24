# Phase 2 workspace migration staging runbook

## Required before the coordinated RPC migration

The Phase 2 migration changes `SECURITY DEFINER` financial, mining, spot-order, support, administrative, and processor functions. It must not be run first against the production project.

Create a verified backup using the Supabase project backup/branch workflow or an authorized database export. The SQL Editor cannot create a reliable independent backup of the whole Supabase project, including Auth, Storage, extensions, privileges, and provider-managed objects.

Create an isolated staging project or database clone containing:

- the current public schema and all deployed functions;
- representative primary-workspace rows for wallets, transactions, investments, copy trades, deposits, withdrawals, miners, rewards, spot orders, support records, settings, configuration, and immutable engine history;
- the current Auth user IDs referenced by those rows, or a documented fixture mapping;
- the current role and privilege grants needed to exercise the functions.

The staging copy must be resettable so the migration can be rerun from the same pre-migration state. Do not use production credentials or production webhook processors against staging.

## Read-only inventory

Run [`workspace-phase2-preflight.sql`](../supabase/diagnostics/workspace-phase2-preflight.sql) against staging as the database owner and save the complete result. It returns:

- exact columns, constraints, indexes, triggers, policies, grants, and row count for `platform_settings` and `platform_deposit_addresses`;
- every deployed public `SECURITY DEFINER` function body and signature;
- explicit and effective function privileges for `anon`, `authenticated`, `service_role`, and `postgres`;
- representative row counts;
- null-workspace and duplicate-key consistency checks.

Do not redact function signatures, privilege results, constraints, or configuration column definitions from the staging result. Row values and secrets should not be included in this inventory.

## Staging confirmation required

Before the coordinated migration is authored for execution, confirm all of the following:

1. The backup completed successfully and can be restored or the staging branch can be recreated.
2. The staging database contains the current deployed schema and representative data.
3. The preflight SQL ran successfully in staging.
4. The staging database can be reset and the migration rerun.
5. Background processors, webhooks, and scheduled jobs are disabled or pointed away from staging.
6. The application can be configured to use staging credentials and a staging Supabase URL.

The assistant has not created the backup, staging project, or executed this preflight against Supabase. Those actions require access to the authorized Supabase project and must be performed by the project operator.
