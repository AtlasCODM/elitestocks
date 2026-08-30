import { createFileRoute } from "@tanstack/react-router";
import { Header } from "@/components/site/Header";
import { Footer } from "@/components/site/Footer";
import { Ticker } from "@/components/site/Ticker";
import { CandleChart, SparkLine } from "@/components/charts/CandleChart";
import { ASSETS, generateLine, generateOrderBook } from "@/lib/market-data";
import { useState } from "react";
import { Activity, Settings2, Maximize2 } from "lucide-react";

export const Route = createFileRoute("/terminal")({
  head: () => ({
    meta: [
      { title: "Trading Terminal — Elite Stocks " },
      { name: "description", content: "Institutional trading terminal with order book, depth charts, AI signals, and real-time portfolio telemetry." },
    ],
  }),
  component: TerminalPage,
});

function TerminalPage() {
  const [pair, setPair] = useState("BTC/USDT");
  const seed = pair.startsWith("BTC") ? 42 : pair.startsWith("ETH") ? 13 : 22;
  const book = generateOrderBook(seed + 1);

  return (
    <div className="min-h-screen bg-background">
      <Header />
      <Ticker />
      <div className="mx-auto max-w-[1600px] px-3 py-3 lg:px-4">
        {/* Sub header */}
        <div className="mb-3 flex flex-wrap items-center gap-4 rounded-lg border border-border bg-surface px-4 py-3">
          <div className="flex items-center gap-3">
            <div className="flex h-9 w-9 items-center justify-center rounded bg-[#F7931A]/20 text-[#F7931A] font-bold">₿</div>
            <div>
              <div className="font-semibold">{pair}</div>
              <div className="font-mono text-[11px] text-muted-foreground">SPOT · ELITE STOCKS</div>
            </div>
          </div>
          <div className="h-8 w-px bg-border" />
          <Stat label="Last Price" value="67,432.18" color="text-gold" />
          <Stat label="24h Change" value="+2.34%" color="text-bull" />
          <Stat label="24h High" value="68,124.50" />
          <Stat label="24h Low" value="65,890.20" />
          <Stat label="24h Volume" value="28.4B" />
          <Stat label="AI Signal" value="BULLISH 92%" color="text-gold" />
          <div className="ml-auto flex items-center gap-2">
            <button className="rounded border border-border bg-background p-1.5 text-muted-foreground hover:text-foreground">
              <Settings2 className="h-4 w-4" />
            </button>
            <button className="rounded border border-border bg-background p-1.5 text-muted-foreground hover:text-foreground">
              <Maximize2 className="h-4 w-4" />
            </button>
          </div>
        </div>

        <div className="grid gap-3 lg:grid-cols-[200px_280px_1fr_300px]">
          {/* Pair list */}
          <div className="rounded-lg border border-border bg-surface">
            <div className="border-b border-border px-3 py-2 text-[11px] uppercase tracking-wider text-muted-foreground">
              Markets
            </div>
            <div className="max-h-[700px] overflow-y-auto">
              {ASSETS.map((a) => {
                const p = `${a.symbol}/USDT`;
                return (
                  <button
                    key={a.symbol}
                    onClick={() => setPair(p)}
                    className={`flex w-full items-center justify-between border-b border-border px-3 py-2.5 text-left text-xs hover:bg-surface-2 ${pair === p ? "bg-surface-2" : ""}`}
                  >
                    <div>
                      <div className="font-semibold">{p}</div>
                      <div className="font-mono text-[10px] text-muted-foreground">{a.vol24h}</div>
                    </div>
                    <div className="text-right">
                      <div className="font-mono">{a.price.toLocaleString()}</div>
                      <div className={`font-mono text-[10px] ${a.change24h >= 0 ? "text-bull" : "text-bear"}`}>
                        {a.change24h >= 0 ? "+" : ""}{a.change24h.toFixed(2)}%
                      </div>
                    </div>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Order book */}
          <div className="rounded-lg border border-border bg-surface p-3">
            <div className="mb-2 flex items-center justify-between text-[11px] uppercase tracking-wider text-muted-foreground">
              <span>Order Book</span><span>{pair}</span>
            </div>
            <div className="grid grid-cols-3 pb-1 text-[10px] text-muted-foreground">
              <span>Price (USDT)</span><span className="text-right">Size</span><span className="text-right">Total</span>
            </div>
            {book.asks.slice().reverse().map((row, i) => (
              <Row key={`a${i}`} row={row} type="ask" />
            ))}
            <div className="my-2 flex items-center justify-between border-y border-border py-2">
              <span className="font-mono text-base font-bold text-gold">67,432.18</span>
              <span className="font-mono text-[11px] text-bull">+2.34%</span>
            </div>
            {book.bids.map((row, i) => (
              <Row key={`b${i}`} row={row} type="bid" />
            ))}
          </div>

          {/* Chart + form */}
          <div className="flex flex-col gap-3">
            <div className="rounded-lg border border-border bg-surface p-3">
              <div className="flex items-center justify-between text-[11px]">
                <div className="flex gap-2 text-muted-foreground">
                  {["1m", "5m", "15m", "1H", "4H", "1D", "1W"].map((t, i) => (
                    <span key={t} className={`rounded px-1.5 py-0.5 ${i === 3 ? "bg-gold/20 text-gold" : "hover:bg-surface-2 cursor-pointer"}`}>{t}</span>
                  ))}
                </div>
                <span className="font-mono text-muted-foreground">O 65,890 H 68,124 L 65,890 C 67,432</span>
              </div>
              <div className="mt-2 h-[420px]">
                <CandleChart seed={seed} count={100} height={420} />
              </div>
              <div className="mt-2 h-16">
                <SparkLine data={generateLine(seed + 8, 100)} color="var(--gold-muted)" height={64} />
              </div>
            </div>

            <div className="grid gap-3 md:grid-cols-2">
              <OrderForm side="buy" />
              <OrderForm side="sell" />
            </div>
          </div>

          {/* Right column: portfolio + trades */}
          <div className="flex flex-col gap-3">
            <div className="rounded-lg border border-border bg-surface p-4">
              <div className="text-[11px] uppercase tracking-wider text-muted-foreground">Portfolio Value</div>
              <div className="mt-1 font-mono text-2xl font-bold text-gold gold-text-glow">$148,733.03</div>
              <div className="text-[11px] text-bull">+$2,910.42 (1.97%) · 24h</div>
              <div className="mt-3 h-14">
                <SparkLine data={generateLine(91)} color="var(--gold)" height={56} />
              </div>
              <div className="mt-3 grid grid-cols-2 gap-2 text-xs">
                <div>
                  <div className="text-[10px] text-muted-foreground">PnL · Today</div>
                  <div className="font-mono text-bull">+$2,910</div>
                </div>
                <div>
                  <div className="text-[10px] text-muted-foreground">Margin</div>
                  <div className="font-mono">12.4%</div>
                </div>
              </div>
            </div>

            <div className="rounded-lg border border-border bg-surface p-3">
              <div className="mb-2 flex items-center justify-between text-[11px] uppercase tracking-wider text-muted-foreground">
                <span>Trade History</span>
                <span className="flex items-center gap-1 text-bull">
                  <Activity className="h-3 w-3 pulse-dot" /> LIVE
                </span>
              </div>
              <div className="grid grid-cols-3 pb-1 text-[10px] text-muted-foreground">
                <span>Time</span><span className="text-right">Price</span><span className="text-right">Size</span>
              </div>
              <div className="space-y-1 font-mono text-[11px]">
                {Array.from({ length: 18 }).map((_, i) => (
                  <div key={i} className="grid grid-cols-3">
                    <span className="text-muted-foreground">20:{(36 - i).toString().padStart(2, "0")}:{((i * 7) % 60).toString().padStart(2, "0")}</span>
                    <span className={i % 3 === 0 ? "text-bear text-right" : "text-bull text-right"}>{(67432 + (i % 2 ? 1 : -1) * (i * 0.3)).toFixed(2)}</span>
                    <span className="text-right">{(0.012 * (i + 1)).toFixed(3)}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>
      <Footer />
    </div>
  );
}

function Stat({ label, value, color = "text-foreground" }: { label: string; value: string; color?: string }) {
  return (
    <div>
      <div className="text-[10px] uppercase tracking-wider text-muted-foreground">{label}</div>
      <div className={`font-mono text-sm font-semibold ${color}`}>{value}</div>
    </div>
  );
}

function Row({ row, type }: { row: { price: number; size: number; total: number }; type: "bid" | "ask" }) {
  const color = type === "bid" ? "text-bull" : "text-bear";
  const bg = type === "bid" ? "bg-bull/10" : "bg-bear/10";
  return (
    <div className="relative grid grid-cols-3 py-[3px] font-mono text-[11px]">
      <div className={`absolute inset-y-0 right-0 ${bg}`} style={{ width: `${Math.min(100, row.size * 40)}%` }} />
      <span className={`relative ${color}`}>{row.price.toFixed(2)}</span>
      <span className="relative text-right">{row.size.toFixed(3)}</span>
      <span className="relative text-right text-muted-foreground">{row.total.toFixed(0)}</span>
    </div>
  );
}

function OrderForm({ side }: { side: "buy" | "sell" }) {
  const isBuy = side === "buy";
  return (
    <div className="rounded-lg border border-border bg-surface p-3">
      <div className="mb-2 flex items-center justify-between text-[11px] uppercase tracking-wider text-muted-foreground">
        <span>{isBuy ? "Buy / Long" : "Sell / Short"}</span>
        <span>Available: 24,580.12 USDT</span>
      </div>
      <div className="space-y-2 text-xs">
        <div className="flex gap-1">
          {["Limit", "Market", "Stop"].map((t, i) => (
            <button key={t} className={`flex-1 rounded border border-border px-2 py-1 ${i === 0 ? "bg-surface-2 text-foreground" : "text-muted-foreground"}`}>
              {t}
            </button>
          ))}
        </div>
        <Input label="Price (USDT)" value="67,432.18" />
        <Input label="Amount (BTC)" value="0.0050" />
        <Input label="Total (USDT)" value="337.16" />
        <div className="flex gap-1">
          {["25%", "50%", "75%", "100%"].map((p) => (
            <button key={p} className="flex-1 rounded border border-border bg-background py-1 text-[10px] text-muted-foreground hover:bg-surface-2">{p}</button>
          ))}
        </div>
        <button className={`w-full rounded py-2 text-xs font-semibold ${isBuy ? "bg-bull text-background" : "bg-gold text-primary-foreground"}`}>
          {isBuy ? "Buy BTC" : "Sell BTC"}
        </button>
      </div>
    </div>
  );
}

function Input({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <div className="text-[10px] uppercase text-muted-foreground">{label}</div>
      <div className="mt-1 rounded border border-border bg-background px-2 py-1.5 font-mono">{value}</div>
    </div>
  );
}
