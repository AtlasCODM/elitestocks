import { z } from "zod";

export const PLAN_TIERS = [
  "Starter 3D",
  "Growth 7D",
  "Boost 14D",
  "Pro 21D",
  "Elite 30D",
  "Apex 60D",
] as const;

const limit = z.number().finite().nonnegative().max(10_000_000_000);
export const FinancialConfigurationSchema = z
  .object({
    version: z.number().int().nonnegative(),
    minInvestment: limit,
    maxInvestment: limit.positive(),
    minDeposit: limit,
    maxDeposit: limit.positive(),
    minWithdrawal: limit,
    maxWithdrawal: limit.positive(),
    calculationInterval: z.enum(["hourly", "daily"]),
    returnMode: z.literal("verified_performance"),
    plans: z
      .array(
        z.object({
          tier: z.enum(PLAN_TIERS),
          days: z.number().int().min(1).max(3650),
          profitPct: z.number().finite().min(0).max(1000),
          enabled: z.boolean(),
        }),
      )
      .length(6),
  })
  .superRefine((config, ctx) => {
    for (const [min, max] of [
      ["minInvestment", "maxInvestment"],
      ["minDeposit", "maxDeposit"],
      ["minWithdrawal", "maxWithdrawal"],
    ] as const) {
      if (config[max] <= config[min])
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: [max],
          message: "Maximum must exceed minimum",
        });
    }
    if (new Set(config.plans.map((plan) => plan.tier)).size !== PLAN_TIERS.length) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["plans"],
        message: "Each established plan must appear exactly once",
      });
    }
  });

export type FinancialConfiguration = z.infer<typeof FinancialConfigurationSchema>;
export type InvestmentPlan = FinancialConfiguration["plans"][number];
export type CalculationInterval = FinancialConfiguration["calculationInterval"];

export function validateFinancialAmount(
  amount: number,
  config: FinancialConfiguration,
  kind: "investment" | "deposit" | "withdrawal",
) {
  const [min, max] =
    kind === "investment"
      ? [config.minInvestment, config.maxInvestment]
      : kind === "deposit"
        ? [config.minDeposit, config.maxDeposit]
        : [config.minWithdrawal, config.maxWithdrawal];
  if (!Number.isFinite(amount) || amount <= 0 || amount < min || amount > max) {
    throw new Error(
      `${kind[0].toUpperCase()}${kind.slice(1)} must be positive and between ${min} and ${max}`,
    );
  }
}
