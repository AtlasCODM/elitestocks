import { resolvePublicSupabaseConnection } from "./public-supabase-config";

export type PublicRuntimeConfiguration = {
  supabaseUrl: string | null;
  supabasePublishableKey: string | null;
  maintenanceMode: boolean;
  inAppSupport: boolean;
  configured: boolean;
};

function readLegacyEnv(name: string): string | undefined {
  const environment = (import.meta as ImportMeta & { env?: Record<string, unknown> }).env ?? {};
  const value = environment[name];
  return typeof value === "string" && value.trim() ? value.trim() : undefined;
}

function readLegacyBoolean(name: string): boolean {
  return readLegacyEnv(name)?.toLowerCase() === "true";
}

const initialConnection = resolvePublicSupabaseConnection(
  readLegacyEnv("VITE_SUPABASE_URL"),
  readLegacyEnv("VITE_SUPABASE_PUBLISHABLE_KEY") ?? readLegacyEnv("VITE_SUPABASE_ANON_KEY"),
);

let currentConfiguration: PublicRuntimeConfiguration = {
  ...initialConnection,
  maintenanceMode: readLegacyBoolean("VITE_MAINTENANCE_MODE"),
  inAppSupport: readLegacyBoolean("VITE_FEATURE_IN_APP_SUPPORT"),
};

const listeners = new Set<(configuration: PublicRuntimeConfiguration) => void>();

export function getAppConfig(): PublicRuntimeConfiguration {
  return currentConfiguration;
}

export function applyPublicRuntimeConfiguration(configuration: PublicRuntimeConfiguration) {
  const connection = resolvePublicSupabaseConnection(
    configuration.supabaseUrl,
    configuration.supabasePublishableKey,
    { supabaseUrl: null, supabasePublishableKey: null },
  );
  currentConfiguration = {
    ...connection,
    maintenanceMode: configuration.maintenanceMode,
    inAppSupport: configuration.inAppSupport,
  };
  for (const listener of listeners) listener(currentConfiguration);
  return currentConfiguration;
}

export function subscribeToAppConfig(
  listener: (configuration: PublicRuntimeConfiguration) => void,
) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}
