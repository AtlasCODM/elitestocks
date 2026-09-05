/* eslint-disable @typescript-eslint/no-explicit-any -- generated Supabase types predate the admin migration. */
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import type { Asset } from "@/lib/platform.server";

const Input = z.object({
  asset: z.enum(["BTC", "ETH", "SOL", "USDT"]),
  amount: z.number().positive().max(1_000_000),
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
    // Select all columns so deployments with legacy address columns remain
    // readable during the non-destructive transition.
    .select("*")
    .eq("id", true)
    .single();
  if (error) throw new Error(`Unable to load deposit settings: ${error.message}`);
  const configured = String(settings?.[walletColumn[asset]] ?? "").trim();
  if (configured) return configured;
  return String(settings?.[legacyWalletColumn[asset]] ?? "").trim();
}

export const getDepositAddress = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { asset: Asset }) =>
    z.object({ asset: z.enum(["BTC", "ETH", "SOL", "USDT"]) }).parse(d),
  )
  .handler(async ({ data }) => ({ address: await configuredDepositAddress(data.asset) }));

export const confirmDeposit = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => Input.parse(d))
  .handler(async ({ data, context }) => {
    const address = await configuredDepositAddress(data.asset);
    if (!address) throw new Error(`${data.asset} deposit address is not configured`);
    const { data: tx, error } = await supabaseAdmin
      .from("transactions")
      .insert({
        user_id: context.userId,
        type: "deposit",
        amount: data.amount,
        asset: data.asset,
        status: "pending_confirmation",
        address,
        metadata: { source: "user_confirm" },
      })
      .select()
      .single();
    if (error) throw new Error(error.message);
    return { id: tx.id, status: tx.status };
  });
