import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";

const source = (file) => fs.readFileSync(file, "utf8");

test("every new financial and admin write retains authenticated middleware", () => {
  for (const file of [
    "invest",
    "deposit",
    "withdraw",
    "copy",
    "investments",
    "financial-config",
    "admin",
  ]) {
    const content = source(`src/lib/${file}.functions.ts`);
    assert.match(content, /requireSupabaseAuth/);
    const mutations = content
      .split(/export const /)
      .filter((block) => block.includes('method: "POST"'));
    for (const mutation of mutations)
      assert.match(
        mutation,
        /\.middleware\(\[requireSupabaseAuth\]\)/,
        `${file} financial write missing auth`,
      );
  }
});
test("configuration/performance writes require authoritative administrator checks", () => {
  const content = source("src/lib/financial-config.functions.ts");
  for (const name of [
    "updateFinancialConfiguration",
    "recordVerifiedPerformance",
    "getAdminFinancialConfiguration",
  ]) {
    const block = content.split(`export const ${name}`)[1]?.split("export const ")[0];
    assert.match(block, /requireAdmin\(context\.supabase, context\.userId\)/);
  }
  assert.match(source("src/lib/admin.functions.ts"), /authClient\.rpc\("is_admin"\)/);
});
test("mutating job endpoint is no longer an unauthenticated GET", () => {
  const content = source("src/routes/api/public/hooks/process-jobs.ts");
  assert.match(content, /INVESTMENT_JOB_SECRET/);
  assert.match(content, /401/);
  assert.match(content, /405/);
  assert.match(content, /engine_process_jobs/);
  assert.doesNotMatch(content, /Number\(\w+\.amount\)\s*\*\s*\(1\s*\+/);
});
test("frontend has no duplicated configured plan rates or guaranteed-return statements", () => {
  for (const file of [
    "src/routes/strategies.tsx",
    "src/lib/market-data.ts",
    "src/lib/platform.server.ts",
  ]) {
    const content = source(file);
    assert.doesNotMatch(
      content,
      /(?:const|export const)\s+(?:PLANS|STRATEGIES|MIN_INVESTMENT)\s*=/,
    );
  }
  assert.doesNotMatch(
    source("src/routes/strategies.tsx"),
    /plans with guaranteed returns|receive your principal plus the stated profit/i,
  );
});
test("public configuration response excludes privileged credentials", () => {
  const content = source("src/lib/public-config.functions.ts");
  assert.doesNotMatch(content, /SUPABASE_SERVICE_ROLE_KEY|INVESTMENT_JOB_SECRET/);
  assert.doesNotMatch(
    source("src/integrations/supabase/client.ts"),
    /process\.env\.(?:SUPABASE_SERVICE_ROLE_KEY|SUPABASE_PUBLISHABLE_KEY|SUPABASE_URL)/,
  );
});

test("registration uses the returned Supabase session and password recovery is implemented", () => {
  const signup = source("src/routes/signup.tsx");
  assert.match(signup, /data\.session/);
  assert.doesNotMatch(signup, /signInWithPassword/);
  const recovery = source("src/routes/reset-password.tsx");
  assert.match(recovery, /resetPasswordForEmail/);
  assert.match(recovery, /updateUser\(\{ password \}\)/);
  assert.match(source("src/routes/login.tsx"), /Forgot password\?/);
});

test("public Supabase values are centralized and support attachment signing is owner-scoped", () => {
  const serverConfig = source("src/lib/config.server.ts");
  assert.doesNotMatch(serverConfig, /SUPABASE_URL|SUPABASE_PUBLISHABLE_KEY|SUPABASE_ANON_KEY/);
  const envExample = source(".env.example");
  assert.doesNotMatch(envExample, /SUPABASE_URL|SUPABASE_PUBLISHABLE_KEY|SUPABASE_ANON_KEY/);
  assert.match(source("src/lib/support.functions.ts"), /ownerId !== context\.userId/);
});

test("security migration removes self-editable profile privileges and time-only financial settlement", () => {
  const migration = source(
    "supabase/migrations/20261119210000_auth_financial_security_hardening.sql",
  );
  assert.match(migration, /REVOKE UPDATE ON public\.profiles/);
  assert.match(migration, /GRANT UPDATE \(display_name\) ON public\.profiles TO authenticated/);
  assert.match(migration, /auth\.uid\(\) IS NULL OR actor IS NOT DISTINCT FROM auth\.uid\(\)/);
  const processor = migration.split("CREATE OR REPLACE FUNCTION public.engine_process_jobs()")[1];
  assert.doesNotMatch(processor, /type = 'deposit' AND status IN/);
  assert.doesNotMatch(processor, /type = 'withdrawal' AND status IN/);
});
