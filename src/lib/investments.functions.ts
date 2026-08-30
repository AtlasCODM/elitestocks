import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { adjustBalance } from "./platform.server";

export const listInvestments = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { userId } = context;
    const [inv, copies] = await Promise.all([
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
    return {
      investments: inv.data ?? [],
      copyTrades: copies.data ?? [],
    };
  });

const CancelInput = z.object({
  id: z.string().uuid(),
  kind: z.enum(["investment", "copy_trade"]),
});

export const cancelInvestment = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => CancelInput.parse(d))
  .handler(async ({ data, context }) => {
    const { userId } = context;
    const table = data.kind === "investment" ? "investments" : "copy_trades";

    const { data: row, error } = await supabaseAdmin
      .from(table)
      .select("*")
      .eq("id", data.id)
      .eq("user_id", userId)
      .single();
    if (error || !row) throw new Error("Position not found");
    if (row.status !== "active") throw new Error("Position is not active");

    // Refund principal
    await adjustBalance(userId, row.asset, Number(row.amount));

    const { error: ue } = await supabaseAdmin
      .from(table)
      .update({ status: "cancelled", completed_at: new Date().toISOString() })
      .eq("id", data.id)
      .eq("user_id", userId);
    if (ue) {
      // rollback refund
      await adjustBalance(userId, row.asset, -Number(row.amount));
      throw new Error(ue.message);
    }

    await supabaseAdmin.from("transactions").insert({
      user_id: userId,
      type: data.kind === "investment" ? "return" : "copy_return",
      amount: Number(row.amount),
      asset: row.asset,
      status: "completed",
      reference_id: row.id,
      metadata: { event: "cancellation", principal_refunded: true },
    });

    return { ok: true };
  });
