import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { FinancialAmountSchema } from "./financial-amount";

const Input = z.object({
  asset: z.enum(["BTC", "ETH", "SOL", "USDT"]),
  amount: FinancialAmountSchema,
  address: z.string().trim().min(10).max(200),
});

export const createWithdrawal = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => Input.parse(d))
  .handler(async ({ data, context }) => {
    const { data: result, error } = await supabaseAdmin.rpc("engine_create_withdrawal", {
      p_user_id: context.userId,
      p_asset: data.asset,
      p_amount: data.amount,
      p_address: data.address,
    });
    if (error) throw new Error(error.message);
    return result as { id: string; status: string };
  });
