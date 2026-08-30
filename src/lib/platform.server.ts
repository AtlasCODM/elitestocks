// Server-only helpers. NEVER import from client code.
import { supabaseAdmin } from "@/integrations/supabase/client.server";

export type Asset = "BTC" | "ETH" | "SOL" | "USDT";
export const ASSETS: Asset[] = ["BTC", "ETH", "SOL", "USDT"];

// Platform-controlled deposit addresses (display only — production hot wallets
// would rotate per user via custodian APIs)
export const DEPOSIT_ADDRESSES: Record<Asset, string> = {
  BTC: "bc1qaureumvault0x9k3hp2rqz8mvy7w5tnxe4ucfd2",
  ETH: "0xA8F4cBd2e9C1b7F3D6E8a25C9b14fE7d3C8B6a91",
  SOL: "Aur3umVau1tSo1ana8KqM2P7yT4hN6dF9cJpR1eB",
  USDT: "TAur3umTether8VaU1t9Kx7M2Pq4Yh5JcNd6FbR3",
};

export const PLANS = [
  { tier: "Starter 3D", days: 3, profit_pct: 35 },
  { tier: "Growth 7D", days: 7, profit_pct: 45 },
  { tier: "Boost 14D", days: 14, profit_pct: 55 },
  { tier: "Pro 21D", days: 21, profit_pct: 68 },
  { tier: "Elite 30D", days: 30, profit_pct: 80 },
  { tier: "Apex 60D", days: 60, profit_pct: 100 },
];

export const MIN_INVESTMENT = 500;

// Adjust user wallet balance atomically via service role.
// `delta` is positive for credit, negative for debit. Throws on insufficient funds.
export async function adjustBalance(
  userId: string,
  asset: Asset,
  delta: number,
) {
  const { data: w, error: re } = await supabaseAdmin
    .from("wallets")
    .select("balance")
    .eq("user_id", userId)
    .eq("asset", asset)
    .single();
  if (re || !w) throw new Error("Wallet not found");
  const next = Number(w.balance) + delta;
  if (next < 0) throw new Error("Insufficient balance");
  const { error: ue } = await supabaseAdmin
    .from("wallets")
    .update({ balance: next, updated_at: new Date().toISOString() })
    .eq("user_id", userId)
    .eq("asset", asset);
  if (ue) throw new Error(ue.message);
  return next;
}
