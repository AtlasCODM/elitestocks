import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { Header } from "@/components/site/Header";
import { Footer } from "@/components/site/Footer";
import { useAuth } from "@/hooks/useAuth";
import { useServerFn } from "@tanstack/react-start";
import { useQuery } from "@tanstack/react-query";
import { getWalletState } from "@/lib/wallet.functions";
import { useEffect } from "react";
import { describeReturnTransaction } from "@/lib/return-details";
import { CheckCircle2, Clock, Loader2, RefreshCw } from "lucide-react";

export const Route = createFileRoute("/history")({
  head: () => ({
    meta: [
      { title: "Transaction History — Elite Stocks" },
      { name: "description", content: "View actual ledger entries and return evidence metadata." },
    ],
  }),
  component: HistoryPage,
});

type ReturnMetadata = {
  principal?: number | string | boolean | null;
  principal_refunded?: number | string | boolean | null;
  profit?: number | string | null;
  profit_credited?: number | string | null;
  principal_released?: boolean;
  performance_id?: string | null;
  evidence_ref?: string | null;
  contract_ref?: string | null;
  evidence?: string | null;
  basis?: string | null;
  event?: string | null;
};

type TxRow = {
  id: string;
  type: string;
  asset: string;
  amount: number | string;
  status: string;
  created_at: string;
  metadata?: ReturnMetadata | null;
};

type WalletState = { transactions: TxRow[] };

function money(value: number | string) {
  return Number(value).toLocaleString(undefined, { maximumFractionDigits: 6 });
}

function dateTime(value: string) {
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? value : date.toLocaleString();
}

function isReturn(type: string) {
  return type === "return" || type === "copy_return";
}

function HistoryPage() {
  const { user, loading } = useAuth();
  const navigate = useNavigate();
  const fetchState = useServerFn(getWalletState);
  const query = useQuery({
    queryKey: ["wallet-state"],
    queryFn: () => fetchState(),
    enabled: !!user,
    refetchInterval: 15000,
  });

  useEffect(() => {
    if (!loading && !user) navigate({ to: "/login" });
  }, [user, loading, navigate]);

  if (loading || !user) return <div className="min-h-screen bg-background" />;
  const data = query.data as WalletState | undefined;
  const transactions = data?.transactions ?? [];

  return (
    <div className="min-h-screen bg-background">
      <Header />
      <div className="mx-auto max-w-[1400px] px-4 py-8 lg:px-6">
        <h1 className="font-display text-4xl font-bold tracking-tight">Transaction History</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Actual ledger entries only. Projections and accrued estimates are not ledger earnings.
        </p>

        {query.isError ? (
          <div className="mt-8 flex flex-wrap items-center justify-between gap-3 rounded-lg border border-amber-500/30 bg-amber-500/5 p-6 text-sm text-muted-foreground">
            <span>Ledger data is temporarily unavailable; no empty history is being inferred.</span>
            <button
              onClick={() => query.refetch()}
              className="inline-flex items-center gap-2 rounded border border-border px-3 py-2 text-xs font-semibold text-foreground"
            >
              <RefreshCw className="h-3.5 w-3.5" /> Retry
            </button>
          </div>
        ) : (
          <div className="mt-8 overflow-x-auto rounded-lg border border-border">
            <table className="w-full text-sm">
              <thead className="bg-surface text-[11px] uppercase tracking-wider text-muted-foreground">
                <tr>
                  <th className="px-4 py-3 text-left">Time</th>
                  <th className="px-4 py-3 text-left">Type</th>
                  <th className="px-4 py-3 text-left">Asset</th>
                  <th className="px-4 py-3 text-right">Amount</th>
                  <th className="px-4 py-3 text-left">Status</th>
                  <th className="px-4 py-3 text-left">Reference</th>
                </tr>
              </thead>
              <tbody>
                {query.isLoading && (
                  <tr>
                    <td
                      colSpan={6}
                      className="px-4 py-12 text-center text-sm text-muted-foreground"
                    >
                      <Loader2 className="mr-2 inline h-4 w-4 animate-spin" /> Loading…
                    </td>
                  </tr>
                )}
                {!query.isLoading && transactions.length === 0 && (
                  <tr>
                    <td
                      colSpan={6}
                      className="px-4 py-12 text-center text-sm text-muted-foreground"
                    >
                      No ledger entries yet.
                    </td>
                  </tr>
                )}
                {transactions.map((transaction) => (
                  <TransactionRows key={transaction.id} transaction={transaction} />
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
      <Footer />
    </div>
  );
}

function TransactionRows({ transaction }: { transaction: TxRow }) {
  const returnEntry = isReturn(transaction.type);
  const description = describeReturnTransaction(transaction);
  return (
    <>
      <tr className="border-t border-border bg-background">
        <td className="px-4 py-3 font-mono text-xs text-muted-foreground">
          {dateTime(transaction.created_at)}
        </td>
        <td className="px-4 py-3">
          <span className="rounded bg-gold/15 px-2 py-0.5 text-xs font-semibold capitalize text-gold">
            {transaction.type.replaceAll("_", " ")}
          </span>
        </td>
        <td className="px-4 py-3 font-semibold">{transaction.asset}</td>
        <td className="px-4 py-3 text-right font-mono">{money(transaction.amount)}</td>
        <td className="px-4 py-3">
          <StatusBadge status={transaction.status} />
        </td>
        <td className="px-4 py-3 font-mono text-xs text-muted-foreground">
          {transaction.id.slice(0, 12)}…
        </td>
      </tr>
      {returnEntry && (
        <tr className="border-t border-border/50 bg-surface/40">
          <td colSpan={6} className="px-4 py-3 text-xs text-muted-foreground">
            {description}
          </td>
        </tr>
      )}
    </>
  );
}

function StatusBadge({ status }: { status: string }) {
  const success = ["successful", "confirmed", "completed", "matured"].includes(status);
  const pending = ["pending", "pending_confirmation", "verifying", "processing", "active"].includes(
    status,
  );
  if (success)
    return (
      <span className="inline-flex items-center gap-1.5 rounded bg-bull/15 px-2 py-1 text-xs text-bull">
        <CheckCircle2 className="h-3 w-3" /> {status.replaceAll("_", " ")}
      </span>
    );
  if (pending)
    return (
      <span className="inline-flex items-center gap-1.5 rounded bg-amber-500/15 px-2 py-1 text-xs text-amber-400">
        {status === "processing" ? (
          <Loader2 className="h-3 w-3 animate-spin" />
        ) : (
          <Clock className="h-3 w-3" />
        )}{" "}
        {status.replaceAll("_", " ")}
      </span>
    );
  return (
    <span className="inline-flex items-center gap-1.5 rounded bg-bear/15 px-2 py-1 text-xs text-bear">
      {status}
    </span>
  );
}
