import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { DEPOSIT_ADDRESSES, type Asset } from "@/lib/platform.server";

const Input = z.object({
  asset: z.enum(["BTC", "ETH", "SOL", "USDT"]),
  amount: z.number().positive().max(1_000_000),
});

export const getDepositAddress = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { asset: Asset }) =>
    z.object({ asset: z.enum(["BTC", "ETH", "SOL", "USDT"]) }).parse(d),
  )
  .handler(async ({ data }) => ({ address: DEPOSIT_ADDRESSES[data.asset] }));

export const confirmDeposit = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => Input.parse(d))
  .handler(async ({ data, context }) => {
    const { userId } = context;
    const { data: tx, error } = await supabaseAdmin
      .from("transactions")
      .insert({
        user_id: userId,
        type: "deposit",
        amount: data.amount,
        asset: data.asset,
        status: "pending_confirmation",
        address: DEPOSIT_ADDRESSES[data.asset],
        metadata: { source: "user_confirm" },
      })
      .select()
      .single();
    if (error) throw new Error(error.message);
    return { id: tx.id, status: tx.status };
  });
