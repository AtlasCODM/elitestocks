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
  assert.match(source("src/lib/admin.functions.ts"), /\.from\("user_roles"\)/);
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
