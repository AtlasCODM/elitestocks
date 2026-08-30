import { createFileRoute } from "@tanstack/react-router";
import { Header } from "@/components/site/Header";
import { Footer } from "@/components/site/Footer";
import { Ticker } from "@/components/site/Ticker";
import { SparkLine } from "@/components/charts/CandleChart";
import { ASSETS, TICKER_ITEMS, generateLine } from "@/lib/market-data";

export const Route = createFileRoute("/markets")({
  head: () => ({
    meta: [
      { title: "Markets — Elite Stocks" },
      { name: "description", content: "Live market data across spot, perpetuals, and OTC desks." },
    ],
  }),
  component: MarketsPage,
});

function MarketsPage() {
  const all = [
    ...ASSETS.map((a) => ({
      s: `${a.symbol}/USDT`,
      p: a.price.toLocaleString(),
      c: a.change24h,
      v: a.vol24h,
      cap: (a.price * 19_500_000).toLocaleString(undefined, { notation: "compact" }),
    })),
    ...TICKER_ITEMS.slice(3).map((t) => ({
      s: t.s,
      p: t.p,
      c: t.c,
      v: (Math.random() * 5 + 0.5).toFixed(2) + "B",
      cap: (Math.random() * 200 + 10).toFixed(1) + "B",
    })),
  ];
  return (
    <div className="min-h-screen bg-background">
      <Header />
      <Ticker />
      <div className="mx-auto max-w-[1400px] px-4 py-10 lg:px-6">
        <h1 className="font-display text-4xl font-bold tracking-tight">Markets</h1>
        <p className="mt-1 text-sm text-muted-foreground">Live spot · perpetuals · indices</p>

        <div className="mt-8 overflow-hidden rounded-xl border border-border">
          <table className="w-full text-sm">
            <thead className="bg-surface text-[11px] uppercase tracking-wider text-muted-foreground">
              <tr>
                <th className="px-4 py-3 text-left">Pair</th>
                <th className="px-4 py-3 text-right">Last Price</th>
                <th className="px-4 py-3 text-right">24h Change</th>
                <th className="px-4 py-3 text-right">24h Volume</th>
                <th className="px-4 py-3 text-right">Market Cap</th>
                <th className="px-4 py-3 text-right">Chart</th>
              </tr>
            </thead>
            <tbody>
              {all.map((m, i) => (
                <tr key={m.s} className="border-t border-border bg-background hover:bg-surface/50">
                  <td className="px-4 py-3 font-semibold">{m.s}</td>
                  <td className="px-4 py-3 text-right font-mono">{m.p}</td>
                  <td className={`px-4 py-3 text-right font-mono ${m.c >= 0 ? "text-bull" : "text-bear"}`}>
                    {m.c >= 0 ? "+" : ""}{m.c.toFixed(2)}%
                  </td>
                  <td className="px-4 py-3 text-right font-mono text-muted-foreground">{m.v}</td>
                  <td className="px-4 py-3 text-right font-mono text-muted-foreground">{m.cap}</td>
                  <td className="px-4 py-3">
                    <div className="ml-auto h-8 w-28">
                      <SparkLine data={generateLine(i + 17)} color={m.c >= 0 ? "var(--bull)" : "var(--bear)"} height={32} />
                    </div>
                  </td>
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
