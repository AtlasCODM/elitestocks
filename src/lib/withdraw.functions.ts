/* eslint-disable @typescript-eslint/no-explicit-any -- generated Supabase types predate the admin migration. */
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { adjustBalance } from "./platform.server";

const Input = z.object({
  asset: z.enum(["BTC", "ETH", "SOL", "USDT"]),
  amount: z.number().positive().max(1_000_000),
  address: z.string().trim().min(10).max(200),
});

export const createWithdrawal = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => Input.parse(d))
  .handler(async ({ data, context }) => {
    const { data: settings, error: settingsError } = await (supabaseAdmin as any)
      .from("platform_settings")
      .select("min_withdrawal,max_withdrawal")
      .eq("id", true)
      .single();
    if (settingsError) throw new Error("Unable to load withdrawal limits");
    if (
      data.amount < Number(settings.min_withdrawal) ||
      data.amount > Number(settings.max_withdrawal)
    ) {
      throw new Error(
        `Withdrawal must be between ${settings.min_withdrawal} and ${settings.max_withdrawal}`,
      );
    }
    const { userId } = context;
    // Lock funds immediately by debiting the wallet.
    await adjustBalance(userId, data.asset, -data.amount);
    const { data: tx, error } = await supabaseAdmin
      .from("transactions")
      .insert({
        user_id: userId,
        type: "withdrawal",
        amount: data.amount,
        asset: data.asset,
        status: "pending",
        address: data.address,
        metadata: { locked_at: new Date().toISOString() },
      })
      .select()
      .single();
    if (error) {
      // refund on failure
      await adjustBalance(userId, data.asset, data.amount);
      throw new Error(error.message);
    }
    return { id: tx.id, status: tx.status };
  });
