import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { adjustBalance, PLANS, MIN_INVESTMENT } from "./platform.server";

const Input = z.object({
  tier: z.string().min(1),
  amount: z.number().min(MIN_INVESTMENT).max(10_000_000),
});

export const createInvestment = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => Input.parse(d))
  .handler(async ({ data, context }) => {
    const { userId } = context;
    const plan = PLANS.find((p) => p.tier === data.tier);
    if (!plan) throw new Error("Invalid plan");

    // Debit USDT wallet
    await adjustBalance(userId, "USDT", -data.amount);

    const matures = new Date(Date.now() + plan.days * 86400_000).toISOString();
    const { data: inv, error } = await supabaseAdmin
      .from("investments")
      .insert({
        user_id: userId,
        plan_tier: plan.tier,
        amount: data.amount,
        asset: "USDT",
        profit_pct: plan.profit_pct,
        duration_days: plan.days,
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
      type: "investment",
      amount: data.amount,
      asset: "USDT",
      status: "completed",
      reference_id: inv.id,
      metadata: { plan: plan.tier, matures_at: matures },
    });

    return { id: inv.id, matures_at: matures };
  });
