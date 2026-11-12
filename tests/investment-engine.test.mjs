import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { createRequire } from "node:module";
import ts from "typescript";

const require = createRequire(import.meta.url);
function load(relative) {
  const file = path.resolve(relative);
  const source = ts.transpileModule(fs.readFileSync(file, "utf8"), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
    fileName: file,
  }).outputText;
  const module = { exports: {} };
  new Function("require", "module", "exports", source)(require, module, module.exports);
  return module.exports;
}
const { FinancialConfigurationSchema, validateFinancialAmount, PLAN_TIERS } = load(
  "src/lib/financial-config.ts",
);
const { previewInvestment, summarizePosition } = load("src/lib/investment-engine.ts");
const config = {
  version: 1,
  minInvestment: 500,
  maxInvestment: 10000000,
  minDeposit: 0,
  maxDeposit: 1000000,
  minWithdrawal: 0,
  maxWithdrawal: 1000000,
  calculationInterval: "daily",
  returnMode: "verified_performance",
  plans: PLAN_TIERS.map((tier, index) => ({
    tier,
    days: [3, 7, 14, 21, 30, 60][index],
    profitPct: 12,
    enabled: true,
  })),
};
const base = {
  amount: 1000,
  profit_pct: 12,
  duration_days: 3,
  status: "active",
  created_at: "2026-11-01T00:00:00.000Z",
  matures_at: "2026-11-04T00:00:00.000Z",
  credited_profit: 0,
  performance_status: "pending_verification",
};

test("all six established plans and configurable hourly/daily intervals validate", () => {
  assert.equal(FinancialConfigurationSchema.parse(config).plans.length, 6);
  assert.equal(
    FinancialConfigurationSchema.parse({ ...config, calculationInterval: "hourly" })
      .calculationInterval,
    "hourly",
  );
});
test("limits reject nonfinite, negative, equal max/min and unknown return modes", () => {
  for (const override of [
    { minDeposit: -1 },
    { maxDeposit: Infinity },
    { maxInvestment: 500 },
    { returnMode: "guaranteed" },
    { calculationInterval: "minute" },
  ])
    assert.equal(FinancialConfigurationSchema.safeParse({ ...config, ...override }).success, false);
});
test("plans reject duplicates, invalid duration/rates and missing tiers", () => {
  const variants = [
    config.plans.slice(1),
    config.plans.map(() => config.plans[0]),
    config.plans.map((p, i) => (i ? p : { ...p, days: 0 })),
    config.plans.map((p, i) => (i ? p : { ...p, profitPct: NaN })),
  ];
  for (const plans of variants)
    assert.equal(FinancialConfigurationSchema.safeParse({ ...config, plans }).success, false);
});
test("server amount validation honors each dynamic bound and requires positive amounts", () => {
  for (const kind of ["investment", "deposit", "withdrawal"]) {
    assert.throws(() => validateFinancialAmount(0, config, kind));
    assert.throws(() => validateFinancialAmount(NaN, config, kind));
    assert.throws(() => validateFinancialAmount(Infinity, config, kind));
  }
  assert.throws(() => validateFinancialAmount(499, config, "investment"));
  validateFinancialAmount(500, config, "investment");
  validateFinancialAmount(10000000, config, "investment");
  assert.throws(() => validateFinancialAmount(10000001, config, "investment"));
  validateFinancialAmount(0.0000000001, config, "deposit");
  const changed = { ...config, minWithdrawal: 20, maxWithdrawal: 100 };
  assert.throws(() => validateFinancialAmount(19, changed, "withdrawal"));
  validateFinancialAmount(20, changed, "withdrawal");
});
test("total-term projections are simple, separate principal/profit, never compounded", () => {
  assert.deepEqual(previewInvestment(1000, 12), {
    principal: 1000,
    projectedProfit: 120,
    projectedTotal: 1120,
  });
  assert.deepEqual(previewInvestment(0.1, 10), {
    principal: 0.1,
    projectedProfit: 0.01,
    projectedTotal: 0.11,
  });
  assert.deepEqual(previewInvestment(1000, 0), {
    principal: 1000,
    projectedProfit: 0,
    projectedTotal: 1000,
  });
});
test("daily accrual changes only at complete server-timed intervals", () => {
  assert.equal(summarizePosition(base, "2026-11-01T23:59:59Z").accumulatedProjectedProfit, 0);
  assert.equal(summarizePosition(base, "2026-11-02T00:00:00Z").accumulatedProjectedProfit, 40);
  assert.equal(summarizePosition(base, "2026-11-03T12:00:00Z").accumulatedProjectedProfit, 80);
});
test("hourly accrual uses original snapshot, not newly edited configuration", () => {
  const position = { ...base, calculation_interval: "hourly" };
  const summary = summarizePosition(position, "2026-11-01T06:30:00Z");
  assert.equal(summary.totalIntervals, 72);
  assert.equal(summary.completeIntervals, 6);
  assert.equal(summary.accumulatedProjectedProfit, 10);
  config.plans[0].profitPct = 999;
  assert.equal(summarizePosition(position, "2026-11-01T06:30:00Z").projectedProfit, 120);
});
test("maturity catches up exactly, future start clamps zero and overdue never over-accrues", () => {
  assert.equal(summarizePosition(base, "2026-10-01T00:00:00Z").accumulatedProjectedProfit, 0);
  assert.equal(summarizePosition(base, "2026-11-04T00:00:00Z").accumulatedProjectedProfit, 120);
  assert.equal(summarizePosition(base, "2030-01-01T00:00:00Z").accumulatedProjectedProfit, 120);
});
test("cancellation freezes projections and does not invent credited profit", () => {
  const cancelled = { ...base, status: "cancelled", completed_at: "2026-11-02T01:00:00Z" };
  const result = summarizePosition(cancelled, "2026-12-01T00:00:00Z");
  assert.equal(result.accumulatedProjectedProfit, 40);
  assert.equal(result.actualCreditedProfit, 0);
  assert.equal(result.isProjection, true);
});
test("verified actual amounts remain separate and legacy provenance is explicit", () => {
  const result = summarizePosition(
    { ...base, credited_profit: 23.45, performance_status: "verified" },
    "2026-11-04T00:00:00Z",
  );
  assert.equal(result.actualCreditedProfit, 23.45);
  assert.equal(result.projectedProfit, 120);
  const legacy = { ...base };
  delete legacy.performance_status;
  delete legacy.credited_profit;
  assert.equal(
    summarizePosition(legacy, "2026-11-04T00:00:00Z").performanceStatus,
    "legacy_unverified",
  );
});
test("invalid timestamps and invalid input cannot produce misleading NaN projections", () => {
  assert.throws(() => summarizePosition(base, "not a timestamp"));
  assert.throws(() => summarizePosition({ ...base, matures_at: base.created_at }, base.created_at));
  assert.throws(() => previewInvestment(Infinity, 12));
  assert.throws(() => previewInvestment(-1, 12));
});
