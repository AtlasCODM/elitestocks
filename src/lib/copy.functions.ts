import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { adjustBalance, MIN_INVESTMENT } from "./platform.server";

export const listTraders = createServerFn({ method: "GET" }).handler(async () => {
  const { data, error } = await supabaseAdmin
    .from("traders")
    .select("*")
    .order("roi", { ascending: false });
  if (error) throw new Error(error.message);
  return { traders: data ?? [] };
});

const Input = z.object({
  trader_id: z.string().uuid(),
  amount: z.number().min(MIN_INVESTMENT).max(10_000_000),
});

export const createCopyTrade = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => Input.parse(d))
  .handler(async ({ data, context }) => {
    const { userId } = context;
    const { data: trader, error: te } = await supabaseAdmin
      .from("traders")
      .select("*")
      .eq("id", data.trader_id)
      .single();
    if (te || !trader) throw new Error("Trader not found");

    await adjustBalance(userId, "USDT", -data.amount);
    const matures = new Date(
      Date.now() + trader.duration_days * 86400_000,
    ).toISOString();

    const { data: ct, error } = await supabaseAdmin
      .from("copy_trades")
      .insert({
        user_id: userId,
        trader_id: trader.id,
        amount: data.amount,
        asset: "USDT",
        profit_pct: trader.profit_pct,
        duration_days: trader.duration_days,
        matures_at: matures,
      })
      .select()
      .single();
    if (error) {
      await adjustBalance(userId, "USDT", data.amount);
      throw new Error(error.message);
    }

    await supabaseAdmin.from("transactions").insert({
      user_id: userId,
      type: "copy_trade",
      amount: data.amount,
      asset: "USDT",
      status: "completed",
      reference_id: ct.id,
      metadata: { trader: trader.name, handle: trader.handle, matures_at: matures },
    });

    return { id: ct.id, matures_at: matures };
  });
