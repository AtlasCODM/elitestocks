/* eslint-disable @typescript-eslint/no-explicit-any -- generated Supabase types predate the admin migration. */
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import type { Asset } from "@/lib/platform.server";
import { FinancialAmountSchema } from "./financial-amount";

const AssetSchema = z.enum(["BTC", "ETH", "SOL", "USDT"]);
const Input = z.object({
  asset: AssetSchema,
  amount: FinancialAmountSchema,
});

const walletColumn = {
  BTC: "bitcoin_wallet_address",
  ETH: "ethereum_wallet_address",
  SOL: "solana_wallet_address",
  USDT: "usdt_wallet_address",
} as const;
const legacyWalletColumn = {
  BTC: "addr_btc",
  ETH: "addr_erc20",
  SOL: "addr_solana",
  USDT: "addr_trc20",
} as const;

async function configuredDepositAddress(asset: Asset) {
  const { data: settings, error } = await (supabaseAdmin as any)
    .from("platform_settings")
    .select("*")
    .eq("id", true)
    .single();
  if (error) throw new Error(`Unable to load deposit settings: ${error.message}`);
  const configured = String(settings?.[walletColumn[asset]] ?? "").trim();
  if (configured) return configured;
  return String(settings?.[legacyWalletColumn[asset]] ?? settings?.wallet_address ?? "").trim();
}

export const getDepositAddress = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { asset: Asset }) => z.object({ asset: AssetSchema }).parse(d))
  .handler(async ({ data }) => ({ address: await configuredDepositAddress(data.asset) }));

export const confirmDeposit = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => Input.parse(d))
  .handler(async ({ data, context }) => {
    const { data: result, error } = await supabaseAdmin.rpc("engine_confirm_deposit", {
      p_user_id: context.userId,
      p_asset: data.asset,
      p_amount: data.amount,
    });
    if (error) throw new Error(error.message);
    return result as { id: string; status: string };
  });
