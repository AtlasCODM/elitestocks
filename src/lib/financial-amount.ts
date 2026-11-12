import { z } from "zod";

/** Preserve text all the way to PostgreSQL numeric(30,10); never round a user's amount. */
export function parseFinancialAmount(input: string | number, allowZero = false): string {
  let text = typeof input === "string" ? input.trim() : String(input);
  // Number callers are retained for existing API compatibility. New financial forms always send
  // decimal strings. Expand small scientific notation without converting string input to Number.
  if (typeof input === "number") {
    if (!Number.isFinite(input)) throw new Error("Enter a finite financial amount");
    const exponential = /^([0-9]+)(?:\.([0-9]+))?e-([0-9]+)$/i.exec(text);
    if (exponential) {
      const digits = exponential[1] + (exponential[2] ?? "");
      const zeros = Number(exponential[3]) - exponential[1].length;
      text =
        zeros >= 0
          ? `0.${"0".repeat(zeros)}${digits}`
          : `${digits.slice(0, -zeros)}.${digits.slice(-zeros)}`;
    }
  }
  if (!/^[0-9]+(?:\.[0-9]{1,10})?$/.test(text)) {
    throw new Error("Enter a decimal amount with no more than 10 decimal places");
  }
  const [whole, fraction = ""] = text.split(".");
  const scaled = BigInt(whole) * 10_000_000_000n + BigInt(fraction.padEnd(10, "0"));
  if (scaled < 0n || (!allowZero && scaled === 0n)) throw new Error("Amount must be positive");
  if (scaled > 10_000_000_000n * 10_000_000_000n)
    throw new Error("Amount exceeds the supported financial range");
  const normalizedWhole = BigInt(whole).toString();
  const normalizedFraction = fraction.replace(/0+$/, "");
  return normalizedFraction ? `${normalizedWhole}.${normalizedFraction}` : normalizedWhole;
}

export const FinancialAmountSchema = z
  .union([z.string(), z.number().finite()])
  .transform((input, ctx) => {
    try {
      return parseFinancialAmount(input);
    } catch (error) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: error instanceof Error ? error.message : "Invalid financial amount",
      });
      return z.NEVER;
    }
  });

export const FinancialProfitSchema = z
  .union([z.string(), z.number().finite()])
  .transform((input, ctx) => {
    try {
      return parseFinancialAmount(input, true);
    } catch (error) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: error instanceof Error ? error.message : "Invalid financial profit",
      });
      return z.NEVER;
    }
  });
