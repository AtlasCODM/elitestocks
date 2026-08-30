// Reference market data feed for charts and tickers.

export type Asset = "BTC" | "ETH" | "SOL" | "USDT";

export const ASSETS: {
  symbol: Asset;
  name: string;
  price: number;
  change24h: number;
  vol24h: string;
  color: string;
}[] = [
  { symbol: "BTC", name: "Bitcoin", price: 67432.18, change24h: 2.34, vol24h: "28.4B", color: "#F7931A" },
  { symbol: "ETH", name: "Ethereum", price: 3548.92, change24h: 1.87, vol24h: "14.2B", color: "#627EEA" },
  { symbol: "SOL", name: "Solana", price: 184.27, change24h: 4.12, vol24h: "4.8B", color: "#9945FF" },
  { symbol: "USDT", name: "Tether", price: 1.0, change24h: 0.01, vol24h: "62.1B", color: "#26A17B" },
];

export const TICKER_ITEMS = [
  { s: "BTC/USDT", p: "67,432.18", c: 2.34 },
  { s: "ETH/USDT", p: "3,548.92", c: 1.87 },
  { s: "SOL/USDT", p: "184.27", c: 4.12 },
  { s: "BNB/USDT", p: "612.40", c: -0.42 },
  { s: "XRP/USDT", p: "0.5821", c: 1.15 },
  { s: "ADA/USDT", p: "0.4612", c: -0.88 },
  { s: "DOGE/USDT", p: "0.1547", c: 3.42 },
  { s: "AVAX/USDT", p: "38.14", c: 2.01 },
  { s: "LINK/USDT", p: "14.92", c: -1.24 },
  { s: "MATIC/USDT", p: "0.7128", c: 0.92 },
  { s: "DOT/USDT", p: "7.45", c: 1.58 },
  { s: "ATOM/USDT", p: "8.92", c: -0.62 },
];

// Seeded RNG for stable chart rendering
function mulberry32(a: number) {
  return function () {
    let t = (a += 0x6d2b79f5);
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function generateCandles(seed = 42, count = 80, start = 67000) {
  const rand = mulberry32(seed);
  let price = start;
  const candles: { o: number; h: number; l: number; c: number }[] = [];
  for (let i = 0; i < count; i++) {
    const drift = (rand() - 0.48) * 220;
    const o = price;
    const c = price + drift;
    const h = Math.max(o, c) + rand() * 90;
    const l = Math.min(o, c) - rand() * 90;
    candles.push({ o, h, l, c });
    price = c;
  }
  return candles;
}

export function generateLine(seed = 7, count = 60) {
  const rand = mulberry32(seed);
  let v = 50;
  return Array.from({ length: count }, () => {
    v += (rand() - 0.5) * 8;
    return Math.max(10, Math.min(95, v));
  });
}

export function generateOrderBook(seed = 11, mid = 67432) {
  const rand = mulberry32(seed);
  const bids = Array.from({ length: 12 }, (_, i) => {
    const price = mid - (i + 1) * (8 + rand() * 6);
    const size = 0.05 + rand() * 1.8;
    return { price, size, total: size * price };
  });
  const asks = Array.from({ length: 12 }, (_, i) => {
    const price = mid + (i + 1) * (8 + rand() * 6);
    const size = 0.05 + rand() * 1.8;
    return { price, size, total: size * price };
  });
  return { bids, asks };
}

export const TRADERS = [
  { name: "Helios Capital", handle: "@helios_cap", roi: 312.4, win: 78.2, aum: "12.4M", followers: 8421, badge: "Pro" },
  { name: "Aurelia Quant", handle: "@aurelia_q", roi: 248.1, win: 71.5, aum: "8.9M", followers: 6212, badge: "Elite" },
  { name: "Northwind Trading", handle: "@northwind", roi: 198.7, win: 69.8, aum: "21.2M", followers: 12940, badge: "Elite" },
  { name: "Vector Alpha", handle: "@vector_a", roi: 172.3, win: 66.1, aum: "4.1M", followers: 3812, badge: "Pro" },
  { name: "Onyx Strategies", handle: "@onyx_strat", roi: 154.9, win: 64.4, aum: "6.7M", followers: 5104, badge: "Pro" },
  { name: "Meridian AI", handle: "@meridian_ai", roi: 141.2, win: 62.7, aum: "9.8M", followers: 7321, badge: "Elite" },
];

export const STRATEGIES = [
  { tier: "Starter", days: 3, roi: 35, min: 500, color: "from-zinc-700 to-zinc-800" },
  { tier: "Growth", days: 7, roi: 45, min: 1500, color: "from-zinc-700 to-zinc-800" },
  { tier: "Boost", days: 14, roi: 55, min: 5000, color: "from-zinc-700 to-zinc-800" },
  { tier: "Pro", days: 21, roi: 68, min: 15000, color: "from-amber-900/40 to-zinc-800" },
  { tier: "Elite", days: 30, roi: 80, min: 50000, color: "from-amber-800/50 to-zinc-800" },
  { tier: "Apex", days: 60, roi: 100, min: 250000, color: "from-amber-700/60 to-zinc-800" },
];
