/* eslint-disable @typescript-eslint/no-explicit-any -- additive migration types are isolated at this boundary. */
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { FinancialConfigurationSchema } from "./financial-config";

export async function loadFinancialConfiguration() {
  const { data, error } = await (supabaseAdmin as any)
    .from("investment_engine_config")
    .select("config,version")
    .eq("id", true)
    .single();
  if (error || !data)
    throw new Error(
      "Investment configuration is unavailable. Apply the investment engine migration and verify database access.",
    );
  const config = FinancialConfigurationSchema.parse(data.config);
  if (config.version !== data.version)
    throw new Error("Investment configuration version is inconsistent");
  return config;
}
