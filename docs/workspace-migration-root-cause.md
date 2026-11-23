# EliteStocks Phase 1 workspace migration audit

**Audit date:** 2026-11-23  
**Repository:** `AtlasCODM/elitestocks`  
**Scope:** checked-in migrations, fixtures, tests, and application database calls

## Executive conclusion

A production-safe final Phase 1 migration cannot be produced from this checkout alone. The repository is a single-workspace application and contains no workspace migration, workspace-aware RPCs, workspace context in the server middleware, or live-schema export. The supplied diagnostic output verifies three current administrator assignments, but does not include the complete catalog, migration history, policies, triggers, grants, or row-level results needed to author a safe workspace migration.

Creating a guessed migration would violate the task requirements and could expose financial records across workspaces. The safe change made in this commit is therefore a read-only live preflight audit, not an untested migration pretending to be complete.

The supplied administrator records are:

- `41f53e7d-c2ef-4510-a672-1417e5aeb1a4` (`meback@gmail.com`, Meback)
- `5031f488-3ed2-4acd-86b7-931ac6404728` (`theytest@gmail.com`, Testing)
- `8741995f-5ef5-4674-8143-eeff5ab99305` (`webtest@gmail.com`, WebTest)

The requested cleanup is separate from workspace migration. The copyable script `supabase/diagnostics/remove-retired-admin-roles.sql` removes only the `admin` role rows for Meback and WebTest, verifies that Testing retains that role, and does not delete accounts or application data. It does not introduce a super-admin role or hierarchy.

## Verified current state

The checked-in migrations show:

- `profiles`, `wallets`, `transactions`, `investments`, and `copy_trades` are keyed by users or global identifiers and have no `workspace_id`.
- `traders` is global.
- `platform_settings` and `investment_engine_config` are singleton rows (`id = true`). They cannot represent independent workspace settings/configuration without replacing the singleton assumptions in seed logic, triggers, RPCs, readers, and application calls.
- `support_conversations` and `support_messages` are globally scoped by user/conversation and authorize every administrator globally.
- `is_admin()` ultimately checks `public.user_roles.role = 'admin'`, with no workspace dimension.
- The application uses `supabaseAdmin`, which bypasses RLS, and passes only user/actor/record IDs to the engine, admin, and support RPCs.

## Actual immutable-history failure

`20261112190000_investment_engine.sql` creates unconditional `BEFORE UPDATE OR DELETE` triggers on both `investment_engine_audit` and `investment_engine_performance`. Their shared function raises `Investment engine records are immutable` for every update and delete.

Therefore, a migration that adds `workspace_id` to either table and backfills it with `UPDATE` will fail. The failure is deterministic and independent of RLS. The final repair must either:

1. perform a controlled, migration-only assignment of a previously `NULL` workspace association while retaining the triggers and then make that association immutable; or
2. rebuild/copy the history rows while preserving IDs, timestamps, actors, evidence, contract references, values, and uniqueness, then install unconditional final immutability triggers.

The correct choice depends on the actual live table definitions and existing rows. That information is not present in the repository.

## Additional blockers discovered

1. There is no checked-in source migration for `public.user_roles`; the fixture is explicitly test-only. Its live type, constraints, grants, policies, and rows beyond the supplied administrator result are unknown.
2. The supplied diagnostic states that no super-admin exists. This work does not introduce a super-admin role or hierarchy.
3. The installed migration history is unknown. The checked-in files may not match the deployed project, and a failed transaction may or may not have rolled back completely.
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
| Administrator diagnostic review | Completed for the three supplied UUIDs and requested cleanup scope |
| Live Supabase catalog/policy/RPC audit | Not performed: complete diagnostic output was not supplied |
| Isolated execution of a Phase 1 migration | Not performed: no Phase 1 migration exists in the checkout |
| Cross-workspace integration tests | Not performed |
| Production migration | Not performed |

## Application compatibility impact

Before a migration can be applied, the application needs trusted workspace resolution in the authenticated server context, explicit workspace parameters or server-derived workspace context for all relevant calls, workspace filters on every service-role read, workspace-aware admin/support UI state, and regenerated Supabase types. Legacy RPC signatures may remain only as tightly controlled wrappers for the primary workspace during a staged rollout; they must not continue accepting arbitrary user or record IDs without a workspace authorization check.
