import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import { createRequire } from "node:module";
import ts from "typescript";
const require = createRequire(import.meta.url);
function load(file) {
  const source = ts.transpileModule(fs.readFileSync(file, "utf8"), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
    fileName: file,
  }).outputText;
  const module = { exports: {} };
  new Function("require", "module", "exports", source)(require, module, module.exports);
  return module.exports;
}
const { parseFinancialAmount, FinancialAmountSchema, FinancialProfitSchema } = load(
  "src/lib/financial-amount.ts",
);
const { describeReturnTransaction } = load("src/lib/return-details.ts");
test("large ten-decimal text survives the financial server boundary exactly", () => {
  const text = "9999999999.1234567890";
  assert.equal(parseFinancialAmount(text), "9999999999.123456789");
  assert.equal(FinancialAmountSchema.parse(text), "9999999999.123456789");
  assert.notEqual(String(Number(text)), FinancialAmountSchema.parse(text));
});
test("decimal amount schema handles bounds and normalizes zeros without rounding", () => {
  assert.equal(parseFinancialAmount(" 000010.0012300000 "), "10.00123");
  assert.equal(parseFinancialAmount("0.0000000001"), "0.0000000001");
  assert.equal(parseFinancialAmount("10000000000.0000000000"), "10000000000");
  for (const input of [
    "10000000000.0000000001",
    "0.00000000001",
    "1e-10",
    "NaN",
    "Infinity",
    "-1",
    "",
    "0",
  ])
    assert.throws(() => parseFinancialAmount(input));
});
test("legacy numeric callers remain compatible for exactly representable API inputs", () => {
  assert.equal(FinancialAmountSchema.parse(0.1), "0.1");
  assert.equal(FinancialAmountSchema.parse(1e-10), "0.0000000001");
  assert.equal(FinancialProfitSchema.parse(0), "0");
  assert.throws(() => FinancialAmountSchema.parse(1e-11));
});
test("ledger describes actual profit using the real evidence and contract keys", () => {
  const result = describeReturnTransaction({
    type: "return",
    amount: "25.12",
    asset: "USDT",
    metadata: {
      event: "verified_performance",
      evidence_ref: "trade:123",
      contract_ref: "contract:456",
      performance_id: "record:789",
    },
  });
  assert.match(result, /Actual profit credited: 25.12 USDT/);
  assert.match(result, /trade:123/);
  assert.match(result, /contract:456/);
  assert.match(result, /record:789/);
});
test("principal and historical return annotations never imply a fabricated profit", () => {
  const principal = describeReturnTransaction({
    type: "return",
    amount: 1000,
    asset: "USDT",
    metadata: { principal_released: true },
  });
  assert.match(principal, /Principal released/);
  assert.match(principal, /No unverified projected profit was credited/);
  const historical = describeReturnTransaction({
    type: "return",
    amount: 135,
    asset: "USDT",
    metadata: { legacy: true },
  });
  assert.match(historical, /verification is unavailable/);
  assert.equal(describeReturnTransaction({ type: "deposit", amount: 10, asset: "USDT" }), null);
});
