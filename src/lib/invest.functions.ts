import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { FinancialAmountSchema } from "./financial-amount";

const Input = z.object({
  tier: z.string().trim().min(1),
  amount: FinancialAmountSchema,
});

export const createInvestment = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => Input.parse(d))
  .handler(async ({ data, context }) => {
    const { data: result, error } = await supabaseAdmin.rpc("engine_create_investment", {
      p_user_id: context.userId,
      p_tier: data.tier,
      p_amount: data.amount,
    });
    if (error) throw new Error(error.message);
    return result as { id: string; matures_at: string };
  });
