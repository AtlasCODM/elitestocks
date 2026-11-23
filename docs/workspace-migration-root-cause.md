# EliteStocks Phase 1 workspace migration audit

**Audit date:** 2026-11-23  
**Repository:** `AtlasCODM/elitestocks`  
**Scope:** checked-in migrations, fixtures, tests, and application database calls

## Executive conclusion

A production-safe final Phase 1 migration cannot be produced from this checkout alone. The repository is a single-workspace application and contains no workspace migration, workspace-aware RPCs, workspace context in the server middleware, or live-schema export. The supplied live diagnostic now verifies the current catalog sections, but it still does not provide an isolated execution environment or a complete installed migration history.

Creating a guessed migration would violate the task requirements and could expose financial records across workspaces. The safe change made in this commit is therefore a read-only live preflight audit, not an untested migration pretending to be complete.

The earlier administrator list has since been superseded by the complete diagnostic: only Testing currently has the `admin` role. The earlier Meback and WebTest assignments are already absent. The current administrator record is:

- `5031f488-3ed2-4acd-86b7-931ac6404728` (`theytest@gmail.com`, Testing)

The copyable script `supabase/diagnostics/remove-retired-admin-roles.sql` remains safe to run as a verification/idempotent cleanup: it removes only the `admin` role rows for Meback and WebTest if present, accepts the already-clean state, verifies that Testing retains that role, and does not delete accounts or application data. It does not introduce a super-admin role or hierarchy.

## Verified current state

The checked-in migrations show:

- `profiles`, `wallets`, `transactions`, `investments`, and `copy_trades` are keyed by users or global identifiers and have no `workspace_id`.
- `traders` is global.
- `platform_settings` and `investment_engine_config` are singleton rows (`id = true`). They cannot represent independent workspace settings/configuration without replacing the singleton assumptions in seed logic, triggers, RPCs, readers, and application calls.
- `support_conversations` and `support_messages` are globally scoped by user/conversation and authorize every administrator globally.
- `is_admin()` ultimately checks `public.user_roles.role = 'admin'`, with no workspace dimension.
- The application uses `supabaseAdmin`, which bypasses RLS, and passes only user/actor/record IDs to the engine, admin, and support RPCs.

## Verified live diagnostic findings

The supplied export was collected as `postgres` on PostgreSQL 17.6. It reports no `supabase_migrations.schema_migrations` relation and explicitly confirms that both `public.workspaces` and `public.workspace_members` are absent. It found similarly named relations only under `auth`, `realtime`, and `storage`; those are not evidence of the application migration history. The preflight query was changed to discover migration-like relations from the catalog without referencing a missing table.

The target currently reports these relevant estimated row counts: 2 profiles, 8 wallets, 3 transactions, 2 investment-engine audit rows, 0 investment-engine performance rows, 0 investments, 0 copy trades, 0 support conversations, 0 support messages, 0 traders, 0 platform settings rows, 1 engine configuration row, and 0 user-role rows according to the catalog estimate. The estimate for `user_roles` conflicts with the returned administrator row and should be treated as stale statistics, not proof that the row is absent.

The live definitions confirm that `user_roles` has UUID `id` primary key, `user_id` foreign key, `app_role` role, and unique `(user_id, role)`. The engine audit/performance tables retain unconditional immutability triggers; audit has 2 rows with non-null actors, performance has 0 rows. The singleton `platform_settings` and `investment_engine_config` constraints remain present. RLS is enabled on the relevant public tables, but existing policies are global/user-based and the SECURITY DEFINER RPCs remain workspace-blind.

## Actual immutable-history failure

`20261112190000_investment_engine.sql` creates unconditional `BEFORE UPDATE OR DELETE` triggers on both `investment_engine_audit` and `investment_engine_performance`. Their shared function raises `Investment engine records are immutable` for every update and delete.

Therefore, a migration that adds `workspace_id` to either table and backfills it with `UPDATE` will fail. The failure is deterministic and independent of RLS. The final repair must either:

1. perform a controlled, migration-only assignment of a previously `NULL` workspace association while retaining the triggers and then make that association immutable; or
2. rebuild/copy the history rows while preserving IDs, timestamps, actors, evidence, contract references, values, and uniqueness, then install unconditional final immutability triggers.

The correct choice depends on the actual live table definitions and existing rows. That information is not present in the repository.

## Additional blockers discovered

1. There is no checked-in source migration for `public.user_roles`; the supplied live export now verifies its current columns and constraints, but not its full creation history.
2. The supplied diagnostic states that no super-admin exists. This work does not introduce a super-admin role or hierarchy.
3. The application migration history is unknown because `supabase_migrations.schema_migrations` is absent in the supplied target. The checked-in files may not match the deployed project, and a failed transaction may or may not have rolled back completely.
4. Existing live audit/performance rows and duplicate/invalid workspace mappings are unknown.
5. All listed RPCs are workspace-blind. RLS changes alone would not protect calls executed through the service-role client or `SECURITY DEFINER` functions.
6. The processor scans all investments and copy trades globally, and settings/config lock and synchronization triggers assume one singleton.
7. Support storage policies are global-admin based and require a workspace-aware attachment authorization design.

## Previously corrected versus unresolved

The repository already corrected several unrelated or earlier issues: user-role authority was restored, the financial processor was hardened against elapsed-time deposit confirmation and withdrawal completion, and engine history triggers were installed. Those changes are present and must be preserved.

The multi-workspace requirements remain unresolved: workspace tables and memberships, legacy mapping, workspace-keyed settings/configuration, workspace-aware RPC contracts and authorization, workspace-scoped RLS, application workspace resolution, and cross-workspace tests.

## Required live preflight

Run `supabase/diagnostics/workspace-migration-preflight.sql` against the actual project and save its output. It contains only PostgreSQL statements accepted by the Supabase SQL Editor, no psql backslash commands, and intentionally performs no DDL or DML. Before any migration is authored, the output must establish:

- installed migration history;
- exact definitions of all tenant tables, functions, triggers, constraints, indexes, policies, grants, and relevant storage objects;
- row counts and null/duplicate checks;
- existing partial workspace objects, if any; and
- the confirmed super-administrator identity and membership basis.

A backup and isolated/staging execution environment are also required. Until those prerequisites are available, the repository must not claim that a corrected migration has passed execution or integration validation.

If the administrator cleanup is authorized, run `supabase/diagnostics/remove-retired-admin-roles.sql` separately after reviewing the live `user_roles` constraints and grants. Do not combine it with a workspace migration.

## Validation status

| Check | Result |
|---|---|
| Repository static audit | Completed |
| Root cause of immutable-history error | Confirmed from checked-in SQL |
| Administrator diagnostic review | Completed; only Testing currently has `admin` |
| Live Supabase catalog/policy/RPC audit | Completed from the supplied export; no direct connection from this sandbox |
| Isolated execution of a Phase 1 migration | Not performed: no Phase 1 migration exists in the checkout |
| Cross-workspace integration tests | Not performed |
| Production migration | Not performed |

## Application compatibility impact

Before a migration can be applied, the application needs trusted workspace resolution in the authenticated server context, explicit workspace parameters or server-derived workspace context for all relevant calls, workspace filters on every service-role read, workspace-aware admin/support UI state, and regenerated Supabase types. Legacy RPC signatures may remain only as tightly controlled wrappers for the primary workspace during a staged rollout; they must not continue accepting arbitrary user or record IDs without a workspace authorization check.
