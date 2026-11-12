export type ReturnTransaction = {
  type: string;
  amount: number | string;
  asset: string;
  metadata?: unknown;
};

export function describeReturnTransaction(transaction: ReturnTransaction) {
  if (!["return", "copy_return"].includes(transaction.type)) return null;
  const metadata =
    transaction.metadata &&
    typeof transaction.metadata === "object" &&
    !Array.isArray(transaction.metadata)
      ? (transaction.metadata as Record<string, unknown>)
      : {};
  const amount = `${Number(transaction.amount).toLocaleString(undefined, { maximumFractionDigits: 10 })} ${transaction.asset}`;
  if (metadata.event === "verified_performance") {
    return `Actual profit credited: ${amount}. Evidence: ${String(metadata.evidence_ref ?? "not provided")}. Contract: ${String(metadata.contract_ref ?? "not provided")}. Performance record: ${String(metadata.performance_id ?? "not provided")}.`;
  }
  if (metadata.principal_refunded === true || metadata.event === "cancellation") {
    return `Principal refunded: ${amount}. No projected profit was credited by this cancellation.`;
  }
  if (metadata.principal_released === true) {
    return `Principal released: ${amount}. ${metadata.performance_id ? "Verified profit, if any, is recorded as a separate actual-profit ledger entry." : "No unverified projected profit was credited; performance verification is pending."}`;
  }
  return `Historical return entry: ${amount}. Performance evidence was not recorded by the previous engine; verification is unavailable. The original ledger entry is unchanged.`;
}
