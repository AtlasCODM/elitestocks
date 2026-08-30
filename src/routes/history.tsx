import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { Header } from "@/components/site/Header";
import { Footer } from "@/components/site/Footer";
import { useAuth } from "@/hooks/useAuth";
import { useServerFn } from "@tanstack/react-start";
import { useQuery } from "@tanstack/react-query";
import { getWalletState } from "@/lib/wallet.functions";
import { useEffect } from "react";
import { CheckCircle2, Clock, Loader2 } from "lucide-react";

export const Route = createFileRoute("/history")({
  head: () => ({
    meta: [
      { title: "Transaction History — Elite Stocks" },
      { name: "description", content: "View all your deposits, withdrawals, investments, and returns." },
    ],
  }),
  component: HistoryPage,
});

function HistoryPage() {
  const { user, loading } = useAuth();
  const navigate = useNavigate();
  const fetchState = useServerFn(getWalletState);
  const { data, isLoading } = useQuery({
    queryKey: ["wallet-state"],
    queryFn: () => fetchState(),
    enabled: !!user,
    refetchInterval: 15000,
  });

  useEffect(() => {
    if (!loading && !user) navigate({ to: "/login" });
  }, [user, loading, navigate]);

  if (loading || !user) return <div className="min-h-screen bg-background" />;

  const transactions = data?.transactions ?? [];

  return (
    <div className="min-h-screen bg-background">
      <Header />
      <div className="mx-auto max-w-[1400px] px-4 py-8 lg:px-6">
        <h1 className="font-display text-4xl font-bold tracking-tight">Transaction History</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Full ledger of deposits, withdrawals, investments, and returns.
        </p>

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
              {isLoading && (
                <tr><td colSpan={6} className="px-4 py-12 text-center text-sm text-muted-foreground">
                  <Loader2 className="mr-2 inline h-4 w-4 animate-spin" /> Loading…
                </td></tr>
              )}
              {!isLoading && transactions.length === 0 && (
                <tr><td colSpan={6} className="px-4 py-12 text-center text-sm text-muted-foreground">
                  No transactions yet.
                </td></tr>
              )}
              {transactions.map((t) => (
                <tr key={t.id} className="border-t border-border bg-background">
                  <td className="px-4 py-3 font-mono text-xs text-muted-foreground">
                    {new Date(t.created_at).toLocaleString()}
                  </td>
                  <td className="px-4 py-3">
                    <span className="rounded bg-gold/15 px-2 py-0.5 text-xs font-semibold capitalize text-gold">
                      {t.type.replace("_", " ")}
                    </span>
                  </td>
                  <td className="px-4 py-3 font-semibold">{t.asset}</td>
                  <td className="px-4 py-3 text-right font-mono">
                    {Number(t.amount).toLocaleString(undefined, { maximumFractionDigits: 6 })}
                  </td>
                  <td className="px-4 py-3"><StatusBadge status={t.status} /></td>
                  <td className="px-4 py-3 font-mono text-xs text-muted-foreground">{t.id.slice(0, 12)}…</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
      <Footer />
    </div>
  );
}

function StatusBadge({ status }: { status: string }) {
  const success = ["successful", "confirmed", "completed", "matured"].includes(status);
  const pending = ["pending", "pending_confirmation", "verifying", "processing", "active"].includes(status);
  if (success) return (
    <span className="inline-flex items-center gap-1.5 rounded bg-bull/15 px-2 py-1 text-xs text-bull">
      <CheckCircle2 className="h-3 w-3" /> {status.replace("_", " ")}
    </span>
  );
  if (pending) return (
    <span className="inline-flex items-center gap-1.5 rounded bg-amber-500/15 px-2 py-1 text-xs text-amber-400">
      {status === "processing" ? <Loader2 className="h-3 w-3 animate-spin" /> : <Clock className="h-3 w-3" />}
      {status.replace("_", " ")}
    </span>
  );
  return (
    <span className="inline-flex items-center gap-1.5 rounded bg-bear/15 px-2 py-1 text-xs text-bear">
      {status}
    </span>
  );
}
