/* eslint-disable @typescript-eslint/no-explicit-any -- workspace columns are additive to generated legacy types. */
import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { summarizePosition } from "./investment-engine";

export const getWalletState = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const serverNow = new Date().toISOString();
    const userId = context.userId;
    const client = context.supabase as any;
    const [wallets, txs, investments, copies] = await Promise.all([
      client
        .from("wallets")
        .select("*")
        .eq("workspace_id", context.workspaceId)
        .eq("user_id", userId),
      client
        .from("transactions")
        .select("*")
        .eq("workspace_id", context.workspaceId)
        .eq("user_id", userId)
        .order("created_at", { ascending: false })
        .limit(100),
      client
        .from("investments")
        .select("*")
        .eq("workspace_id", context.workspaceId)
        .eq("user_id", userId)
        .order("created_at", { ascending: false }),
      client
        .from("copy_trades")
        .select("*, trader:traders(name,handle,badge)")
        .eq("workspace_id", context.workspaceId)
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
      investments: (investments.data ?? []).map((row: any) => ({
        ...row,
        summary: summarizePosition(row, serverNow),
      })),
      copyTrades: (copies.data ?? []).map((row: any) => ({
        ...row,
        summary: summarizePosition(row, serverNow),
      })),
    };
  });
