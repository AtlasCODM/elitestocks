import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { Header } from "@/components/site/Header";
import { Footer } from "@/components/site/Footer";
import { Ticker } from "@/components/site/Ticker";
import { SparkLine } from "@/components/charts/CandleChart";
import { generateLine } from "@/lib/market-data";
import { useServerFn } from "@tanstack/react-start";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { listTraders, createCopyTrade } from "@/lib/copy.functions";
import { getWalletState } from "@/lib/wallet.functions";
import { useAuth } from "@/hooks/useAuth";
import { useState } from "react";
import { toast } from "sonner";

export const Route = createFileRoute("/copy-trading")({
  head: () => ({
    meta: [
      { title: "Copy Trading — Elite Stocks" },
      { name: "description", content: "Follow elite institutional traders and allocate capital to mirror their strategies." },
    ],
  }),
  component: CopyTradingPage,
});

function CopyTradingPage() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const qc = useQueryClient();

  const fetchTraders = useServerFn(listTraders);
  const fetchState = useServerFn(getWalletState);
  const copyFn = useServerFn(createCopyTrade);

  const { data: tData } = useQuery({ queryKey: ["traders"], queryFn: () => fetchTraders() });
  const { data: wData } = useQuery({
    queryKey: ["wallet-state"], queryFn: () => fetchState(), enabled: !!user,
  });
  const usdt = Number(wData?.wallets.find((w) => w.asset === "USDT")?.balance ?? 0);

  const [openId, setOpenId] = useState<string | null>(null);
  const [amount, setAmount] = useState("500");

  const m = useMutation({
    mutationFn: (v: { trader_id: string; amount: number }) => copyFn({ data: v }),
    onSuccess: () => {
      toast.success("Copy trade activated");
      setOpenId(null);
      qc.invalidateQueries({ queryKey: ["wallet-state"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const traders = tData?.traders ?? [];

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
            Follow vetted institutional traders. Allocate USDT to a strategy and receive your principal plus profit at the end of the term.
          </p>
          {user && (
            <div className="mt-3 text-xs text-muted-foreground">
              Available: <span className="font-mono text-foreground">${usdt.toLocaleString(undefined, { maximumFractionDigits: 2 })} USDT</span>
            </div>
          )}
        </div>

        <div className="mt-8 grid gap-4 md:grid-cols-3">
          {[
            { l: "Active Traders", v: String(traders.length) },
            { l: "Capital Under Mirror", v: "$2.4B" },
            { l: "Avg Monthly ROI", v: "+18.4%" },
          ].map((m2) => (
            <div key={m2.l} className="panel p-5">
              <div className="text-[11px] uppercase tracking-wider text-muted-foreground">{m2.l}</div>
              <div className="mt-2 font-display text-3xl font-bold text-gold">{m2.v}</div>
            </div>
          ))}
        </div>

        <div className="mt-8 overflow-x-auto rounded-xl border border-border">
          <table className="w-full">
            <thead className="bg-surface text-[11px] uppercase tracking-wider text-muted-foreground">
              <tr>
                <th className="px-4 py-3 text-left">Rank</th>
                <th className="px-4 py-3 text-left">Trader</th>
                <th className="px-4 py-3 text-right">ROI</th>
                <th className="px-4 py-3 text-right">Win Rate</th>
                <th className="px-4 py-3 text-right">Duration</th>
                <th className="px-4 py-3 text-right">Profit</th>
                <th className="px-4 py-3 text-right">Equity</th>
                <th className="px-4 py-3 text-right"></th>
              </tr>
            </thead>
            <tbody className="text-sm">
              {traders.map((t, i) => (
                <tr key={t.id} className="border-t border-border bg-background hover:bg-surface/60">
                  <td className="px-4 py-4 font-mono text-muted-foreground">#{i + 1}</td>
                  <td className="px-4 py-4">
                    <div className="flex items-center gap-3">
                      <div className="flex h-9 w-9 items-center justify-center rounded-full border border-gold/30 bg-gold/5 font-mono text-xs font-bold text-gold">
                        {t.name.split(" ").map((s: string) => s[0]).join("").slice(0, 2)}
                      </div>
                      <div>
                        <div className="font-semibold">{t.name}</div>
                        <div className="text-[11px] text-muted-foreground">{t.handle} · <span className="text-gold">{t.badge}</span></div>
                      </div>
                    </div>
                  </td>
                  <td className="px-4 py-4 text-right font-mono font-semibold text-bull">+{Number(t.roi).toFixed(1)}%</td>
                  <td className="px-4 py-4 text-right font-mono">{Number(t.win_rate).toFixed(1)}%</td>
                  <td className="px-4 py-4 text-right font-mono">{t.duration_days}D</td>
                  <td className="px-4 py-4 text-right font-mono text-gold">{Number(t.profit_pct)}%</td>
                  <td className="px-4 py-4">
                    <div className="ml-auto h-8 w-28">
                      <SparkLine data={generateLine(i + 5)} color="var(--bull)" height={32} />
                    </div>
                  </td>
                  <td className="px-4 py-4 text-right">
                    {openId === t.id ? (
                      <div className="flex items-center justify-end gap-2">
                        <input value={amount} onChange={(e) => setAmount(e.target.value)}
                          className="w-24 rounded border border-border bg-background px-2 py-1 font-mono text-xs" placeholder="USDT" />
                        <button onClick={() => {
                          const n = parseFloat(amount);
                          if (!n || n < 500) return toast.error("Minimum is $500");
                          m.mutate({ trader_id: t.id, amount: n });
                        }} disabled={m.isPending}
                          className="rounded bg-gold px-3 py-1.5 text-xs font-bold text-primary-foreground disabled:opacity-60">
                          {m.isPending ? "…" : "Go"}
                        </button>
                        <button onClick={() => setOpenId(null)} className="text-xs text-muted-foreground">✕</button>
                      </div>
                    ) : (
                      <button onClick={() => {
                        if (!user) return navigate({ to: "/login" });
                        setOpenId(t.id); setAmount("500");
                      }} className="rounded-md border border-gold/40 bg-gold/5 px-3 py-1.5 text-xs font-semibold text-gold hover:bg-gold/10">
                        Copy
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {user && (wData?.copyTrades?.length ?? 0) > 0 && (
          <div className="mt-12">
            <h2 className="font-display text-2xl font-bold">Your copy trades</h2>
            <div className="mt-4 overflow-x-auto rounded-lg border border-border">
              <table className="w-full text-sm">
                <thead className="bg-surface text-[11px] uppercase tracking-wider text-muted-foreground">
                  <tr>
                    <th className="px-4 py-3 text-left">Trader</th>
                    <th className="px-4 py-3 text-right">Amount</th>
                    <th className="px-4 py-3 text-right">Profit</th>
                    <th className="px-4 py-3 text-left">Status</th>
                    <th className="px-4 py-3 text-left">Matures</th>
                  </tr>
                </thead>
                <tbody>
                  {wData!.copyTrades.map((ct: { id: string; trader: { name: string } | null; amount: number | string; profit_pct: number | string; status: string; matures_at: string }) => (
                    <tr key={ct.id} className="border-t border-border bg-background">
                      <td className="px-4 py-3 font-semibold">{ct.trader?.name ?? "—"}</td>
                      <td className="px-4 py-3 text-right font-mono">${Number(ct.amount).toLocaleString()}</td>
                      <td className="px-4 py-3 text-right font-mono text-gold">{Number(ct.profit_pct)}%</td>
                      <td className="px-4 py-3 capitalize">{ct.status}</td>
                      <td className="px-4 py-3 text-xs text-muted-foreground">{new Date(ct.matures_at).toLocaleString()}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>
      <Footer />
    </div>
  );
}
