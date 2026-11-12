/* eslint-disable @typescript-eslint/no-explicit-any -- additive migration RPCs are isolated at this boundary. */
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import type { Json } from "@/integrations/supabase/types";
import { requireAdmin } from "./admin.functions";
import { FinancialConfigurationSchema } from "./financial-config";
import { loadFinancialConfiguration } from "./financial-config.server";
import { FinancialProfitSchema } from "./financial-amount";

export type FinancialConfigurationAudit = {
  id: string;
  actor_id: string | null;
  old_config: Json;
  new_config: Json;
  created_at: string;
};

export const getFinancialConfiguration = createServerFn({ method: "GET" }).handler(async () => {
  const serverNow = new Date().toISOString();
  try {
    return { config: await loadFinancialConfiguration(), available: true, serverNow };
  } catch {
    // Do not disclose credentials, SQL details or internal server errors to public visitors.
    return {
      config: null,
      available: false,
      serverNow,
      error: "Investment configuration is temporarily unavailable. Please try again later.",
    };
  }
});

export const getAdminFinancialConfiguration = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await requireAdmin(context.supabase, context.userId);
    const config = await loadFinancialConfiguration();
    const { data, error } = await (supabaseAdmin as any)
      .from("investment_engine_audit")
      .select("id,actor_id,old_config,new_config,created_at")
      .order("created_at", { ascending: false })
      .limit(100);
    if (error) throw new Error("Unable to load financial configuration history");
    return { config, history: (data ?? []) as FinancialConfigurationAudit[] };
  });

const ConfigurationInput = z.object({
  expectedVersion: z.number().int().nonnegative(),
  config: FinancialConfigurationSchema,
});
export const updateFinancialConfiguration = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => ConfigurationInput.parse(input))
  .handler(async ({ data, context }) => {
    await requireAdmin(context.supabase, context.userId);
    if (data.config.version !== data.expectedVersion)
      throw new Error("Configuration version does not match. Reload before saving.");
    const { data: config, error } = await (supabaseAdmin as any).rpc(
      "engine_update_configuration",
      {
        p_actor_id: context.userId,
        p_expected_version: data.expectedVersion,
        p_config: data.config,
      },
    );
    if (error) throw new Error(error.message);
    return FinancialConfigurationSchema.parse(config);
  });

const PerformanceInput = z.object({
  kind: z.enum(["investment", "copy_trade"]),
  positionId: z.string().uuid(),
  profit: FinancialProfitSchema,
  evidenceRef: z.string().trim().min(1).max(2000),
  contractRef: z.string().trim().min(1).max(2000),
});
export const recordVerifiedPerformance = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => PerformanceInput.parse(input))
  .handler(async ({ data, context }) => {
    await requireAdmin(context.supabase, context.userId);
    const { data: result, error } = await (supabaseAdmin as any).rpc("engine_record_performance", {
      p_actor_id: context.userId,
      p_kind: data.kind,
      p_position_id: data.positionId,
      p_profit: data.profit,
      p_evidence_ref: data.evidenceRef,
      p_contract_ref: data.contractRef,
    });
    if (error) throw new Error(error.message);
    return result;
  });
