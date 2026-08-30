import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { Header } from "@/components/site/Header";
import { Footer } from "@/components/site/Footer";
import { Ticker } from "@/components/site/Ticker";
import { useAuth } from "@/hooks/useAuth";
import { useServerFn } from "@tanstack/react-start";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { listInvestments, cancelInvestment } from "@/lib/investments.functions";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Loader2, TrendingUp, Users, CheckCircle2, XCircle, Clock, AlertTriangle } from "lucide-react";
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
      { name: "description", content: "Manage your active investment plans and copy trades." },
    ],
  }),
  component: InvestmentsPage,
});

type Kind = "investment" | "copy_trade";
type Row = {
  id: string;
  kind: Kind;
  name: string;
  amount: number;
  profit_pct: number;
  duration_days: number;
  status: string;
  created_at: string;
  matures_at: string;
  completed_at: string | null;
};

function InvestmentsPage() {
  const { user, loading } = useAuth();
  const navigate = useNavigate();
  const qc = useQueryClient();

  useEffect(() => {
    if (!loading && !user) navigate({ to: "/login" });
  }, [user, loading, navigate]);

  const fetchList = useServerFn(listInvestments);
  const cancelFn = useServerFn(cancelInvestment);

  const { data, isLoading } = useQuery({
    queryKey: ["investments-list"],
    queryFn: () => fetchList(),
    enabled: !!user,
    refetchInterval: 20000,
  });

  const m = useMutation({
    mutationFn: (v: { id: string; kind: Kind }) => cancelFn({ data: v }),
    onSuccess: () => {
      toast.success("Investment cancelled — principal returned to wallet");
      qc.invalidateQueries({ queryKey: ["investments-list"] });
      qc.invalidateQueries({ queryKey: ["wallet-state"] });
      setCancelTarget(null);
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const [cancelTarget, setCancelTarget] = useState<Row | null>(null);
  const [detailRow, setDetailRow] = useState<Row | null>(null);

  if (loading || !user) return <div className="min-h-screen bg-background" />;

  const rows: Row[] = [
    ...(data?.investments ?? []).map((i) => ({
      id: i.id,
      kind: "investment" as Kind,
      name: i.plan_tier,
      amount: Number(i.amount),
      profit_pct: Number(i.profit_pct),
      duration_days: i.duration_days,
      status: i.status,
      created_at: i.created_at,
      matures_at: i.matures_at,
      completed_at: i.completed_at,
    })),
    ...(data?.copyTrades ?? []).map((c) => ({
      id: c.id,
      kind: "copy_trade" as Kind,
      name: `Copy · ${c.trader?.name ?? "Trader"}`,
      amount: Number(c.amount),
      profit_pct: Number(c.profit_pct),
      duration_days: c.duration_days,
      status: c.status,
      created_at: c.created_at,
      matures_at: c.matures_at,
      completed_at: c.completed_at,
    })),
  ].sort((a, b) => +new Date(b.created_at) - +new Date(a.created_at));

  const active = rows.filter((r) => r.status === "active");
  const totalActive = active.reduce((s, r) => s + r.amount, 0);
  const expectedReturn = active.reduce(
    (s, r) => s + r.amount * (1 + r.profit_pct / 100),
    0,
  );

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
              All active investment plans and copy trades. Tap any row to view details, or cancel an active position to refund the principal to your wallet.
            </p>
          </div>
        </div>

        <div className="mt-6 grid gap-4 md:grid-cols-3">
          <Stat label="Active positions" value={String(active.length)} icon={TrendingUp} />
          <Stat
            label="Capital invested"
            value={`$${totalActive.toLocaleString(undefined, { maximumFractionDigits: 2 })}`}
            icon={Users}
          />
          <Stat
            label="Expected at maturity"
            value={`$${expectedReturn.toLocaleString(undefined, { maximumFractionDigits: 2 })}`}
            icon={CheckCircle2}
          />
        </div>

        {isLoading ? (
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
                  <th className="px-4 py-3 text-right">Amount</th>
                  <th className="px-4 py-3 text-right">Return</th>
                  <th className="px-4 py-3 text-left">Started</th>
                  <th className="px-4 py-3 text-left">Matures</th>
                  <th className="px-4 py-3 text-left">Status</th>
                  <th className="px-4 py-3 text-right">Action</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((r) => {
                  const payout = r.amount * (1 + r.profit_pct / 100);
                  return (
                    <tr
                      key={r.id}
                      className="cursor-pointer border-t border-border bg-background transition-colors hover:bg-surface/60"
                      onClick={() => setDetailRow(r)}
                    >
                      <td className="px-4 py-3 font-semibold">{r.name}</td>
                      <td className="px-4 py-3 text-xs text-muted-foreground">
                        {r.kind === "investment" ? "Plan" : "Copy Trade"}
                      </td>
                      <td className="px-4 py-3 text-right font-mono">
                        ${r.amount.toLocaleString(undefined, { maximumFractionDigits: 2 })}
                      </td>
                      <td className="px-4 py-3 text-right font-mono text-gold">
                        +{r.profit_pct}% · ${payout.toLocaleString(undefined, { maximumFractionDigits: 2 })}
                      </td>
                      <td className="px-4 py-3 text-xs text-muted-foreground">
                        {new Date(r.created_at).toLocaleDateString()}
                      </td>
                      <td className="px-4 py-3 text-xs text-muted-foreground">
                        {new Date(r.matures_at).toLocaleString()}
                      </td>
                      <td className="px-4 py-3">
                        <StatusBadge status={r.status} />
                      </td>
                      <td className="px-4 py-3 text-right" onClick={(e) => e.stopPropagation()}>
                        {r.status === "active" ? (
                          <button
                            onClick={() => setCancelTarget(r)}
                            className="rounded-md border border-border bg-surface px-3 py-1.5 text-xs font-semibold text-muted-foreground hover:border-bear hover:text-bear"
                          >
                            Cancel
                          </button>
                        ) : (
                          <span className="text-xs text-muted-foreground">—</span>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Detail drawer */}
      <Sheet open={!!detailRow} onOpenChange={(o) => !o && setDetailRow(null)}>
        <SheetContent className="w-full sm:max-w-md overflow-y-auto bg-background">
          {detailRow && (
            <>
              <SheetHeader>
                <div className="text-[11px] uppercase tracking-widest text-gold">
                  {detailRow.kind === "investment" ? "Investment Plan" : "Copy Trade"}
                </div>
                <SheetTitle className="font-display text-2xl">{detailRow.name}</SheetTitle>
                <SheetDescription>
                  Position opened {new Date(detailRow.created_at).toLocaleString()}
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

                <DetailRow label="Plan name" value={detailRow.name} />
                <DetailRow
                  label="Amount invested"
                  value={`$${detailRow.amount.toLocaleString(undefined, { maximumFractionDigits: 2 })}`}
                />
                <DetailRow label="Profit rate" value={`+${detailRow.profit_pct}%`} accent />
                <DetailRow
                  label="Expected return"
                  value={`$${(
                    detailRow.amount *
                    (1 + detailRow.profit_pct / 100)
                  ).toLocaleString(undefined, { maximumFractionDigits: 2 })}`}
                  accent
                />
                <DetailRow label="Duration" value={`${detailRow.duration_days} days`} />
                <DetailRow
                  label="Start date"
                  value={new Date(detailRow.created_at).toLocaleString()}
                />
                <DetailRow
                  label="Maturity date"
                  value={new Date(detailRow.matures_at).toLocaleString()}
                />
                {detailRow.completed_at && (
                  <DetailRow
                    label="Completed"
                    value={new Date(detailRow.completed_at).toLocaleString()}
                  />
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

      {/* Cancel confirmation modal */}
      <AlertDialog
        open={!!cancelTarget}
        onOpenChange={(o) => !o && !m.isPending && setCancelTarget(null)}
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
                  <span className="font-semibold text-foreground">{cancelTarget?.name}</span>.
                  Please review what will happen before confirming.
                </p>
                {cancelTarget && (
                  <div className="rounded-lg border border-border bg-surface p-3 text-xs">
                    <Line label="Principal refunded to wallet">
                      <span className="font-mono text-bull">
                        +${cancelTarget.amount.toLocaleString(undefined, { maximumFractionDigits: 2 })}
                      </span>
                    </Line>
                    <Line label="Expected return forfeited">
                      <span className="font-mono text-bear">
                        −${(
                          cancelTarget.amount *
                          (cancelTarget.profit_pct / 100)
                        ).toLocaleString(undefined, { maximumFractionDigits: 2 })}
                      </span>
                    </Line>
                    <Line label="New status">
                      <span className="font-semibold">Cancelled</span>
                    </Line>
                  </div>
                )}
                <ul className="list-disc space-y-1 pl-5 text-muted-foreground">
                  <li>Your wallet balance will be credited immediately with the principal.</li>
                  <li>
                    A <span className="font-semibold text-foreground">return</span> entry will be
                    recorded in your transaction ledger for auditability.
                  </li>
                  <li>This action cannot be undone — the position will not earn further profit.</li>
                </ul>
              </div>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={m.isPending}>Keep position</AlertDialogCancel>
            <AlertDialogAction
              disabled={m.isPending}
              onClick={(e) => {
                e.preventDefault();
                if (cancelTarget) m.mutate({ id: cancelTarget.id, kind: cancelTarget.kind });
              }}
              className="bg-bear text-white hover:bg-bear/90"
            >
              {m.isPending ? (
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

function DetailRow({
  label,
  value,
  accent,
}: {
  label: string;
  value: string;
  accent?: boolean;
}) {
  return (
    <div className="flex items-center justify-between border-b border-border/60 pb-2">
      <span className="text-xs uppercase tracking-wider text-muted-foreground">{label}</span>
      <span className={`font-mono text-sm ${accent ? "text-gold" : "text-foreground"}`}>
        {value}
      </span>
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
