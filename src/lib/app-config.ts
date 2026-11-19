import { resolvePublicSupabaseConnection } from "./public-supabase-config";

export type PublicRuntimeConfiguration = {
  supabaseUrl: string | null;
  supabasePublishableKey: string | null;
  maintenanceMode: boolean;
  inAppSupport: boolean;
  configured: boolean;
};

const initialConnection = resolvePublicSupabaseConnection();

let currentConfiguration: PublicRuntimeConfiguration = {
  ...initialConnection,
  maintenanceMode: false,
  inAppSupport: false,
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
