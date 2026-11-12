import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { Header } from "@/components/site/Header";
import { Footer } from "@/components/site/Footer";
import { Ticker } from "@/components/site/Ticker";
import { ArrowRight, CheckCircle2, RefreshCw } from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import { useFinancialConfiguration } from "@/hooks/useFinancialConfiguration";
import { useServerFn } from "@tanstack/react-start";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { createInvestment } from "@/lib/invest.functions";
import { getWalletState } from "@/lib/wallet.functions";
import { previewInvestment, type PositionSummary } from "@/lib/investment-engine";
import { parseFinancialAmount } from "@/lib/financial-amount";
import { InvestmentSummary } from "@/components/site/InvestmentSummary";
import { useState } from "react";
import { toast } from "sonner";

export const Route = createFileRoute("/strategies")({
  head: () => ({
    meta: [
      { title: "Investment Plans — Elite Stocks" },
      {
        name: "description",
        content: "Configurable fixed-term investment projections from Elite Stocks.",
      },
    ],
  }),
  component: StrategiesPage,
});

type InvestmentRow = {
  id: string;
  plan_tier: string;
  amount: number | string;
  profit_pct: number | string;
  status: string;
  matures_at: string;
  summary?: PositionSummary | null;
};

type WalletState = {
  wallets: { asset: string; balance: number | string }[];
  investments: InvestmentRow[];
};

const PLAN_COLORS = [
  "from-zinc-700 to-zinc-800",
  "from-zinc-700 to-zinc-800",
  "from-zinc-700 to-zinc-800",
  "from-amber-900/40 to-zinc-800",
  "from-amber-800/50 to-zinc-800",
  "from-amber-700/60 to-zinc-800",
];

function money(value: number | string) {
  return Number(value).toLocaleString(undefined, { maximumFractionDigits: 2 });
}

