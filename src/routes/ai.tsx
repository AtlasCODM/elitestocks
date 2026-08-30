import { createFileRoute } from "@tanstack/react-router";
import { Header } from "@/components/site/Header";
import { Footer } from "@/components/site/Footer";
import { Ticker } from "@/components/site/Ticker";
import { SparkLine } from "@/components/charts/CandleChart";
import { generateLine } from "@/lib/market-data";
import { Brain, Radio, ShieldAlert, TrendingUp } from "lucide-react";

export const Route = createFileRoute("/ai")({
  head: () => ({
    meta: [
      { title: "AI Market Intelligence — Elite Stocks" },
      { name: "description", content: "Sentiment visualizations, volatility heatmaps, trend prediction, and AI signal stream." },
    ],
  }),
  component: AIPage,
});

function AIPage() {
  return (
    <div className="min-h-screen bg-background">
      <Header />
      <Ticker />
      <div className="mx-auto max-w-[1400px] px-4 py-10 lg:px-6">
        <div>
          <div className="text-xs uppercase tracking-widest text-gold">AI MARKET INTELLIGENCE</div>
          <h1 className="mt-2 font-display text-4xl font-bold tracking-tight md:text-5xl">
            Signal infrastructure
          </h1>
          <p className="mt-2 max-w-2xl text-sm text-muted-foreground">
            Real-time fusion of orderflow microstructure, on-chain telemetry, and
            large-language sentiment models into trading signals.
          </p>
        </div>

        <div className="mt-8 grid gap-4 md:grid-cols-4">
          {[
            { i: Brain, l: "Models live", v: "184" },
            { i: Radio, l: "Signals / hr", v: "2,418" },
            { i: TrendingUp, l: "Avg confidence", v: "87.3%" },
            { i: ShieldAlert, l: "Risk alerts · 24h", v: "12" },
          ].map((m) => (
            <div key={m.l} className="panel p-5">
              <div className="flex items-center gap-3">
                <div className="rounded-md border border-gold/30 bg-gold/5 p-2 text-gold">
                  <m.i className="h-4 w-4" />
                </div>
                <div>
                  <div className="font-display text-2xl font-bold">{m.v}</div>
                  <div className="text-[11px] uppercase tracking-wider text-muted-foreground">{m.l}</div>
                </div>
              </div>
            </div>
          ))}
        </div>

        <div className="mt-6 grid gap-4 lg:grid-cols-3">
          <div className="panel p-5 lg:col-span-2">
            <div className="flex items-center justify-between">
              <div className="font-semibold">Sentiment Index · 24h</div>
              <span className="text-xs text-bull">Bullish · 72</span>
            </div>
            <div className="mt-4 h-40">
              <SparkLine data={generateLine(101, 80)} color="var(--gold)" height={160} />
            </div>
          </div>
          <div className="panel p-5">
            <div className="font-semibold">Volatility Heatmap</div>
            <div className="mt-4 grid grid-cols-7 gap-1">
              {Array.from({ length: 56 }).map((_, i) => {
                const v = (((i * 53) % 100) / 100);
                return (
                  <div
                    key={i}
                    className="aspect-square rounded-sm"
                    style={{ background: `color-mix(in oklab, var(--gold) ${Math.round(v * 80)}%, var(--surface-3))` }}
                  />
                );
              })}
            </div>
            <div className="mt-2 flex items-center justify-between text-[10px] uppercase tracking-wider text-muted-foreground">
              <span>Low</span><span>High</span>
            </div>
          </div>
        </div>

        <div className="mt-6 grid gap-4 lg:grid-cols-2">
          <div className="panel p-5">
            <div className="font-semibold">Signal Stream</div>
            <div className="mt-4 space-y-2.5">
              {[
                { a: "BTC", s: "Strong Buy", c: 92, d: "Orderflow accumulation · LLM sentiment +14.2%", t: "Bull" },
                { a: "ETH", s: "Buy", c: 87, d: "Bullish divergence · 4H sweep above 3580", t: "Bull" },
                { a: "SOL", s: "Neutral", c: 64, d: "Range-bound · awaiting macro print", t: "Neutral" },
                { a: "BTC", s: "Take Profit", c: 81, d: "Resistance cluster 68,400 · partial exit advised", t: "Watch" },
                { a: "ETH", s: "Buy", c: 78, d: "Funding flip negative · contrarian long", t: "Bull" },
                { a: "USDT", s: "Stable", c: 99, d: "Peg integrity nominal", t: "Neutral" },
              ].map((s, i) => (
                <div key={i} className="flex items-center gap-3 rounded-md border border-border bg-surface px-3 py-2.5">
                  <div className="flex h-9 w-9 items-center justify-center rounded bg-surface-2 font-mono text-xs font-bold text-gold">
                    {s.a}
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center justify-between">
                      <span className="text-sm font-semibold">{s.s}</span>
                      <span className="font-mono text-[11px] text-gold">{s.c}%</span>
                    </div>
                    <div className="truncate text-[11px] text-muted-foreground">{s.d}</div>
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="panel p-5">
            <div className="font-semibold">Trend Predictions · 7D</div>
            <div className="mt-4 space-y-3">
              {[
                { a: "BTC/USDT", t: "73,200", p: 8.5 },
                { a: "ETH/USDT", t: "3,820", p: 7.6 },
                { a: "SOL/USDT", t: "212", p: 14.8 },
                { a: "USDT", t: "1.00", p: 0.0 },
              ].map((p) => (
                <div key={p.a} className="flex items-center gap-4 rounded-md border border-border bg-surface px-3 py-3">
                  <div className="flex-1">
                    <div className="text-sm font-semibold">{p.a}</div>
                    <div className="font-mono text-[11px] text-muted-foreground">Target {p.t}</div>
                  </div>
                  <div className="h-10 w-24">
                    <SparkLine data={generateLine(p.a.length + 20)} color="var(--gold)" height={40} />
                  </div>
                  <div className="font-mono text-sm font-semibold text-bull">+{p.p.toFixed(1)}%</div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
      <Footer />
    </div>
  );
}
