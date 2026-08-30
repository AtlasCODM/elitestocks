import { createFileRoute, Link } from "@tanstack/react-router";
import { Header } from "@/components/site/Header";
import { Footer } from "@/components/site/Footer";
import { Ticker } from "@/components/site/Ticker";
import { CandleChart, SparkLine } from "@/components/charts/CandleChart";
import { generateLine, STRATEGIES, TRADERS } from "@/lib/market-data";
import {
  ArrowRight,
  ArrowUpRight,
  Activity,
  ShieldCheck,
  Cpu,
  Zap,
  Box,
  Network,
  Fingerprint,
  Eye,
  TrendingUp,
  CircuitBoard,
  BarChart3,
} from "lucide-react";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Elite Stocks — Institutional Digital Asset Trading" },
      { name: "description", content: "AI-powered institutional crypto intelligence and trading infrastructure. execution, bank-grade security, elite-tier strategy modules." },
    ],
  }),
  component: HomePage,
});

function HomePage() {
  return (
    <div className="min-h-screen bg-background">
      <Header />
      <Ticker />
      <Hero />
      <GlobalMetrics />
      <EliteServices />
      <TerminalShowcase />
      <AIIntelligence />
      <Strategies />
      <Security />
      <CopyTradingPreview />
      <MobileShowcase />
      <FinalCTA />
      <Footer />
    </div>
  );
}

