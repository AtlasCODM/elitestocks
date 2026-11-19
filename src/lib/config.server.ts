import process from "node:process";
import { resolvePublicSupabaseConnection } from "./public-supabase-config";

export type ServerSupabaseConfiguration = {
  supabaseUrl: string | undefined;
  supabasePublishableKey: string | undefined;
  missing: string[];
};

function readBoolean(name: string) {
  return process.env[name]?.trim().toLowerCase() === "true";
}

export function getServerSupabaseConfiguration(): ServerSupabaseConfiguration {
  // The browser-safe connection is versioned with the application; no hosting-provider
  // environment variables are required for ordinary authentication or public config.
  const resolved = resolvePublicSupabaseConnection();
  const supabaseUrl = resolved.supabaseUrl ?? undefined;
  const supabasePublishableKey = resolved.supabasePublishableKey ?? undefined;
  return {
    supabaseUrl,
    supabasePublishableKey,
    missing: [
      ...(!supabaseUrl ? ["public Supabase URL in supabase.public.config.json"] : []),
      ...(!supabasePublishableKey ? ["browser-safe Supabase key in supabase.public.config.json"] : []),
    ],
  };
}

export function getPublicRuntimeConfiguration() {
  const { supabaseUrl, supabasePublishableKey } = getServerSupabaseConfiguration();
  return {
    supabaseUrl: supabaseUrl ?? null,
    supabasePublishableKey: supabasePublishableKey ?? null,
    maintenanceMode: readBoolean("MAINTENANCE_MODE"),
    inAppSupport: readBoolean("IN_APP_SUPPORT"),
    configured: Boolean(supabaseUrl && supabasePublishableKey),
  } as const;
}

export function getServerConfig() {
  return {
    nodeEnv: process.env.NODE_ENV,
  };
}
