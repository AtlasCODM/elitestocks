import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { summarizePosition } from "./investment-engine";

export const getWalletState = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const serverNow = new Date().toISOString();
    const userId = context.userId;
    const [wallets, txs, investments, copies] = await Promise.all([
      supabaseAdmin.from("wallets").select("*").eq("user_id", userId),
      supabaseAdmin
        .from("transactions")
        .select("*")
        .eq("user_id", userId)
        .order("created_at", { ascending: false })
        .limit(100),
      supabaseAdmin
        .from("investments")
        .select("*")
        .eq("user_id", userId)
        .order("created_at", { ascending: false }),
      supabaseAdmin
        .from("copy_trades")
        .select("*, trader:traders(name,handle,badge)")
        .eq("user_id", userId)
        .order("created_at", { ascending: false }),
    ]);
    if (wallets.error) throw new Error(wallets.error.message);
    if (txs.error) throw new Error(txs.error.message);
    if (investments.error) throw new Error(investments.error.message);
    if (copies.error) throw new Error(copies.error.message);
    return {
      serverNow,
      wallets: wallets.data ?? [],
      transactions: txs.data ?? [],
      investments: (investments.data ?? []).map((row) => ({
        ...row,
        summary: summarizePosition(row, serverNow),
      })),
      copyTrades: (copies.data ?? []).map((row) => ({
        ...row,
        summary: summarizePosition(row, serverNow),
      })),
    };
  });