function Hero() {
  return (
    <section className="relative overflow-hidden">
      <div className="absolute inset-0 grid-bg opacity-60" />
      <div className="absolute inset-0 radial-gold" />
      <div className="absolute -top-32 right-0 h-[500px] w-[500px] rounded-full bg-gold/10 blur-3xl" />

      <div className="relative mx-auto grid max-w-[1600px] gap-10 px-4 py-20 lg:grid-cols-[1.05fr_1fr] lg:px-6 lg:py-28">
        <div className="flex flex-col justify-center">
          <div className="inline-flex w-fit items-center gap-2 rounded-full border border-gold/40 bg-gold/5 px-3 py-1 text-xs text-gold">
            <span className="h-1.5 w-1.5 rounded-full bg-gold pulse-dot" />
            LIVE · Elite Stocks ENGINE
          </div>
          <h1 className="mt-6 font-display text-5xl font-bold leading-[1.05] tracking-tight md:text-6xl lg:text-7xl">
            AI-Powered <span className="text-gold gold-text-glow">Institutional</span><br />
            Crypto Intelligence System
          </h1>
          <p className="mt-6 max-w-xl text-base text-muted-foreground md:text-lg">
            execution, bank-grade custody, and real-time AI signal
            infrastructure — engineered for funds, treasuries, and elite traders.
          </p>
          <div className="mt-8 flex flex-wrap gap-3">
            <Link
              to="/terminal"
              className="group inline-flex items-center gap-2 rounded-md bg-gold px-5 py-3 text-sm font-semibold text-primary-foreground hover:brightness-110"
            >
              Enter Trading Terminal
              <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-0.5" />
            </Link>
            <Link
              to="/wallet"
              className="inline-flex items-center gap-2 rounded-md border border-border bg-surface px-5 py-3 text-sm font-semibold hover:bg-surface-2"
            >
              Open Portfolio System
            </Link>
          </div>

          <div className="mt-12 grid grid-cols-3 gap-6 border-t border-border pt-6">
            {[
              { l: "Daily Volume", v: "$50B+" },
              { l: "Active Traders", v: "10M+" },
              { l: "Uptime", v: "99.99%" },
            ].map((s) => (
              <div key={s.l}>
                <div className="font-display text-2xl font-bold text-gold md:text-3xl">{s.v}</div>
                <div className="mt-1 text-xs uppercase tracking-wider text-muted-foreground">{s.l}</div>
              </div>
            ))}
          </div>
        </div>

        <div className="relative">
          <div className="panel relative overflow-hidden p-4">
            <div className="flex items-center justify-between border-b border-border pb-3">
              <div className="flex items-center gap-3">
                <div className="flex h-8 w-8 items-center justify-center rounded bg-[#F7931A]/20 text-xs font-bold text-[#F7931A]">
                  ₿
                </div>
                <div>
                  <div className="text-sm font-semibold">BTC/USDT</div>
                  <div className="font-mono text-[11px] text-muted-foreground">SPOT · BINANCE</div>
                </div>
              </div>
              <div className="text-right">
                <div className="font-mono text-lg font-bold">67,432.18</div>
                <div className="text-xs text-bull">+2.34% · 24h</div>
              </div>
            </div>
            <div className="mt-3 flex gap-2 text-[11px] text-muted-foreground">
              {["1m", "5m", "15m", "1H", "4H", "1D", "1W"].map((t, i) => (
                <span
                  key={t}
                  className={`rounded px-1.5 py-0.5 ${i === 3 ? "bg-gold/20 text-gold" : "hover:bg-surface-2"}`}
                >
                  {t}
                </span>
              ))}
            </div>
            <div className="mt-2 h-[320px]">
              <CandleChart seed={42} count={80} height={320} />
            </div>
            <div className="mt-3 grid grid-cols-4 gap-2 border-t border-border pt-3 font-mono text-[11px]">
              {[
                ["24h High", "68,124.50"],
                ["24h Low", "65,890.20"],
                ["24h Vol", "28.4B"],
                ["AI Signal", "BULLISH"],
              ].map(([l, v], i) => (
                <div key={l}>
                  <div className="text-muted-foreground">{l}</div>
                  <div className={i === 3 ? "text-gold font-semibold" : "text-foreground"}>{v}</div>
                </div>
              ))}
            </div>
          </div>

          {/* floating signal card */}
          <div className="panel-glass absolute -right-4 -bottom-6 hidden w-64 p-3 md:block gold-glow">
            <div className="flex items-center justify-between">
              <div className="text-[10px] uppercase tracking-wider text-muted-foreground">AI Signal</div>
              <span className="rounded bg-bull/15 px-1.5 py-0.5 text-[10px] font-semibold text-bull">+14.2%</span>
            </div>
            <div className="mt-1 font-display text-lg font-bold">Strong Buy · ETH</div>
            <div className="mt-1 font-mono text-[11px] text-muted-foreground">Confidence 92% · 4H</div>
            <div className="mt-2 h-10">
              <SparkLine data={generateLine(99)} color="var(--bull)" height={40} />
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

function GlobalMetrics() {
  return (
    <section className="relative border-y border-border bg-surface/30 py-20">
      <div className="absolute inset-0 grid-bg opacity-40" />
      <div className="relative mx-auto max-w-[1600px] px-6 text-center">
        <h2 className="font-display text-5xl font-bold tracking-tight md:text-7xl">GLOBAL METRICS</h2>
        <p className="mx-auto mt-3 max-w-xl text-sm text-muted-foreground">
          numbers. Continuous infrastructure. Zero compromise.
        </p>
        <div className="mt-12 grid gap-px overflow-hidden rounded-xl border border-border bg-border md:grid-cols-3">
          {[
            { v: "$50B+", l: "Daily Volume" },
            { v: "10M+", l: "Active Traders" },
            { v: "99.99%", l: "Uptime" },
          ].map((m) => (
            <div key={m.l} className="bg-background p-12">
              <div className="font-display text-6xl font-bold text-gold gold-text-glow md:text-7xl">
                {m.v}
              </div>
              <div className="mt-3 text-sm uppercase tracking-widest text-foreground/80">{m.l}</div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

function EliteServices() {
  const services = [
    { icon: Box, title: "Spot Market", desc: "Instant execution and direct asset ownership across BTC, ETH, SOL, USDT." },
    { icon: Zap, title: "Perpetual Futures", desc: "Leveraged trading with no expiration, deep liquidity pools, and AI-managed risk." },
    { icon: Network, title: "OTC Block Trading", desc: "Large-volume off-exchange settlements with white-glove desk service." },
  ];
  return (
    <section className="relative py-24">
      <div className="mx-auto max-w-[1600px] px-6">
        <div className="mb-12">
          <h2 className="font-display text-4xl font-bold tracking-tight md:text-6xl">
            <span className="text-gold">ELITE TRADING</span><br />SERVICES
          </h2>
        </div>
        <div className="grid gap-6 md:grid-cols-3">
          {services.map((s) => (
            <div
              key={s.title}
              className="group panel relative overflow-hidden p-8 transition-all hover:border-gold/60 hover:gold-glow"
            >
              <div className="pointer-events-none absolute inset-0 grid-bg-sm opacity-20" />
              <div className="relative">
                <div className="inline-flex h-14 w-14 items-center justify-center rounded-lg border border-gold/40 bg-gold/5 text-gold">
                  <s.icon className="h-7 w-7" />
                </div>
                <h3 className="mt-6 font-display text-xl font-bold uppercase tracking-wide text-gold">
                  {s.title}
                </h3>
                <p className="mt-3 text-sm text-muted-foreground">{s.desc}</p>
                <div className="mt-6 flex items-center gap-2 text-xs text-foreground/70">
                  Learn more <ArrowUpRight className="h-3.5 w-3.5" />
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

function TerminalShowcase() {
  return (
    <section className="relative border-y border-border bg-surface/40 py-24">
      <div className="absolute inset-0 grid-bg opacity-30" />
      <div className="relative mx-auto max-w-[1600px] px-6">
        <div className="text-center">
          <h2 className="font-display text-4xl font-bold text-gold gold-text-glow md:text-6xl">
            ADVANCED TERMINAL
          </h2>
          <p className="mx-auto mt-3 max-w-2xl text-sm text-muted-foreground">
            Bloomberg-grade institutional dashboard with order routing, AI-augmented
            depth analysis, and millisecond-class execution telemetry.
          </p>
        </div>

        <div className="mt-12 panel relative overflow-hidden p-3 gold-glow">
          <div className="grid grid-cols-[280px_1fr_280px] gap-3 overflow-hidden rounded-md">
            {/* left: order book */}
            <div className="bg-surface p-3">
              <div className="mb-2 flex items-center justify-between text-[11px] uppercase tracking-wider text-muted-foreground">
                <span>Order Book</span><span>BTC/USDT</span>
              </div>
              <div className="grid grid-cols-3 pb-1 text-[10px] text-muted-foreground">
                <span>Price</span><span className="text-right">Size</span><span className="text-right">Total</span>
              </div>
              {/* asks */}
              {Array.from({ length: 10 }).map((_, i) => (
                <div key={`a${i}`} className="relative grid grid-cols-3 py-[2px] font-mono text-[11px]">
                  <div className="absolute inset-y-0 right-0 bg-bear/10" style={{ width: `${(10 - i) * 8}%` }} />
                  <span className="relative text-bear">{(67560 - i * 4).toFixed(2)}</span>
                  <span className="relative text-right">{(0.12 + i * 0.08).toFixed(3)}</span>
                  <span className="relative text-right text-muted-foreground">{((0.12 + i * 0.08) * 67500).toFixed(0)}</span>
                </div>
              ))}
              <div className="my-2 flex items-center justify-between border-y border-border py-1.5 font-mono text-xs">
                <span className="text-gold font-semibold">67,432.18</span>
                <span className="text-bull text-[10px]">↑ 2.34%</span>
              </div>
              {Array.from({ length: 10 }).map((_, i) => (
                <div key={`b${i}`} className="relative grid grid-cols-3 py-[2px] font-mono text-[11px]">
                  <div className="absolute inset-y-0 right-0 bg-bull/10" style={{ width: `${(10 - i) * 8}%` }} />
                  <span className="relative text-bull">{(67410 - i * 4).toFixed(2)}</span>
                  <span className="relative text-right">{(0.18 + i * 0.06).toFixed(3)}</span>
                  <span className="relative text-right text-muted-foreground">{((0.18 + i * 0.06) * 67400).toFixed(0)}</span>
                </div>
              ))}
            </div>

            {/* center: chart */}
            <div className="flex flex-col gap-3">
              <div className="bg-surface p-3">
                <div className="flex items-center justify-between text-[11px]">
                  <div className="flex items-center gap-3">
                    <span className="text-foreground font-semibold">BTC/USDT</span>
                    <span className="font-mono text-bull">+2.34%</span>
                    <span className="text-muted-foreground">O 65,890 H 68,124 L 65,890 C 67,432</span>
                  </div>
                  <div className="flex gap-2 text-muted-foreground">
                    <span>1m</span><span>5m</span><span className="text-gold">15m</span><span>1H</span><span>4H</span><span>1D</span>
                  </div>
                </div>
                <div className="mt-2 h-[280px]">
                  <CandleChart seed={11} count={90} height={280} />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="bg-surface p-3">
                  <div className="mb-2 text-[11px] uppercase tracking-wider text-muted-foreground">Trade Items</div>
                  <div className="space-y-2 text-xs">
                    <Field label="Price" v="67,432.18" suffix="USDT" />
                    <Field label="Amount" v="0.0050" suffix="BTC" />
                    <Field label="Total" v="337.16" suffix="USDT" />
                    <button className="w-full rounded bg-bull py-2 text-xs font-semibold text-background">Buy / Long</button>
                  </div>
                </div>
                <div className="bg-surface p-3">
                  <div className="mb-2 text-[11px] uppercase tracking-wider text-muted-foreground">Sell Order</div>
                  <div className="space-y-2 text-xs">
                    <Field label="Price" v="67,440.00" suffix="USDT" />
                    <Field label="Amount" v="0.0050" suffix="BTC" />
                    <Field label="Total" v="337.20" suffix="USDT" />
                    <button className="w-full rounded bg-gold py-2 text-xs font-semibold text-primary-foreground">Sell / Short</button>
                  </div>
                </div>
              </div>
            </div>

            {/* right: portfolio + trades */}
            <div className="flex flex-col gap-3">
              <div className="bg-surface p-3">
                <div className="text-[11px] uppercase tracking-wider text-muted-foreground">Portfolio Value</div>
                <div className="mt-1 font-mono text-2xl font-bold text-gold">$148,733.03</div>
                <div className="mt-1 text-[11px] text-bull">+$2,910.42 (1.97%)</div>
              </div>
              <div className="bg-surface p-3">
                <div className="mb-2 text-[11px] uppercase tracking-wider text-muted-foreground">Market Depth</div>
                <div className="h-20">
                  <SparkLine data={generateLine(33)} color="var(--gold)" height={80} />
                </div>
              </div>
              <div className="bg-surface p-3">
                <div className="mb-2 text-[11px] uppercase tracking-wider text-muted-foreground">Trade History</div>
                <div className="space-y-1 font-mono text-[11px]">
                  {Array.from({ length: 9 }).map((_, i) => (
                    <div key={i} className="grid grid-cols-3">
                      <span className="text-muted-foreground">20:{(36 - i).toString().padStart(2, "0")}:0{(i + 2) % 9}</span>
                      <span className={i % 2 ? "text-bear text-right" : "text-bull text-right"}>{(67432 + i * 1.2).toFixed(2)}</span>
                      <span className="text-right text-foreground">{(0.012 * (i + 1)).toFixed(3)}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </div>
        <div className="mt-6 text-center">
          <Link
            to="/terminal"
            className="inline-flex items-center gap-2 rounded-md border border-gold/40 bg-gold/5 px-5 py-2.5 text-sm font-semibold text-gold hover:bg-gold/10"
          >
            Launch Full Terminal <ArrowRight className="h-4 w-4" />
          </Link>
        </div>
      </div>
    </section>
  );
}

function Field({ label, v, suffix }: { label: string; v: string; suffix?: string }) {
  return (
    <div>
      <div className="text-[10px] uppercase text-muted-foreground">{label}</div>
      <div className="mt-1 flex items-center justify-between rounded border border-border bg-background px-2 py-1.5 font-mono">
        <span>{v}</span>
        {suffix && <span className="text-[10px] text-muted-foreground">{suffix}</span>}
      </div>
    </div>
  );
}

function AIIntelligence() {
  return (
    <section className="relative overflow-hidden py-24">
      <div className="absolute inset-0 grid-bg opacity-30" />
      <div className="absolute -left-32 top-1/2 h-[400px] w-[400px] -translate-y-1/2 rounded-full bg-gold/10 blur-3xl" />
      <div className="relative mx-auto max-w-[1600px] px-6">
        <div className="grid items-center gap-12 lg:grid-cols-2">
          <div>
            <div className="text-xs uppercase tracking-widest text-gold">AI MARKET INTELLIGENCE</div>
            <h2 className="mt-3 font-display text-4xl font-bold tracking-tight md:text-5xl">
              Sentiment, volatility, and prediction —<br />
              <span className="text-gold">unified into one signal stream.</span>
            </h2>
            <p className="mt-4 max-w-lg text-sm text-muted-foreground">
              Elite Stock's intelligence engine continuously fuses on-chain telemetry,
              orderflow microstructure, and large-language sentiment models into
              trading signals.
            </p>

            <div className="mt-8 grid grid-cols-2 gap-4">
              {[
                { i: Cpu, l: "Models live", v: "184" },
                { i: Activity, l: "Signals / hr", v: "2,418" },
                { i: TrendingUp, l: "Avg confidence", v: "87.3%" },
                { i: CircuitBoard, l: "On-chain feeds", v: "62" },
              ].map((m) => (
                <div key={m.l} className="panel flex items-center gap-3 p-4">
                  <div className="rounded-md border border-gold/30 bg-gold/5 p-2 text-gold">
                    <m.i className="h-4 w-4" />
                  </div>
                  <div>
                    <div className="font-display text-xl font-bold">{m.v}</div>
                    <div className="text-[11px] uppercase tracking-wider text-muted-foreground">{m.l}</div>
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="panel relative p-5">
            <div className="flex items-center justify-between text-xs">
              <span className="font-semibold text-gold">AI Signal Stream</span>
              <span className="flex items-center gap-1.5 text-muted-foreground">
                <span className="h-1.5 w-1.5 rounded-full bg-bull pulse-dot" /> LIVE
              </span>
            </div>
            <div className="mt-4 space-y-2.5">
              {[
                { a: "BTC", s: "Strong Buy", c: 92, d: "Orderflow accumulation + LLM sentiment shift +14.2%" },
                { a: "ETH", s: "Buy", c: 87, d: "Bullish divergence on 4H · liquidity sweep above 3580" },
                { a: "SOL", s: "Neutral", c: 64, d: "Range-bound · awaiting macro print" },
                { a: "USDT", s: "Stable", c: 99, d: "Peg integrity nominal · vol drift < 0.02%" },
              ].map((s) => (
                <div key={s.a} className="flex items-center gap-3 rounded-md border border-border bg-surface px-3 py-2.5">
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

            <div className="mt-4 grid grid-cols-7 gap-1">
              {Array.from({ length: 35 }).map((_, i) => {
                const v = ((i * 37) % 100) / 100;
                return (
                  <div
                    key={i}
                    className="aspect-square rounded-sm"
                    style={{
                      background: `color-mix(in oklab, var(--gold) ${Math.round(v * 80)}%, var(--surface-3))`,
                    }}
                  />
                );
              })}
            </div>
            <div className="mt-2 flex items-center justify-between text-[10px] uppercase tracking-wider text-muted-foreground">
              <span>Volatility Heatmap</span><span>7 × 5 · 24h</span>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

function Strategies() {
  return (
    <section className="relative border-y border-border bg-surface/30 py-24">
      <div className="mx-auto max-w-[1600px] px-6">
        <div className="flex flex-col items-end justify-between gap-4 md:flex-row">
          <div>
            <div className="text-xs uppercase tracking-widest text-gold">INVESTMENT STRATEGY MODULES</div>
            <h2 className="mt-3 font-display text-4xl font-bold tracking-tight md:text-5xl">
              yield tiers
            </h2>
          </div>
          <p className="max-w-md text-sm text-muted-foreground">
            Fixed-term yield contracts. Each tier defines a fixed runtime and profit target.
          </p>
        </div>

        <div className="mt-10 grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {STRATEGIES.map((s, i) => (
            <div
              key={s.tier}
              className={`group panel relative overflow-hidden bg-gradient-to-br ${s.color} p-6 transition-all hover:border-gold/60`}
            >
              <div className="pointer-events-none absolute inset-0 grid-bg-sm opacity-20" />
              <div className="relative flex items-start justify-between">
                <div>
                  <div className="text-[11px] uppercase tracking-widest text-muted-foreground">
                    Tier {i + 1}
                  </div>
                  <div className="mt-1 font-display text-3xl font-bold">{s.tier}</div>
                </div>
                <span className="rounded border border-gold/40 bg-gold/10 px-2 py-1 font-mono text-[11px] text-gold">
                  {s.days}D
                </span>
              </div>
              <div className="relative mt-6 flex items-end justify-between">
                <div>
                  <div className="text-[11px] uppercase text-muted-foreground">Target Return</div>
                  <div className="font-display text-4xl font-bold text-gold gold-text-glow">
                    {s.roi}%
                  </div>
                </div>
                <div className="text-right text-[11px] text-muted-foreground">
                  <div>Min entry</div>
                  <div className="font-mono text-foreground">${s.min.toLocaleString()}</div>
                </div>
              </div>
              <Link
                to="/strategies"
                className="relative mt-6 flex items-center justify-between rounded-md border border-border bg-background/40 px-3 py-2 text-xs font-semibold transition-colors group-hover:border-gold/50 group-hover:text-gold"
              >
                Activate strategy
                <ArrowRight className="h-3.5 w-3.5" />
              </Link>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

function Security() {
  return (
    <section className="relative overflow-hidden py-24">
      <div className="absolute inset-0 grid-bg opacity-30" />
      <div className="relative mx-auto max-w-[1600px] px-6">
        <div className="grid items-center gap-12 lg:grid-cols-2">
          <div className="order-2 lg:order-1">
            <div className="panel relative aspect-square max-w-md overflow-hidden p-8">
              <div className="absolute inset-0 grid-bg-sm opacity-30" />
              <div className="absolute inset-0 flex items-center justify-center">
                <div className="relative">
                  <div className="absolute inset-0 rounded-full bg-gold/20 blur-3xl" />
                  <svg viewBox="0 0 200 220" className="relative h-72 w-72">
                    <defs>
                      <linearGradient id="shield" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor="oklch(0.9 0.18 92)" stopOpacity="0.9" />
                        <stop offset="100%" stopColor="oklch(0.7 0.16 80)" stopOpacity="0.4" />
                      </linearGradient>
                    </defs>
                    <path
                      d="M100 10 L180 40 L180 120 Q180 180 100 210 Q20 180 20 120 L20 40 Z"
                      fill="url(#shield)"
                      stroke="var(--gold)"
                      strokeWidth="2"
                      opacity="0.95"
                    />
                    <g transform="translate(80,90)" fill="var(--background)">
                      <rect x="6" y="18" width="28" height="22" rx="3" />
                      <path d="M11 18 V12 a9 9 0 0 1 18 0 V18" fill="none" stroke="var(--background)" strokeWidth="3" />
                    </g>
                    {/* circuit lines */}
                    <g stroke="var(--gold)" strokeWidth="0.6" opacity="0.7">
                      <path d="M40 60 L70 60 L70 90" fill="none" />
                      <path d="M160 70 L130 70 L130 100" fill="none" />
                      <path d="M50 140 L90 140 L90 170" fill="none" />
                      <path d="M150 150 L110 150 L110 175" fill="none" />
                    </g>
                  </svg>
                </div>
              </div>
            </div>
          </div>

          <div className="order-1 lg:order-2">
            <h2 className="font-display text-4xl font-bold uppercase tracking-tight text-gold gold-text-glow md:text-5xl">
              Infrastructure & Security
            </h2>
            <p className="mt-4 max-w-lg text-sm text-muted-foreground">
              Multi-layered custody architecture engineered against state-level threat models.
              Every withdrawal passes through a policy engine.
            </p>
            <div className="mt-8 space-y-4">
              {[
                { i: ShieldCheck, t: "Bank-Grade Cold Storage", d: "98% of assets held in geo-distributed air-gapped vaults" },
                { i: Fingerprint, t: "Multi-Signature Vaults", d: "Threshold-signed custody · M-of-N approval workflow" },
                { i: Eye, t: "Real-time Threat Monitoring", d: "24/7 SOC, behavioral anomaly detection, on-chain forensics" },
              ].map((f) => (
                <div key={f.t} className="flex gap-4 border-l-2 border-gold/60 pl-4">
                  <div className="rounded-md border border-gold/30 bg-gold/5 p-2 text-gold">
                    <f.i className="h-5 w-5" />
                  </div>
                  <div>
                    <div className="text-base font-semibold">{f.t}</div>
                    <div className="mt-0.5 text-sm text-muted-foreground">{f.d}</div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

function CopyTradingPreview() {
  return (
    <section className="border-y border-border bg-surface/30 py-24">
      <div className="mx-auto max-w-[1600px] px-6">
        <div className="flex flex-col items-end justify-between gap-4 md:flex-row">
          <div>
            <div className="text-xs uppercase tracking-widest text-gold">COPY TRADING</div>
            <h2 className="mt-3 font-display text-4xl font-bold tracking-tight md:text-5xl">
              Follow elite traders
            </h2>
          </div>
          <Link to="/copy-trading" className="text-sm font-semibold text-gold hover:underline">
            View full leaderboard →
          </Link>
        </div>

        <div className="mt-10 overflow-hidden rounded-xl border border-border">
          <table className="w-full">
            <thead className="bg-surface text-[11px] uppercase tracking-wider text-muted-foreground">
              <tr>
                <th className="px-4 py-3 text-left">Rank</th>
                <th className="px-4 py-3 text-left">Trader</th>
                <th className="px-4 py-3 text-right">ROI · 30D</th>
                <th className="px-4 py-3 text-right">Win Rate</th>
                <th className="px-4 py-3 text-right">AUM</th>
                <th className="px-4 py-3 text-right">Followers</th>
                <th className="px-4 py-3 text-right">Equity</th>
                <th className="px-4 py-3 text-right"></th>
              </tr>
            </thead>
            <tbody className="text-sm">
              {TRADERS.map((t, i) => (
                <tr key={t.handle} className="border-t border-border bg-background hover:bg-surface/60">
                  <td className="px-4 py-4 font-mono text-muted-foreground">#{i + 1}</td>
                  <td className="px-4 py-4">
                    <div className="flex items-center gap-3">
                      <div className="flex h-9 w-9 items-center justify-center rounded-full border border-gold/30 bg-gold/5 font-mono text-xs font-bold text-gold">
                        {t.name.split(" ").map((s) => s[0]).join("").slice(0, 2)}
                      </div>
                      <div>
                        <div className="font-semibold">{t.name}</div>
                        <div className="text-[11px] text-muted-foreground">{t.handle} · <span className="text-gold">{t.badge}</span></div>
                      </div>
                    </div>
                  </td>
                  <td className="px-4 py-4 text-right font-mono font-semibold text-bull">+{t.roi.toFixed(1)}%</td>
                  <td className="px-4 py-4 text-right font-mono">{t.win.toFixed(1)}%</td>
                  <td className="px-4 py-4 text-right font-mono">${t.aum}</td>
                  <td className="px-4 py-4 text-right font-mono text-muted-foreground">{t.followers.toLocaleString()}</td>
                  <td className="px-4 py-4">
                    <div className="ml-auto h-8 w-28">
                      <SparkLine data={generateLine(i + 5)} color="var(--bull)" height={32} />
                    </div>
                  </td>
                  <td className="px-4 py-4 text-right">
                    <button className="rounded-md border border-gold/40 bg-gold/5 px-3 py-1.5 text-xs font-semibold text-gold hover:bg-gold/10">
                      Copy
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </section>
  );
}

function MobileShowcase() {
  return (
    <section className="relative overflow-hidden py-24">
      <div className="absolute inset-0 grid-bg opacity-30" />
      <div className="relative mx-auto max-w-[1600px] px-6 text-center">
        <h2 className="font-display text-5xl font-bold uppercase tracking-tight md:text-6xl">
          The Market In Your Pocket
        </h2>
        <p className="mt-3 text-base text-gold">Seamless mobile trading</p>

        <div className="mt-16 flex flex-wrap items-center justify-center gap-12">
          <Phone variant="dashboard" />
          <Phone variant="assets" />
        </div>
      </div>
    </section>
  );
}

function Phone({ variant }: { variant: "dashboard" | "assets" }) {
  return (
    <div className="relative">
      <div className="absolute -inset-8 rounded-[60px] bg-gold/10 blur-3xl" />
      <div className="relative h-[560px] w-[280px] rounded-[44px] border border-zinc-700 bg-zinc-900 p-2 shadow-2xl">
        <div className="absolute left-1/2 top-2 z-10 h-6 w-24 -translate-x-1/2 rounded-full bg-zinc-950" />
        <div className="h-full w-full overflow-hidden rounded-[36px] bg-background">
          {/* status */}
          <div className="flex items-center justify-between px-5 pt-3 text-[10px] text-muted-foreground">
            <span className="font-mono">9:41</span><span>· · ·</span>
          </div>

          {/* gold header */}
          <div className="mx-3 mt-3 rounded-2xl bg-gold p-4 text-primary-foreground">
            <div className="text-[10px] uppercase tracking-wider opacity-70">Portfolio Balance</div>
            <div className="font-display text-2xl font-bold">
              {variant === "dashboard" ? "$125,450.00" : "$14,500.00"}
            </div>
            <div className="mt-3 flex gap-2">
              <span className="rounded-full bg-background/15 px-2.5 py-1 text-[10px] font-semibold">
                {variant === "dashboard" ? "Deposit" : "Followed"}
              </span>
              <span className="rounded-full bg-background/15 px-2.5 py-1 text-[10px] font-semibold">
                {variant === "dashboard" ? "Trade" : "Pending"}
              </span>
            </div>
          </div>

          {variant === "dashboard" ? (
            <>
              <div className="mx-3 mt-3 rounded-xl bg-surface p-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <div className="flex h-6 w-6 items-center justify-center rounded-full bg-[#F7931A]/20 text-[10px] font-bold text-[#F7931A]">₿</div>
                    <span className="text-xs font-semibold">BTC/USD</span>
                  </div>
                  <span className="font-mono text-[10px] text-bull">+2.34%</span>
                </div>
                <div className="mt-2 h-20">
                  <SparkLine data={generateLine(13)} color="var(--gold)" height={80} />
                </div>
              </div>
              <div className="mx-3 mt-3">
                <div className="text-[10px] uppercase tracking-wider text-muted-foreground">Recent Transactions</div>
                <div className="mt-2 space-y-1.5">
                  {["BTC", "ETH", "SOL"].map((a, i) => (
                    <div key={a} className="flex items-center justify-between rounded bg-surface px-2.5 py-2 text-[11px]">
                      <span className="font-semibold">{a}/USD</span>
                      <span className="font-mono text-bull">+0.005 {a}</span>
                    </div>
                  ))}
                </div>
              </div>
            </>
          ) : (
            <div className="mx-3 mt-3">
              <div className="text-[10px] uppercase tracking-wider text-muted-foreground">Followed Assets</div>
              <div className="mt-2 space-y-1.5">
                {[
                  { a: "BTC", v: "+$5,869.30", p: "+4.21%" },
                  { a: "ETH", v: "+$1,258.82", p: "+1.95%" },
                  { a: "SOL", v: "-$28.26", p: "-0.62%" },
                ].map((r) => (
                  <div key={r.a} className="flex items-center justify-between rounded bg-surface px-2.5 py-2.5 text-[11px]">
                    <span className="font-semibold">{r.a}/USD</span>
                    <div className="text-right font-mono">
                      <div className={r.v.startsWith("+") ? "text-bull" : "text-bear"}>{r.v}</div>
                      <div className="text-[10px] text-muted-foreground">{r.p}</div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          <div className="absolute inset-x-0 bottom-2 mx-5 flex items-center justify-around rounded-full bg-surface-2 py-2 text-muted-foreground">
            <BarChart3 className="h-4 w-4" />
            <Activity className="h-4 w-4 text-gold" />
            <Box className="h-4 w-4" />
            <Eye className="h-4 w-4" />
          </div>
        </div>
      </div>
    </div>
  );
}

function FinalCTA() {
  return (
    <section className="relative overflow-hidden py-32">
      <div className="absolute inset-0 grid-bg opacity-30" />
      <div className="absolute left-1/2 top-1/2 h-[400px] w-[700px] -translate-x-1/2 -translate-y-1/2 rounded-full bg-gold/15 blur-3xl" />
      <div className="relative mx-auto max-w-3xl px-6 text-center">
        <h2 className="font-display text-5xl font-bold uppercase tracking-tight md:text-7xl">
          Begin Your Journey
        </h2>
        <p className="mx-auto mt-4 max-w-md text-sm text-muted-foreground">
          Onboard with institutional white-glove service. Custody, compliance,
          and execution — all in one platform.
        </p>
        <div className="mt-10 flex justify-center">
          <Link
            to="/wallet"
            className="group relative inline-flex items-center gap-2 rounded-md bg-gold px-8 py-4 text-sm font-bold uppercase tracking-wider text-primary-foreground gold-glow transition-all hover:brightness-110"
          >
            Open Institutional Account
            <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-1" />
          </Link>
        </div>
        <div className="mt-8 flex items-center justify-center gap-6 text-xs text-muted-foreground">
          <span>elite.stocks</span>
          <span className="text-border">·</span>
          <span>contactelitestocks.cc</span>
        </div>
      </div>
    </section>
  );
}
