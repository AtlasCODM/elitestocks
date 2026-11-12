import type { CalculationInterval } from "./financial-config";

export type PositionTerms = {
  amount: number | string;
  profit_pct: number | string;
  duration_days: number;
  created_at: string;
  matures_at: string;
  completed_at?: string | null;
  status: string;
  calculation_interval?: CalculationInterval | null;
  credited_profit?: number | string | null;
  performance_status?: string | null;
};

const SCALE = 10_000_000_000n;
function scaled(value: number | string): bigint {
  // Display projections only. PostgreSQL numeric remains authoritative for all ledger changes.
  const number = Number(value);
  if (!Number.isFinite(number) || number < 0 || number > 10_000_000_000_000)
    throw new Error("Invalid projection amount");
  const [whole, fraction = ""] = number.toFixed(10).split(".");
  return BigInt(whole) * SCALE + BigInt(fraction.padEnd(10, "0"));
}
function display(value: bigint) {
  return Number(value) / Number(SCALE);
}

/** Simple total-term percentage, not an hourly/daily or compounded interest rate. */
export function previewInvestment(principal: number, profitPct: number) {
  const amount = scaled(principal);
  const profit = (amount * scaled(profitPct)) / (100n * SCALE);
  return {
    principal: display(amount),
    projectedProfit: display(profit),
    projectedTotal: display(amount + profit),
  };
}

/** Snapshotted position terms + server time only; never current editable plan terms. */
export function summarizePosition(position: PositionTerms, serverNow: string) {
  const start = Date.parse(position.created_at);
  const maturity = Date.parse(position.matures_at);
  const now = Date.parse(serverNow);
  if (![start, maturity, now].every(Number.isFinite) || maturity <= start)
    throw new Error("Invalid position timestamps");
  const interval = position.calculation_interval ?? "daily";
  const intervalMs = interval === "hourly" ? 3_600_000 : 86_400_000;
  let until = now;
  if (position.status === "cancelled")
    until = position.completed_at ? Math.min(now, Date.parse(position.completed_at)) : start;
  const elapsed = Math.max(0, Math.min(maturity - start, until - start));
  const totalIntervals = Math.ceil((maturity - start) / intervalMs);
  const completeIntervals =
    elapsed >= maturity - start ? totalIntervals : Math.floor(elapsed / intervalMs);
  const amount = scaled(position.amount);
  const profit = (amount * scaled(position.profit_pct)) / (100n * SCALE);
  const accumulated = (profit * BigInt(completeIntervals)) / BigInt(totalIntervals);
  return {
    principal: display(amount),
    projectedProfit: display(profit),
    projectedTotal: display(amount + profit),
    accumulatedProjectedProfit: display(accumulated),
    actualCreditedProfit: Number(position.credited_profit ?? 0),
    calculationInterval: interval,
    completeIntervals,
    totalIntervals,
    maturityDate: position.matures_at,
    serverNow,
    performanceStatus: position.performance_status ?? "legacy_unverified",
    isProjection: true as const,
  };
}
export type PositionSummary = ReturnType<typeof summarizePosition>;
