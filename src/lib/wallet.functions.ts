import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

export const getWalletState = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase, userId } = context;
    const [wallets, txs, investments, copies] = await Promise.all([
      supabase.from("wallets").select("*").eq("user_id", userId),
      supabase
        .from("transactions")
        .select("*")
        .eq("user_id", userId)
        .order("created_at", { ascending: false })
        .limit(100),
      supabase
        .from("investments")
        .select("*")
        .eq("user_id", userId)
        .order("created_at", { ascending: false }),
      supabase
        .from("copy_trades")
        .select("*, trader:traders(name,handle,badge)")
        .eq("user_id", userId)
        .order("created_at", { ascending: false }),
    ]);
    return {
      wallets: wallets.data ?? [],
      transactions: txs.data ?? [],
      investments: investments.data ?? [],
      copyTrades: copies.data ?? [],
    };
  });
