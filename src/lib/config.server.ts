import process from "node:process";
import { resolvePublicSupabaseConnection } from "./public-supabase-config";

export type ServerSupabaseConfiguration = {
  supabaseUrl: string | undefined;
  supabasePublishableKey: string | undefined;
  missing: string[];
};

function readServerEnv(...names: string[]) {
  for (const name of names) {
    const value = process.env[name];
    if (typeof value === "string" && value.trim()) return value.trim();
  }
  return undefined;
}

function readBoolean(...names: string[]) {
  return readServerEnv(...names)?.toLowerCase() === "true";
}

export function getServerSupabaseConfiguration(): ServerSupabaseConfiguration {
  // Public connection defaults travel with the application, not a hosting provider.
  // Optional env overrides must form a valid pair; secret keys are never exposed.
  const resolved = resolvePublicSupabaseConnection(
    readServerEnv("SUPABASE_URL", "VITE_SUPABASE_URL"),
    readServerEnv(
      "SUPABASE_PUBLISHABLE_KEY",
      "SUPABASE_ANON_KEY",
      "VITE_SUPABASE_PUBLISHABLE_KEY",
      "VITE_SUPABASE_ANON_KEY",
    ),
  );
  const supabaseUrl = resolved.supabaseUrl ?? undefined;
  const supabasePublishableKey = resolved.supabasePublishableKey ?? undefined;
  return {
    supabaseUrl,
    supabasePublishableKey,
    missing: [
      ...(!supabaseUrl ? ["SUPABASE_URL"] : []),
      ...(!supabasePublishableKey ? ["SUPABASE_PUBLISHABLE_KEY"] : []),
    ],
  };
}

export function getPublicRuntimeConfiguration() {
  const { supabaseUrl, supabasePublishableKey } = getServerSupabaseConfiguration();
  return {
    supabaseUrl: supabaseUrl ?? null,
    supabasePublishableKey: supabasePublishableKey ?? null,
    maintenanceMode: readBoolean("MAINTENANCE_MODE", "VITE_MAINTENANCE_MODE"),
    inAppSupport: readBoolean("IN_APP_SUPPORT", "VITE_FEATURE_IN_APP_SUPPORT"),
    configured: Boolean(supabaseUrl && supabasePublishableKey),
  } as const;
}

export function getServerConfig() {
  return {
    nodeEnv: process.env.NODE_ENV,
  };
}
