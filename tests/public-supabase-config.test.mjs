import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import { createRequire } from "node:module";
import ts from "typescript";
const require = createRequire(import.meta.url);
const file = "src/lib/public-supabase-config.ts";
const code = ts.transpileModule(fs.readFileSync(file, "utf8"), {
  compilerOptions: {
    module: ts.ModuleKind.CommonJS,
    target: ts.ScriptTarget.ES2022,
    esModuleInterop: true,
  },
  fileName: file,
}).outputText;
const module = { exports: {} };
const config = JSON.parse(fs.readFileSync("supabase.public.config.json", "utf8"));
new Function("require", "module", "exports", code)(
  (name) => (name.endsWith("supabase.public.config.json") ? config : require(name)),
  module,
  module.exports,
);
const { resolvePublicSupabaseConnection, isBrowserSafeSupabaseKey } = module.exports;
const defaults = {
  supabaseUrl: "https://test-project.supabase.co",
  supabasePublishableKey: "sb_publishable_TEST_ONLY",
};
const jwt = (role) =>
  [
    Buffer.from('{"alg":"HS256"}').toString("base64url"),
    Buffer.from(JSON.stringify({ role })).toString("base64url"),
    "test_signature",
  ].join(".");

test("public settings work with zero environment variables when configured once", () => {
  const result = resolvePublicSupabaseConnection(undefined, undefined, defaults);
  assert.equal(result.configured, true);
  assert.equal(result.supabaseUrl, defaults.supabaseUrl);
  assert.equal(result.supabasePublishableKey, defaults.supabasePublishableKey);
});
test("an entirely unconfigured deployment resolves safely without throwing or fake keys", () => {
  assert.deepEqual(resolvePublicSupabaseConnection(undefined, undefined, {}), {
    supabaseUrl: null,
    supabasePublishableKey: null,
    configured: false,
  });
  assert.equal(
    resolvePublicSupabaseConnection().configured,
    Boolean(config.supabaseUrl && isBrowserSafeSupabaseKey(config.supabasePublishableKey)),
  );
});
test("optional environment settings override the committed configuration as a complete pair", () => {
  const result = resolvePublicSupabaseConnection(
    "https://override.supabase.co",
    "sb_publishable_OVERRIDE",
    defaults,
  );
  assert.equal(result.supabaseUrl, "https://override.supabase.co");
  assert.equal(result.supabasePublishableKey, "sb_publishable_OVERRIDE");
  assert.equal(result.configured, true);
});
test("partial overrides never mix credentials from different Supabase projects", () => {
  for (const [url, key] of [
    ["https://other.supabase.co", undefined],
    [undefined, "sb_publishable_OTHER"],
  ]) {
    assert.equal(resolvePublicSupabaseConnection(url, key, defaults).configured, false);
  }
});
test("service-role, secret and user access tokens are never browser-safe config", () => {
  for (const key of [
    "sb_secret_PRIVATE",
    jwt("service_role"),
    jwt("authenticated"),
    "sk-private",
    "invalid-key",
    "",
    null,
  ]) {
    assert.equal(isBrowserSafeSupabaseKey(key), false);
    const result = resolvePublicSupabaseConnection(defaults.supabaseUrl, key, defaults);
    assert.equal(result.supabasePublishableKey, null);
    assert.equal(result.configured, false);
  }
  assert.equal(isBrowserSafeSupabaseKey(jwt("anon")), true);
  assert.equal(isBrowserSafeSupabaseKey("sb_publishable_PUBLIC"), true);
});
test("malformed URLs and URL credentials fail gracefully", () => {
  for (const url of [
    "not-a-url",
    "http://remote.invalid",
    "https://user:password@project.supabase.co",
    "https://project.supabase.co?token=x",
  ]) {
    assert.equal(
      resolvePublicSupabaseConnection(url, defaults.supabasePublishableKey).configured,
      false,
    );
  }
  assert.equal(
    resolvePublicSupabaseConnection("http://127.0.0.1:54321", defaults.supabasePublishableKey)
      .configured,
    true,
  );
});
test("old Lovable environment startup instructions no longer exist in app source", () => {
  for (const file of [
    "src/integrations/supabase/client.ts",
    "src/hooks/useAuth.tsx",
    "src/routes/__root.tsx",
  ]) {
    assert.doesNotMatch(fs.readFileSync(file, "utf8"), /Connect Supabase in Lovable Cloud/);
  }
});
