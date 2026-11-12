import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { Header } from "@/components/site/Header";
import { Footer } from "@/components/site/Footer";
import { Ticker } from "@/components/site/Ticker";
import { InvestmentSummary } from "@/components/site/InvestmentSummary";
import { useAuth } from "@/hooks/useAuth";
import { useServerFn } from "@tanstack/react-start";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { listInvestments, cancelInvestment } from "@/lib/investments.functions";
import type { PositionSummary } from "@/lib/investment-engine";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import {
  Loader2,
  TrendingUp,
  Users,
  CheckCircle2,
  XCircle,
  Clock,
  AlertTriangle,
  RefreshCw,
} from "lucide-react";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";

export const Route = createFileRoute("/investments")({
  head: () => ({
    meta: [
      { title: "My Investments — Elite Stocks" },
      { name: "description", content: "Manage investment projections and copy trades." },
    ],
  }),
  component: InvestmentsPage,
});

type Kind = "investment" | "copy_trade";
type SourceRow = {
  id: string;
  amount: number | string;
  profit_pct: number | string;
  duration_days: number;
  status: string;
  created_at: string;
  matures_at: string;
  completed_at?: string | null;
  summary?: PositionSummary | null;
  plan_tier?: string;
  trader?: { name?: string | null } | null;
};

type Row = SourceRow & { kind: Kind; name: string };
type InvestmentListState = { investments: SourceRow[]; copyTrades: SourceRow[] };

function money(value: number | string) {
  return Number(value).toLocaleString(undefined, { maximumFractionDigits: 2 });
}

function dateTime(value: string) {
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? value : date.toLocaleString();
}

