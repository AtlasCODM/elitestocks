import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { Header } from "@/components/site/Header";
import { Footer } from "@/components/site/Footer";
import { Ticker } from "@/components/site/Ticker";
import { ArrowRight, CheckCircle2 } from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import { useServerFn } from "@tanstack/react-start";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { createInvestment } from "@/lib/invest.functions";
import { getWalletState } from "@/lib/wallet.functions";
import { useState } from "react";
import { toast } from "sonner";

const PLANS = [
  { tier: "Starter 3D", days: 3, roi: 35, min: 500 },
  { tier: "Growth 7D", days: 7, roi: 45, min: 500 },
  { tier: "Boost 14D", days: 14, roi: 55, min: 500 },
  { tier: "Pro 21D", days: 21, roi: 68, min: 500 },
  { tier: "Elite 30D", days: 30, roi: 80, min: 500 },
  { tier: "Apex 60D", days: 60, roi: 100, min: 500 },
];

export const Route = createFileRoute("/strategies")({
  head: () => ({
    meta: [
      { title: "Investment Plans — Elite Stocks" },
      { name: "description", content: "Fixed-term investment plans with guaranteed returns from 35% to 100%." },
    ],
  }),
  component: StrategiesPage,
});

function StrategiesPage() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const qc = useQueryClient();
  const invest = useServerFn(createInvestment);
  const fetchState = useServerFn(getWalletState);
  const { data } = useQuery({
    queryKey: ["wallet-state"],
    queryFn: () => fetchState(),
    enabled: !!user,
  });
  const usdt = Number(data?.wallets.find((w) => w.asset === "USDT")?.balance ?? 0);

  const [openPlan, setOpenPlan] = useState<string | null>(null);
  const [amount, setAmount] = useState("500");

  const m = useMutation({
    mutationFn: (v: { tier: string; amount: number }) => invest({ data: v }),
    onSuccess: () => {
      toast.success("Investment activated");
      setOpenPlan(null);
      qc.invalidateQueries({ queryKey: ["wallet-state"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <div className="min-h-screen bg-background">
      <Header />
      <Ticker />
      <div className="mx-auto max-w-[1400px] px-4 py-10 lg:px-6">
        <div>
          <div className="text-xs uppercase tracking-widest text-gold">INVESTMENT PLANS</div>
          <h1 className="mt-2 font-display text-4xl font-bold tracking-tight md:text-5xl">
            Fixed-term yield plans
          </h1>
          <p className="mt-2 max-w-2xl text-sm text-muted-foreground">
            Lock USDT for a fixed duration and receive your principal plus the stated profit at maturity.
          </p>
          {user && (
            <div className="mt-3 text-xs text-muted-foreground">
              Available: <span className="font-mono text-foreground">${usdt.toLocaleString(undefined, { maximumFractionDigits: 2 })} USDT</span>
            </div>
          )}
        </div>

        <div className="mt-8 grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {PLANS.map((s, i) => (
            <div key={s.tier} className="group panel relative overflow-hidden p-6 transition-all hover:border-gold/60">
              <div className="pointer-events-none absolute inset-0 grid-bg-sm opacity-20" />
              <div className="relative flex items-start justify-between">
                <div>
                  <div className="text-[11px] uppercase tracking-widest text-muted-foreground">Tier {i + 1}</div>
                  <div className="mt-1 font-display text-2xl font-bold">{s.tier}</div>
                </div>
                <span className="rounded border border-gold/40 bg-gold/10 px-2 py-1 font-mono text-[11px] text-gold">
                  {s.days}D
                </span>
              </div>
              <div className="relative mt-6 flex items-end justify-between">
                <div>
                  <div className="text-[11px] uppercase text-muted-foreground">Profit</div>
                  <div className="font-display text-4xl font-bold text-gold gold-text-glow">{s.roi}%</div>
                </div>
                <div className="text-right text-[11px] text-muted-foreground">
                  <div>Min entry</div>
                  <div className="font-mono text-foreground">${s.min.toLocaleString()}</div>
                </div>
              </div>

              <ul className="relative mt-6 space-y-1.5 text-xs text-muted-foreground">
                {["Fixed-term contract", "Capital + profit at maturity", "Automatic settlement"].map((f) => (
                  <li key={f} className="flex items-center gap-2">
                    <CheckCircle2 className="h-3.5 w-3.5 text-gold" /> {f}
                  </li>
                ))}
              </ul>

              {openPlan === s.tier ? (
                <div className="relative mt-6 space-y-3">
                  <input value={amount} onChange={(e) => setAmount(e.target.value)} placeholder="Amount in USDT"
                    className="w-full rounded-md border border-border bg-background px-3 py-2 font-mono text-sm outline-none focus:border-gold" />
                  <div className="flex gap-2">
                    <button onClick={() => setOpenPlan(null)}
                      className="flex-1 rounded-md border border-border bg-surface py-2 text-xs font-semibold">Cancel</button>
                    <button onClick={() => {
                      const n = parseFloat(amount);
                      if (!n || n < s.min) return toast.error(`Minimum is $${s.min}`);
                      m.mutate({ tier: s.tier, amount: n });
                    }} disabled={m.isPending}
                      className="flex-1 rounded-md bg-gold py-2 text-xs font-bold text-primary-foreground disabled:opacity-60">
                      {m.isPending ? "…" : "Activate"}
                    </button>
                  </div>
                </div>
              ) : (
                <button onClick={() => {
                  if (!user) return navigate({ to: "/login" });
                  setOpenPlan(s.tier);
                  setAmount(String(s.min));
                }}
                  className="relative mt-6 flex w-full items-center justify-between rounded-md border border-border bg-background/40 px-3 py-2 text-xs font-semibold transition-colors group-hover:border-gold/50 group-hover:text-gold">
                  Invest in {s.tier}
                  <ArrowRight className="h-3.5 w-3.5" />
                </button>
              )}
            </div>
          ))}
        </div>

        {user && (data?.investments?.length ?? 0) > 0 && (
          <div className="mt-12">
            <h2 className="font-display text-2xl font-bold">Your active investments</h2>
            <div className="mt-4 overflow-x-auto rounded-lg border border-border">
              <table className="w-full text-sm">
                <thead className="bg-surface text-[11px] uppercase tracking-wider text-muted-foreground">
                  <tr>
                    <th className="px-4 py-3 text-left">Plan</th>
                    <th className="px-4 py-3 text-right">Amount</th>
                    <th className="px-4 py-3 text-right">Profit</th>
                    <th className="px-4 py-3 text-left">Status</th>
                    <th className="px-4 py-3 text-left">Matures</th>
                  </tr>
                </thead>
                <tbody>
                  {data!.investments.map((inv) => (
                    <tr key={inv.id} className="border-t border-border bg-background">
                      <td className="px-4 py-3 font-semibold">{inv.plan_tier}</td>
                      <td className="px-4 py-3 text-right font-mono">${Number(inv.amount).toLocaleString()}</td>
                      <td className="px-4 py-3 text-right font-mono text-gold">{Number(inv.profit_pct)}%</td>
                      <td className="px-4 py-3 capitalize">{inv.status}</td>
                      <td className="px-4 py-3 text-xs text-muted-foreground">{new Date(inv.matures_at).toLocaleString()}</td>
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
            <Link to="/login" className="mt-3 inline-block rounded-md bg-gold px-4 py-2 text-xs font-semibold text-primary-foreground">
              Sign In
            </Link>
          </div>
        )}
      </div>
      <Footer />
    </div>
  );
}
