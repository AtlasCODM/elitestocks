/* eslint-disable @typescript-eslint/no-explicit-any -- additive migration types are isolated at this boundary. */
import { FinancialConfigurationSchema } from "./financial-config";

export async function loadFinancialConfiguration(supabase: any) {
  const { data, error } = await supabase.rpc("get_investment_configuration");
  if (error || !data)
    throw new Error(
      "Investment configuration is unavailable. Apply the investment engine migration and verify database access.",
    );
  const config = FinancialConfigurationSchema.parse(data.config);
  if (config.version !== data.version)
    throw new Error("Investment configuration version is inconsistent");
  return config;
}
