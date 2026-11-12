import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { Header } from "@/components/site/Header";
import { Footer } from "@/components/site/Footer";
import { Ticker } from "@/components/site/Ticker";
import { SparkLine } from "@/components/charts/CandleChart";
import { generateLine } from "@/lib/market-data";
import { useFinancialConfiguration } from "@/hooks/useFinancialConfiguration";
import { useServerFn } from "@tanstack/react-start";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { listTraders, createCopyTrade } from "@/lib/copy.functions";
import { getWalletState } from "@/lib/wallet.functions";
import { parseFinancialAmount } from "@/lib/financial-amount";
import { useAuth } from "@/hooks/useAuth";
import { InvestmentSummary } from "@/components/site/InvestmentSummary";
import type { PositionSummary } from "@/lib/investment-engine";
import { useState } from "react";
import { toast } from "sonner";
import { RefreshCw } from "lucide-react";

export const Route = createFileRoute("/copy-trading")({
  head: () => ({
    meta: [
      { title: "Copy Trading — Elite Stocks" },
      {
        name: "description",
        content: "Follow trader snapshots with transparent, non-guaranteed projections.",
      },
    ],
  }),
  component: CopyTradingPage,
});

type Trader = {
  id: string;
  name: string;
  handle: string;
  badge: string;
  roi: number | string;
  win_rate: number | string;
  duration_days: number;
  profit_pct: number | string;
};

type CopyTrade = {
  id: string;
  trader?: { name?: string | null } | null;
  amount: number | string;
  status: string;
  matures_at: string;
  summary?: PositionSummary | null;
};

type WalletState = {
  wallets: { asset: string; balance: number | string }[];
  copyTrades: CopyTrade[];
};

function money(value: number | string) {
  return Number(value).toLocaleString(undefined, { maximumFractionDigits: 2 });
}

