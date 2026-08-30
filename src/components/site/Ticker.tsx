import { TICKER_ITEMS } from "@/lib/market-data";

export function Ticker() {
  const items = [...TICKER_ITEMS, ...TICKER_ITEMS];
  return (
    <div className="overflow-hidden border-y border-border bg-surface/60">
      <div className="ticker-track flex w-max items-center gap-8 py-2.5 font-mono text-xs">
        {items.map((t, i) => (
          <div key={i} className="flex items-center gap-2 whitespace-nowrap">
            <span className="text-muted-foreground">{t.s}</span>
            <span className="text-foreground">{t.p}</span>
            <span className={t.c >= 0 ? "text-bull" : "text-bear"}>
              {t.c >= 0 ? "+" : ""}
              {t.c.toFixed(2)}%
            </span>
            <span className="text-border">|</span>
          </div>
        ))}
      </div>
    </div>
  );
}