function StrategiesPage() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const qc = useQueryClient();
  const configQuery = useFinancialConfiguration();
  const config = configQuery.data?.config;
  const invest = useServerFn(createInvestment);
  const fetchState = useServerFn(getWalletState);
  const walletQuery = useQuery({
    queryKey: ["wallet-state"],
    queryFn: () => fetchState(),
    enabled: !!user,
    refetchInterval: 15000,
  });
  const walletData = walletQuery.data as WalletState | undefined;
  const usdt = walletData?.wallets.find((w) => w.asset === "USDT");

  const [openPlan, setOpenPlan] = useState<string | null>(null);
  const [amount, setAmount] = useState("");

  const mutation = useMutation({
    mutationFn: (v: { tier: string; amount: string }) => invest({ data: v }),
    onSuccess: () => {
      toast.success("Investment activated");
      setOpenPlan(null);
      setAmount("");
      qc.invalidateQueries({ queryKey: ["wallet-state"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const configUnavailable = configQuery.isError || !config;
  const walletUnavailable = !!user && (walletQuery.isError || !walletData);

  return (
    <div className="min-h-screen bg-background">
      <Header />
      <Ticker />
      <div className="mx-auto max-w-[1400px] px-4 py-10 lg:px-6">
        <div>
          <div className="text-xs uppercase tracking-widest text-gold">INVESTMENT PLANS</div>
          <h1 className="mt-2 font-display text-4xl font-bold tracking-tight md:text-5xl">
            Fixed-term projection plans
          </h1>
          <p className="mt-2 max-w-2xl text-sm text-muted-foreground">
            Review configurable term projections. Projections are not earnings or guarantees; actual
            profit requires verified performance evidence.
          </p>
          {user && (
            <div className="mt-3 text-xs text-muted-foreground">
              Available:{" "}
              {walletUnavailable ? (
                <span className="text-amber-400">Wallet unavailable — retry before investing</span>
              ) : (
                <span className="font-mono text-foreground">{money(usdt?.balance ?? 0)} USDT</span>
              )}
            </div>
          )}
        </div>

        {configQuery.isLoading ? (
          <div className="mt-8 rounded-lg border border-border bg-surface p-6 text-sm text-muted-foreground">
            Loading current plan configuration…
          </div>
        ) : configUnavailable ? (
          <div className="mt-8 flex flex-wrap items-center justify-between gap-3 rounded-lg border border-amber-500/30 bg-amber-500/5 p-5 text-sm text-muted-foreground">
            <span>
              Investment configuration is unavailable. Financial actions are disabled until it is
              restored.
            </span>
            <button
              onClick={() => configQuery.refetch()}
              className="inline-flex items-center gap-2 rounded border border-border px-3 py-2 text-xs font-semibold text-foreground"
            >
              <RefreshCw className="h-3.5 w-3.5" /> Retry
            </button>
          </div>
        ) : (
          <div className="mt-8 grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {config.plans.map((plan, index) => {
              const preview =
                amount && Number.isFinite(Number(amount)) && Number(amount) > 0
                  ? previewInvestment(Number(amount), plan.profitPct)
                  : null;
              return (
                <div
                  key={plan.tier}
                  className={`group panel relative overflow-hidden bg-gradient-to-br ${PLAN_COLORS[index] ?? PLAN_COLORS[0]} p-6 transition-all hover:border-gold/60`}
                >
                  <div className="pointer-events-none absolute inset-0 grid-bg-sm opacity-20" />
                  <div className="relative flex items-start justify-between">
                    <div>
                      <div className="text-[11px] uppercase tracking-widest text-muted-foreground">
                        Tier {index + 1}
                      </div>
                      <div className="mt-1 font-display text-2xl font-bold">{plan.tier}</div>
                    </div>
                    <span
                      className={`rounded border px-2 py-1 font-mono text-[11px] ${plan.enabled ? "border-gold/40 bg-gold/10 text-gold" : "border-border bg-surface text-muted-foreground"}`}
                    >
                      {plan.enabled ? `${plan.days}D` : "Unavailable"}
                    </span>
                  </div>
                  <div className="relative mt-6 flex items-end justify-between">
                    <div>
                      <div className="text-[11px] uppercase text-muted-foreground">
                        Projected profit
                      </div>
                      <div className="font-display text-4xl font-bold text-gold gold-text-glow">
                        {plan.profitPct}%
                      </div>
                    </div>
                    <div className="text-right text-[11px] text-muted-foreground">
                      <div>Investment range</div>
                      <div className="font-mono text-foreground">
                        {money(config.minInvestment)}–{money(config.maxInvestment)} USDT
                      </div>
                    </div>
                  </div>
                  <div className="relative mt-3 text-[11px] text-muted-foreground">
                    Simple {config.calculationInterval} interval projection · total-term rate · not
                    guaranteed
                  </div>

                  {openPlan === plan.tier && plan.enabled ? (
                    <div className="relative mt-6 space-y-3">
                      <input
                        value={amount}
                        onChange={(event) => setAmount(event.target.value)}
                        placeholder={`${config.minInvestment}–${config.maxInvestment} USDT`}
                        inputMode="decimal"
                        className="w-full rounded-md border border-border bg-background px-3 py-2 font-mono text-sm outline-none focus:border-gold"
                      />
                      {preview && (
                        <div className="rounded border border-border bg-background/60 p-3 text-xs">
                          <div className="flex justify-between">
                            <span className="text-muted-foreground">Principal</span>
                            <span className="font-mono">{money(preview.principal)} USDT</span>
                          </div>
                          <div className="mt-1 flex justify-between">
                            <span className="text-muted-foreground">Projected profit</span>
                            <span className="font-mono text-gold">
                              +{money(preview.projectedProfit)} USDT
                            </span>
                          </div>
                          <div className="mt-1 flex justify-between">
                            <span className="text-muted-foreground">Projected total</span>
                            <span className="font-mono text-gold">
                              {money(preview.projectedTotal)} USDT
                            </span>
                          </div>
                        </div>
                      )}
                      <div className="flex gap-2">
                        <button
                          onClick={() => setOpenPlan(null)}
                          className="flex-1 rounded-md border border-border bg-surface py-2 text-xs font-semibold"
                        >
                          Cancel
                        </button>
                        <button
                          onClick={() => {
                            const raw = amount.trim();
                            try {
                              parseFinancialAmount(raw);
                            } catch (error) {
                              return toast.error(
                                error instanceof Error ? error.message : "Invalid financial amount",
                              );
                            }
                            const value = Number(raw);
                            if (
                              !Number.isFinite(value) ||
                              value <= 0 ||
                              value < config.minInvestment ||
                              value > config.maxInvestment
                            ) {
                              return toast.error(
                                `Investment must be between ${money(config.minInvestment)} and ${money(config.maxInvestment)} USDT`,
                              );
                            }
                            if (walletUnavailable)
                              return toast.error("Wallet is unavailable. Retry before investing.");
                            mutation.mutate({ tier: plan.tier, amount: raw });
                          }}
                          disabled={mutation.isPending || walletUnavailable}
                          className="flex-1 rounded-md bg-gold py-2 text-xs font-bold text-primary-foreground disabled:opacity-60"
                        >
                          {mutation.isPending ? "…" : "Activate"}
                        </button>
                      </div>
                    </div>
                  ) : (
                    <button
                      onClick={() => {
                        if (!plan.enabled) return;
                        if (!user) return navigate({ to: "/login" });
                        setOpenPlan(plan.tier);
                        setAmount("");
                      }}
                      disabled={!plan.enabled || configUnavailable}
                      className="relative mt-6 flex w-full items-center justify-between rounded-md border border-border bg-background/40 px-3 py-2 text-xs font-semibold transition-colors group-hover:border-gold/50 group-hover:text-gold disabled:cursor-not-allowed disabled:opacity-60"
                    >
                      {plan.enabled ? `Invest in ${plan.tier}` : "Currently unavailable"}
                      <ArrowRight className="h-3.5 w-3.5" />
                    </button>
                  )}
                </div>
              );
            })}
          </div>
        )}

        {user && walletData && walletData.investments.length > 0 && (
          <div className="mt-12">
            <h2 className="font-display text-2xl font-bold">Your active investments</h2>
            <div className="mt-4 overflow-x-auto rounded-lg border border-border">
              <table className="w-full text-sm">
                <thead className="bg-surface text-[11px] uppercase tracking-wider text-muted-foreground">
                  <tr>
                    <th className="px-4 py-3 text-left">Plan</th>
                    <th className="px-4 py-3 text-right">Principal</th>
                    <th className="px-4 py-3 text-right">Projected total</th>
                    <th className="px-4 py-3 text-left">Status</th>
                    <th className="px-4 py-3 text-left">Matures</th>
                  </tr>
                </thead>
                <tbody>
                  {walletData.investments.map((investment) => (
                    <tr key={investment.id} className="border-t border-border bg-background">
                      <td className="px-4 py-3 font-semibold">{investment.plan_tier}</td>
                      <td className="px-4 py-3 text-right font-mono">
                        {money(investment.summary?.principal ?? investment.amount)} USDT
                      </td>
                      <td className="px-4 py-3 text-right font-mono text-gold">
                        {investment.summary
                          ? `${money(investment.summary.projectedTotal)} USDT`
                          : "Unavailable"}
                      </td>
                      <td className="px-4 py-3 capitalize">{investment.status}</td>
                      <td className="px-4 py-3 text-xs text-muted-foreground">
                        {new Date(
                          investment.summary?.maturityDate ?? investment.matures_at,
                        ).toLocaleString()}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {!user && (
          <div className="mt-10 rounded-lg border border-border bg-surface p-6 text-center">
            <p className="text-sm text-muted-foreground">Sign in to activate an investment plan.</p>
            <Link
              to="/login"
              className="mt-3 inline-block rounded-md bg-gold px-4 py-2 text-xs font-semibold text-primary-foreground"
            >
              Sign In
            </Link>
          </div>
        )}
      </div>
      <Footer />
    </div>
  );
}