function CopyTradingPage() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const qc = useQueryClient();
  const configQuery = useFinancialConfiguration();
  const config = configQuery.data?.config;
  const fetchTraders = useServerFn(listTraders);
  const fetchState = useServerFn(getWalletState);
  const copyFn = useServerFn(createCopyTrade);
  const traderQuery = useQuery({ queryKey: ["traders"], queryFn: () => fetchTraders() });
  const walletQuery = useQuery({
    queryKey: ["wallet-state"],
    queryFn: () => fetchState(),
    enabled: !!user,
    refetchInterval: 15000,
  });
  const wallet = walletQuery.data as WalletState | undefined;
  const traders = (traderQuery.data?.traders ?? []) as Trader[];
  const usdt = wallet?.wallets.find((entry) => entry.asset === "USDT");
  const [openId, setOpenId] = useState<string | null>(null);
  const [amount, setAmount] = useState("");

  const mutation = useMutation({
    mutationFn: (value: { trader_id: string; amount: string }) => copyFn({ data: value }),
    onSuccess: () => {
      toast.success("Copy trade activated");
      setOpenId(null);
      setAmount("");
      qc.invalidateQueries({ queryKey: ["wallet-state"] });
    },
    onError: (error: Error) => toast.error(error.message),
  });

  const unavailable = configQuery.isError || !config;
  const walletUnavailable = !!user && (walletQuery.isError || !wallet);

  return (
    <div className="min-h-screen bg-background">
      <Header />
      <Ticker />
      <div className="mx-auto max-w-[1400px] px-4 py-10 lg:px-6">
        <div>
          <div className="text-xs uppercase tracking-widest text-gold">COPY TRADING</div>
          <h1 className="mt-2 font-display text-4xl font-bold tracking-tight md:text-5xl">
            Mirror elite portfolios
          </h1>
          <p className="mt-2 max-w-2xl text-sm text-muted-foreground">
            Follow trader snapshots and allocate USDT. Snapshot rates are historical/trader-provided
            projections, not automatic fixed profits or guarantees.
          </p>
          {user && (
            <div className="mt-3 text-xs text-muted-foreground">
              Available:{" "}
              {walletUnavailable ? (
                <span className="text-amber-400">Wallet unavailable — retry before copying</span>
              ) : (
                <span className="font-mono text-foreground">{money(usdt?.balance ?? 0)} USDT</span>
              )}
            </div>
          )}
        </div>

        {unavailable && (
          <div className="mt-6 flex flex-wrap items-center justify-between gap-3 rounded-lg border border-amber-500/30 bg-amber-500/5 p-5 text-sm text-muted-foreground">
            <span>
              Financial configuration is unavailable. Copy actions are disabled until current limits
              load.
            </span>
            <button
              onClick={() => configQuery.refetch()}
              className="inline-flex items-center gap-2 rounded border border-border px-3 py-2 text-xs font-semibold text-foreground"
            >
              <RefreshCw className="h-3.5 w-3.5" /> Retry
            </button>
          </div>
        )}

        <div className="mt-8 grid gap-4 md:grid-cols-3">
          {[
            {
              label: "Active traders",
              value: traderQuery.isError ? "Unavailable" : String(traders.length),
            },
            {
              label: "Copy amount range",
              value: config
                ? `${money(config.minInvestment)}–${money(config.maxInvestment)} USDT`
                : "Unavailable",
            },
            { label: "Return basis", value: "Trader snapshot" },
          ].map((stat) => (
            <div key={stat.label} className="panel p-5">
              <div className="text-[11px] uppercase tracking-wider text-muted-foreground">
                {stat.label}
              </div>
              <div className="mt-2 font-display text-2xl font-bold text-gold">{stat.value}</div>
            </div>
          ))}
        </div>

        {traderQuery.isError ? (
          <div className="mt-8 rounded-lg border border-amber-500/30 bg-amber-500/5 p-6 text-sm text-muted-foreground">
            Trader snapshots are temporarily unavailable.{" "}
            <button
              onClick={() => traderQuery.refetch()}
              className="ml-1 text-foreground underline"
            >
              Retry
            </button>
          </div>
        ) : (
          <div className="mt-8 overflow-x-auto rounded-xl border border-border">
            <table className="w-full">
              <thead className="bg-surface text-[11px] uppercase tracking-wider text-muted-foreground">
                <tr>
                  <th className="px-4 py-3 text-left">Rank</th>
                  <th className="px-4 py-3 text-left">Trader</th>
                  <th className="px-4 py-3 text-right">ROI snapshot</th>
                  <th className="px-4 py-3 text-right">Win rate</th>
                  <th className="px-4 py-3 text-right">Term</th>
                  <th className="px-4 py-3 text-right">Snapshot projection</th>
                  <th className="px-4 py-3 text-right">Action</th>
                </tr>
              </thead>
              <tbody className="text-sm">
                {traders.map((trader, index) => (
                  <tr
                    key={trader.id}
                    className="border-t border-border bg-background hover:bg-surface/60"
                  >
                    <td className="px-4 py-4 font-mono text-muted-foreground">#{index + 1}</td>
                    <td className="px-4 py-4">
                      <div className="flex items-center gap-3">
                        <div className="flex h-9 w-9 items-center justify-center rounded-full border border-gold/30 bg-gold/5 font-mono text-xs font-bold text-gold">
                          {trader.name
                            .split(" ")
                            .map((part) => part[0])
                            .join("")
                            .slice(0, 2)}
                        </div>
                        <div>
                          <div className="font-semibold">{trader.name}</div>
                          <div className="text-[11px] text-muted-foreground">
                            {trader.handle} · <span className="text-gold">{trader.badge}</span>
                          </div>
                        </div>
                      </div>
                    </td>
                    <td className="px-4 py-4 text-right font-mono font-semibold text-bull">
                      +{Number(trader.roi).toFixed(1)}%
                    </td>
                    <td className="px-4 py-4 text-right font-mono">
                      {Number(trader.win_rate).toFixed(1)}%
                    </td>
                    <td className="px-4 py-4 text-right font-mono">{trader.duration_days}D</td>
                    <td className="px-4 py-4 text-right font-mono text-gold">
                      {Number(trader.profit_pct)}% total-term
                    </td>
                    <td className="px-4 py-4 text-right">
                      {openId === trader.id ? (
                        <div className="flex items-center justify-end gap-2">
                          <input
                            value={amount}
                            onChange={(event) => setAmount(event.target.value)}
                            className="w-28 rounded border border-border bg-background px-2 py-1 font-mono text-xs"
                            placeholder={`${config?.minInvestment ?? "Amount"}`}
                          />
                          <button
                            onClick={() => {
                              const raw = amount.trim();
                              try {
                                parseFinancialAmount(raw);
                              } catch (error) {
                                return toast.error(
                                  error instanceof Error
                                    ? error.message
                                    : "Invalid financial amount",
                                );
                              }
                              const value = Number(raw);
                              if (
                                !config ||
                                !Number.isFinite(value) ||
                                value <= 0 ||
                                value < config.minInvestment ||
                                value > config.maxInvestment
                              )
                                return toast.error(
                                  config
                                    ? `Copy amount must be between ${money(config.minInvestment)} and ${money(config.maxInvestment)} USDT`
                                    : "Configuration unavailable",
                                );
                              if (walletUnavailable)
                                return toast.error("Wallet is unavailable. Retry before copying.");
                              mutation.mutate({ trader_id: trader.id, amount: raw });
                            }}
                            disabled={mutation.isPending || unavailable || walletUnavailable}
                            className="rounded bg-gold px-3 py-1.5 text-xs font-bold text-primary-foreground disabled:opacity-60"
                          >
                            {mutation.isPending ? "…" : "Go"}
                          </button>
                          <button
                            onClick={() => setOpenId(null)}
                            className="text-xs text-muted-foreground"
                          >
                            ✕
                          </button>
                        </div>
                      ) : (
                        <button
                          onClick={() => {
                            if (!user) return navigate({ to: "/login" });
                            if (unavailable) return;
                            setOpenId(trader.id);
                            setAmount("");
                          }}
                          disabled={unavailable}
                          className="rounded-md border border-gold/40 bg-gold/5 px-3 py-1.5 text-xs font-semibold text-gold hover:bg-gold/10 disabled:opacity-60"
                        >
                          Copy
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {user && wallet && wallet.copyTrades.length > 0 && (
          <div className="mt-12">
            <h2 className="font-display text-2xl font-bold">Your copy trades</h2>
            <div className="mt-4 grid gap-4 md:grid-cols-2">
              {wallet.copyTrades.map((trade) => (
                <div key={trade.id} className="panel p-5">
                  <div className="flex items-center justify-between">
                    <div className="font-semibold">{trade.trader?.name ?? "Trader"}</div>
                    <span className="capitalize text-xs text-muted-foreground">{trade.status}</span>
                  </div>
                  <div className="mt-4">
                    <InvestmentSummary summary={trade.summary} compact />
                  </div>
                  <div className="mt-3 flex items-center justify-between text-[11px] text-muted-foreground">
                    <span>Server-provided maturity</span>
                    <span>
                      {new Date(trade.summary?.maturityDate ?? trade.matures_at).toLocaleString()}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
      <Footer />
    </div>
  );
}
