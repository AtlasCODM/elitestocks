import type { PositionSummary } from "@/lib/investment-engine";

export type InvestmentSummaryData = PositionSummary;

type Props = {
  summary?: InvestmentSummaryData | null;
  compact?: boolean;
};

function amount(value: number | string | null | undefined) {
  const n = Number(value);
  return Number.isFinite(n)
    ? n.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 6 })
    : "—";
}

function dateTime(value: string | null | undefined) {
  if (!value) return "—";
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? value : date.toLocaleString();
}

function isVerifiedPerformance(status: string | null | undefined) {
  const normalized = (status ?? "").toLowerCase();
  return normalized === "profit_credited" || normalized === "verified";
}

export function InvestmentSummary({ summary, compact = false }: Props) {
  if (!summary) {
    return (
      <div className="rounded-lg border border-border bg-surface p-4 text-xs text-muted-foreground">
        Projection details are temporarily unavailable. Refresh to try again.
      </div>
    );
  }

  const verified = isVerifiedPerformance(summary.performanceStatus);
  const values = [
    ["Principal", amount(summary.principal)],
    ["Projected profit", `+${amount(summary.projectedProfit)}`],
    ["Projected total", amount(summary.projectedTotal)],
    ["Accumulated projected profit", `+${amount(summary.accumulatedProjectedProfit)}`],
    [
      "Actual credited profit",
      verified
        ? `+${amount(summary.actualCreditedProfit)}`
        : summary.performanceStatus === "pending_verification"
          ? `${amount(summary.actualCreditedProfit)} · awaiting verification`
          : "Unknown · unverified",
    ],
    ["Maturity", dateTime(summary.maturityDate)],
  ] as const;

  return (
    <div className="space-y-3 rounded-lg border border-border bg-surface p-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="text-[11px] uppercase tracking-wider text-muted-foreground">
          Position summary
        </div>
        <span className="rounded bg-gold/10 px-2 py-1 text-[10px] uppercase tracking-wider text-gold">
          Projection · {summary.calculationInterval}
        </span>
      </div>
      <div className={`grid gap-x-4 gap-y-3 ${compact ? "grid-cols-2" : "sm:grid-cols-2"}`}>
        {values.map(([label, value]) => (
          <div key={label}>
            <div className="text-[10px] uppercase tracking-wider text-muted-foreground">
              {label}
            </div>
            <div
              className={`mt-1 font-mono text-sm ${
                label === "Projected total" || label === "Projected profit"
                  ? "text-gold"
                  : "text-foreground"
              }`}
            >
              {value}
            </div>
          </div>
        ))}
      </div>
      <div className="border-t border-border/60 pt-3 text-[11px] leading-relaxed text-muted-foreground">
        Projected values are simple total-term estimates, not earnings or a guarantee. Actual profit
        is shown only when backed by verified performance evidence; legacy figures remain
        unknown/unverified.
      </div>
    </div>
  );
}