function InvestmentsPage() {
  const { user, loading } = useAuth();
  const navigate = useNavigate();
  const qc = useQueryClient();

  useEffect(() => {
    if (!loading && !user) navigate({ to: "/login" });
  }, [user, loading, navigate]);

  const fetchList = useServerFn(listInvestments);
  const cancelFn = useServerFn(cancelInvestment);
  const query = useQuery({
    queryKey: ["investments-list"],
    queryFn: () => fetchList(),
    enabled: !!user,
    refetchInterval: 20000,
  });
  const data = query.data as InvestmentListState | undefined;

  const mutation = useMutation({
    mutationFn: (value: { id: string; kind: Kind }) => cancelFn({ data: value }),
    onSuccess: () => {
      toast.success("Investment cancelled — principal returned to wallet");
      qc.invalidateQueries({ queryKey: ["investments-list"] });
      qc.invalidateQueries({ queryKey: ["wallet-state"] });
      setCancelTarget(null);
    },
    onError: (error: Error) => toast.error(error.message),
  });

  const [cancelTarget, setCancelTarget] = useState<Row | null>(null);
  const [detailRow, setDetailRow] = useState<Row | null>(null);

  if (loading || !user) return <div className="min-h-screen bg-background" />;

  const rows: Row[] = [
    ...(data?.investments ?? []).map((investment) => ({
      ...investment,
      kind: "investment" as Kind,
      name: investment.plan_tier ?? "Investment plan",
    })),
    ...(data?.copyTrades ?? []).map((copy) => ({
      ...copy,
      kind: "copy_trade" as Kind,
      name: `Copy · ${copy.trader?.name ?? "Trader"}`,
    })),
  ].sort((a, b) => +new Date(b.created_at) - +new Date(a.created_at));

  const active = rows.filter((row) => row.status === "active");
  const totalActive = active.reduce(
    (sum, row) => sum + Number(row.summary?.principal ?? row.amount),
    0,
  );
  const projectedTotal = active.every((row) => row.summary)
    ? active.reduce((sum, row) => sum + Number(row.summary?.projectedTotal ?? 0), 0)
    : null;
  const metricsAvailable = !!data && !query.isError;

  return (
    <div className="min-h-screen bg-background">
      <Header />
      <Ticker />
      <div className="mx-auto max-w-[1400px] px-4 py-8 lg:px-6">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <div className="text-xs uppercase tracking-widest text-gold">PORTFOLIO</div>
            <h1 className="mt-2 font-display text-4xl font-bold tracking-tight md:text-5xl">
              My Investments
            </h1>
            <p className="mt-2 max-w-2xl text-sm text-muted-foreground">
              Review server-provided position summaries. Cancel an active position to refund
              principal; projections are not earnings or guarantees.
            </p>
          </div>
        </div>

        <div className="mt-6 grid gap-4 md:grid-cols-3">
          <Stat
            label="Active positions"
            value={metricsAvailable ? String(active.length) : "Unavailable"}
            icon={TrendingUp}
          />
          <Stat
            label="Principal invested"
            value={
              metricsAvailable
                ? `$${totalActive.toLocaleString(undefined, { maximumFractionDigits: 2 })}`
                : "Unavailable"
            }
            icon={Users}
          />
          <Stat
            label="Projected total at maturity"
            value={
              !metricsAvailable || projectedTotal === null
                ? "Unavailable"
                : `$${projectedTotal.toLocaleString(undefined, { maximumFractionDigits: 2 })}`
            }
            icon={CheckCircle2}
          />
        </div>

        {query.isError ? (
          <div className="mt-10 flex flex-wrap items-center justify-between gap-3 rounded-lg border border-amber-500/30 bg-amber-500/5 p-6 text-sm text-muted-foreground">
            <span>
              Portfolio data is temporarily unavailable. No empty state or zero balance is being
              inferred.
            </span>
            <button
              onClick={() => query.refetch()}
              className="inline-flex items-center gap-2 rounded border border-border px-3 py-2 text-xs font-semibold text-foreground"
            >
              <RefreshCw className="h-3.5 w-3.5" /> Retry
            </button>
          </div>
        ) : query.isLoading ? (
          <div className="mt-12 flex items-center justify-center text-sm text-muted-foreground">
            <Loader2 className="mr-2 h-4 w-4 animate-spin" /> Loading…
          </div>
        ) : rows.length === 0 ? (
          <div className="mt-10 rounded-lg border border-border bg-surface p-10 text-center">
            <p className="text-sm text-muted-foreground">You have no investments yet.</p>
            <div className="mt-4 flex justify-center gap-3">
              <Link
                to="/strategies"
                className="rounded-md bg-gold px-4 py-2 text-xs font-semibold text-primary-foreground"
              >
                Browse Plans
              </Link>
              <Link
                to="/copy-trading"
                className="rounded-md border border-border bg-surface px-4 py-2 text-xs font-semibold"
              >
                Copy a Trader
              </Link>
            </div>
          </div>
        ) : (
          <div className="mt-8 overflow-x-auto rounded-xl border border-border">
            <table className="w-full text-sm">
              <thead className="bg-surface text-[11px] uppercase tracking-wider text-muted-foreground">
                <tr>
                  <th className="px-4 py-3 text-left">Position</th>
                  <th className="px-4 py-3 text-left">Type</th>
                  <th className="px-4 py-3 text-right">Principal</th>
                  <th className="px-4 py-3 text-right">Projected total</th>
                  <th className="px-4 py-3 text-left">Started</th>
                  <th className="px-4 py-3 text-left">Matures</th>
                  <th className="px-4 py-3 text-left">Status</th>
                  <th className="px-4 py-3 text-right">Action</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((row) => (
                  <tr
                    key={`${row.kind}-${row.id}`}
                    className="cursor-pointer border-t border-border bg-background transition-colors hover:bg-surface/60"
                    onClick={() => setDetailRow(row)}
                  >
                    <td className="px-4 py-3 font-semibold">{row.name}</td>
                    <td className="px-4 py-3 text-xs text-muted-foreground">
                      {row.kind === "investment" ? "Plan" : "Copy Trade"}
                    </td>
                    <td className="px-4 py-3 text-right font-mono">
                      {money(row.summary?.principal ?? row.amount)} USDT
                    </td>
                    <td className="px-4 py-3 text-right font-mono text-gold">
                      {row.summary ? `${money(row.summary.projectedTotal)} USDT` : "Unavailable"}
                    </td>
                    <td className="px-4 py-3 text-xs text-muted-foreground">
                      {dateTime(row.created_at)}
                    </td>
                    <td className="px-4 py-3 text-xs text-muted-foreground">
                      {dateTime(row.summary?.maturityDate ?? row.matures_at)}
                    </td>
                    <td className="px-4 py-3">
                      <StatusBadge status={row.status} />
                    </td>
                    <td
                      className="px-4 py-3 text-right"
                      onClick={(event) => event.stopPropagation()}
                    >
                      {row.status === "active" ? (
                        <button
                          onClick={() => setCancelTarget(row)}
                          className="rounded-md border border-border bg-surface px-3 py-1.5 text-xs font-semibold text-muted-foreground hover:border-bear hover:text-bear"
                        >
                          Cancel
                        </button>
                      ) : (
                        <span className="text-xs text-muted-foreground">—</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <Sheet open={!!detailRow} onOpenChange={(open) => !open && setDetailRow(null)}>
        <SheetContent className="w-full overflow-y-auto bg-background sm:max-w-md">
          {detailRow && (
            <>
              <SheetHeader>
                <div className="text-[11px] uppercase tracking-widest text-gold">
                  {detailRow.kind === "investment" ? "Investment Plan" : "Copy Trade"}
                </div>
                <SheetTitle className="font-display text-2xl">{detailRow.name}</SheetTitle>
                <SheetDescription>
                  Position opened {dateTime(detailRow.created_at)}
                </SheetDescription>
              </SheetHeader>
              <div className="mt-6 space-y-4">
                <div className="rounded-lg border border-border bg-surface p-4">
                  <div className="flex items-center justify-between">
                    <span className="text-[11px] uppercase tracking-wider text-muted-foreground">
                      Current status
                    </span>
                    <StatusBadge status={detailRow.status} />
                  </div>
                </div>
                <DetailRow label="Plan / trader" value={detailRow.name} />
                <DetailRow label="Duration" value={`${detailRow.duration_days} days`} />
                <DetailRow label="Start date" value={dateTime(detailRow.created_at)} />
                <InvestmentSummary summary={detailRow.summary} />
                {detailRow.completed_at && (
                  <DetailRow label="Completed" value={dateTime(detailRow.completed_at)} />
                )}
              </div>
              {detailRow.status === "active" && (
                <div className="mt-6 border-t border-border pt-4">
                  <button
                    onClick={() => {
                      setCancelTarget(detailRow);
                      setDetailRow(null);
                    }}
                    className="w-full rounded-md border border-border bg-surface px-4 py-2.5 text-sm font-semibold text-muted-foreground transition-colors hover:border-bear hover:text-bear"
                  >
                    Cancel this position
                  </button>
                </div>
              )}
            </>
          )}
        </SheetContent>
      </Sheet>

      <AlertDialog
        open={!!cancelTarget}
        onOpenChange={(open) => !open && !mutation.isPending && setCancelTarget(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-bear/15 sm:mx-0">
              <AlertTriangle className="h-6 w-6 text-bear" />
            </div>
            <AlertDialogTitle>Cancel this position?</AlertDialogTitle>
            <AlertDialogDescription asChild>
              <div className="space-y-3 text-sm">
                <p>
                  You are about to cancel{" "}
                  <span className="font-semibold text-foreground">{cancelTarget?.name}</span>. The
                  backend cancellation workflow refunds principal and forfeits any projection.
                </p>
                {cancelTarget && (
                  <div className="rounded-lg border border-border bg-surface p-3 text-xs">
                    <Line label="Principal refunded to wallet">
                      <span className="font-mono text-bull">
                        +{money(cancelTarget.summary?.principal ?? cancelTarget.amount)} USDT
                      </span>
                    </Line>
                    <Line label="Projected profit forfeited">
                      <span className="font-mono text-muted-foreground">
                        {cancelTarget.summary
                          ? `−${money(cancelTarget.summary.projectedProfit)} USDT`
                          : "Unavailable"}
                      </span>
                    </Line>
                    <Line label="New status">
                      <span className="font-semibold">Cancelled</span>
                    </Line>
                  </div>
                )}
                <p className="text-muted-foreground">
                  No projected or unverified profit will be credited by cancellation. This action
                  cannot be undone.
                </p>
              </div>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={mutation.isPending}>Keep position</AlertDialogCancel>
            <AlertDialogAction
              disabled={mutation.isPending}
              onClick={(event) => {
                event.preventDefault();
                if (cancelTarget) mutation.mutate({ id: cancelTarget.id, kind: cancelTarget.kind });
              }}
              className="bg-bear text-white hover:bg-bear/90"
            >
              {mutation.isPending ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" /> Cancelling…
                </>
              ) : (
                "Confirm cancellation"
              )}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
      <Footer />
    </div>
  );
}

function DetailRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between border-b border-border/60 pb-2">
      <span className="text-xs uppercase tracking-wider text-muted-foreground">{label}</span>
      <span className="font-mono text-sm text-foreground">{value}</span>
    </div>
  );
}
function Line({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between py-1">
      <span className="text-muted-foreground">{label}</span>
      {children}
    </div>
  );
}
function Stat({
  label,
  value,
  icon: Icon,
}: {
  label: string;
  value: string;
  icon: React.ComponentType<{ className?: string }>;
}) {
  return (
    <div className="panel p-5">
      <div className="flex items-center justify-between">
        <div className="text-[11px] uppercase tracking-wider text-muted-foreground">{label}</div>
        <Icon className="h-4 w-4 text-gold" />
      </div>
      <div className="mt-2 font-display text-3xl font-bold text-gold gold-text-glow">{value}</div>
    </div>
  );
}
function StatusBadge({ status }: { status: string }) {
  if (status === "active")
    return (
      <span className="inline-flex items-center gap-1.5 rounded bg-amber-500/15 px-2 py-1 text-xs text-amber-400">
        <Clock className="h-3 w-3" /> Active
      </span>
    );
  if (status === "matured")
    return (
      <span className="inline-flex items-center gap-1.5 rounded bg-bull/15 px-2 py-1 text-xs text-bull">
        <CheckCircle2 className="h-3 w-3" /> Matured
      </span>
    );
  if (status === "cancelled")
    return (
      <span className="inline-flex items-center gap-1.5 rounded bg-bear/15 px-2 py-1 text-xs text-bear">
        <XCircle className="h-3 w-3" /> Cancelled
      </span>
    );
  return <span className="rounded bg-surface px-2 py-1 text-xs capitalize">{status}</span>;
}
