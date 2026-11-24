import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { summarizePosition } from "./investment-engine";

export const listInvestments = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const serverNow = new Date().toISOString();
    const admin = supabaseAdmin as any;
    const [inv, copies] = await Promise.all([
      admin
        .from("investments")
        .select("*")
        .eq("workspace_id", context.workspaceId)
        .eq("user_id", context.userId)
        .order("created_at", { ascending: false }),
      admin
        .from("copy_trades")
        .select("*, trader:traders(name,handle,badge)")
        .eq("workspace_id", context.workspaceId)
        .eq("user_id", context.userId)
        .order("created_at", { ascending: false }),
    ]);
    if (inv.error) throw new Error(inv.error.message);
    if (copies.error) throw new Error(copies.error.message);
    return {
      serverNow,
      investments: (inv.data ?? []).map((row: any) => ({
        ...row,
        summary: summarizePosition(row, serverNow),
      })),
      copyTrades: (copies.data ?? []).map((row: any) => ({
        ...row,
        summary: summarizePosition(row, serverNow),
      })),
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
    const { data: result, error } = await supabaseAdmin.rpc("engine_cancel_position", {
      p_user_id: context.userId,
      p_position_id: data.id,
      p_kind: data.kind,
    });
    if (error) throw new Error(error.message);
    return result as { ok: true };
  });
