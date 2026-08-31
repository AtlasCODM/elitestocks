/* eslint-disable @typescript-eslint/no-explicit-any -- generated Supabase types predate the admin migration. */
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { supabaseAdmin } from "@/integrations/supabase/client.server";

async function requireAdmin(userId: string) {
  const { data, error } = await (supabaseAdmin as any).rpc("is_admin", { actor: userId });
  if (error || !data) throw new Error("Forbidden: administrator access required");
}

export const getAdminState = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await requireAdmin(context.userId);
    const [{ data: transactions, error: txError }, { data: settings, error: settingsError }] =
      await Promise.all([
        (supabaseAdmin as any)
          .from("transactions")
          .select("*")
          .order("created_at", { ascending: false })
          .limit(250),
        (supabaseAdmin as any).from("platform_settings").select("*").eq("id", true).single(),
      ]);
    if (txError) throw new Error(txError.message);
    if (settingsError) throw new Error(settingsError.message);
    const userIds = [...new Set((transactions ?? []).map((tx) => tx.user_id))];
    const { data: profiles } = userIds.length
      ? await (supabaseAdmin as any)
          .from("profiles")
          .select("id,email,display_name,status")
          .in("id", userIds)
      : { data: [] };
    return { transactions: transactions ?? [], settings, profiles: profiles ?? [] };
  });

const UpdateTransactionInput = z.object({
  transactionId: z.string().uuid(),
  action: z.enum(["approve", "decline"]),
});
export const updateAdminTransaction = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) => UpdateTransactionInput.parse(data))
  .handler(async ({ context, data }) => {
    await requireAdmin(context.userId);
    const { data: transaction, error } = await (supabaseAdmin as any).rpc(
      "admin_update_transaction",
      {
        p_transaction_id: data.transactionId,
        p_action: data.action,
        p_admin_id: context.userId,
      },
    );
    if (error) throw new Error(error.message);
    return transaction;
  });

const UpdateSettingsInput = z.object({
  walletAddress: z.string().trim().min(10).max(200),
  minWithdrawal: z.number().finite().nonnegative(),
  maxWithdrawal: z.number().finite().positive(),
});
export const updateAdminSettings = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) => UpdateSettingsInput.parse(data))
  .handler(async ({ context, data }) => {
    await requireAdmin(context.userId);
    if (data.maxWithdrawal <= data.minWithdrawal) throw new Error("Maximum must exceed minimum");
    const { data: settings, error } = await (supabaseAdmin as any).rpc("admin_update_settings", {
      p_wallet_address: data.walletAddress,
      p_min_withdrawal: data.minWithdrawal,
      p_max_withdrawal: data.maxWithdrawal,
      p_admin_id: context.userId,
    });
    if (error) throw new Error(error.message);
    return settings;
  });
