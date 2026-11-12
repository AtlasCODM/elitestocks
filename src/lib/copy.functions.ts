import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { FinancialAmountSchema } from "./financial-amount";

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
  amount: FinancialAmountSchema,
});

export const createCopyTrade = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => Input.parse(d))
  .handler(async ({ data, context }) => {
    const { data: result, error } = await supabaseAdmin.rpc("engine_create_copy_trade", {
      p_user_id: context.userId,
      p_trader_id: data.trader_id,
      p_amount: data.amount,
    });
    if (error) throw new Error(error.message);
    return result as { id: string; matures_at: string };
  });
