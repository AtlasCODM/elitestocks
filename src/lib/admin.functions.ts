/* eslint-disable @typescript-eslint/no-explicit-any -- generated Supabase types predate the user_roles table. */
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { getSupabaseAdmin } from "@/integrations/supabase/admin-access";

async function isAdminUser(authClient: any, userId: string) {
  // The bearer token is verified by requireSupabaseAuth. Use the trusted
  // service-role client for the role lookup because user_roles is intentionally
  // protected by RLS and must not be treated as a browser-readable table.
  // `userId` always comes from the verified request context, never the browser.
  void authClient;
  const admin = (await getSupabaseAdmin()) as any;
  const { data, error } = await admin
    .from("user_roles")
    .select("role")
    .eq("user_id", userId)
    .eq("role", "admin")
    .limit(1);
  if (error) throw new Error(`Unable to verify administrator role: ${error.message}`);
  return Array.isArray(data) && data.length > 0;
}

export async function requireAdmin(authClient: any, userId: string) {
  if (!(await isAdminUser(authClient, userId))) {
    throw new Error("Forbidden: administrator access required");
  }
}

export const getAdminAccess = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data, error } = await (context.supabase as any).rpc("is_admin");
    if (error) throw new Error(`Unable to verify administrator role: ${error.message}`);
    return { isAdmin: data === true };
  });

export const getAdminState = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await requireAdmin(context.supabase, context.userId);
    const admin = (await getSupabaseAdmin()) as any;
    const [{ data: transactions, error: txError }, { data: settings, error: settingsError }] =
      await Promise.all([
        admin
          .from("transactions")
          .select("*")
          .eq("workspace_id", context.workspaceId)
          .order("created_at", { ascending: false })
          .limit(250),
        admin.from("platform_settings").select("*").eq("id", true).single(),
      ]);
    if (txError) throw new Error(txError.message);
    if (settingsError) throw new Error(settingsError.message);
    const userIds = [...new Set((transactions ?? []).map((tx: any) => tx.user_id))];
    const { data: profiles } = userIds.length
      ? await admin.from("profiles").select("id,email,display_name,status").in("id", userIds)
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
    await requireAdmin(context.supabase, context.userId);
    const admin = (await getSupabaseAdmin()) as any;
    const { data: transaction, error } = await admin.rpc("admin_update_transaction", {
      p_transaction_id: data.transactionId,
      p_action: data.action,
      p_admin_id: context.userId,
    });
    if (error) throw new Error(error.message);
    return transaction;
  });

const UpdateSettingsInput = z.object({
  bitcoinWalletAddress: z
    .string()
    .trim()
    .max(200)
    .refine(
      (value) => value === "" || value.length >= 10,
      "Address must be empty or at least 10 characters",
    ),
  ethereumWalletAddress: z
    .string()
    .trim()
    .max(200)
    .refine(
      (value) => value === "" || value.length >= 10,
      "Address must be empty or at least 10 characters",
    ),
  solanaWalletAddress: z
    .string()
    .trim()
    .max(200)
    .refine(
      (value) => value === "" || value.length >= 10,
      "Address must be empty or at least 10 characters",
    ),
  usdtWalletAddress: z
    .string()
    .trim()
    .max(200)
    .refine(
      (value) => value === "" || value.length >= 10,
      "Address must be empty or at least 10 characters",
    ),
  minWithdrawal: z.number().finite().nonnegative(),
  maxWithdrawal: z.number().finite().positive(),
});

export const updateAdminSettings = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) => UpdateSettingsInput.parse(data))
  .handler(async ({ context, data }) => {
    await requireAdmin(context.supabase, context.userId);
    if (data.maxWithdrawal <= data.minWithdrawal) {
      throw new Error("Maximum must exceed minimum");
    }
    const admin = (await getSupabaseAdmin()) as any;
    const { data: settings, error } = await admin.rpc("admin_update_settings", {
      p_bitcoin_wallet_address: data.bitcoinWalletAddress,
      p_ethereum_wallet_address: data.ethereumWalletAddress,
      p_solana_wallet_address: data.solanaWalletAddress,
      p_usdt_wallet_address: data.usdtWalletAddress,
      p_min_withdrawal: data.minWithdrawal,
      p_max_withdrawal: data.maxWithdrawal,
      p_admin_id: context.userId,
    });
    if (error) throw new Error(error.message);
    return settings;
  });

export const listAdminUsers = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await requireAdmin(context.supabase, context.userId);
    const admin = await getSupabaseAdmin();
    const users: any[] = [];
    for (let page = 1; page <= 100; page += 1) {
      const { data, error } = await admin.auth.admin.listUsers({ page, perPage: 1000 });
      if (error) throw new Error(error.message);
      users.push(...data.users);
      if (data.users.length < 1000) break;
    }
    return { users };
  });

const DeleteUserInput = z.object({ userId: z.string().uuid() });
export const deleteAdminUser = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) => DeleteUserInput.parse(data))
  .handler(async ({ context, data }) => {
    await requireAdmin(context.supabase, context.userId);
    if (data.userId === context.userId) throw new Error("You cannot delete your own account");
    const admin = await getSupabaseAdmin();
    const { error } = await admin.auth.admin.deleteUser(data.userId);
    if (error) throw new Error(error.message);
    return { deletedUserId: data.userId };
  });
