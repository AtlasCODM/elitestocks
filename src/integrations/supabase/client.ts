import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "./types";
import {
  applyPublicRuntimeConfiguration,
  getAppConfig,
  type PublicRuntimeConfiguration,
} from "@/lib/app-config";
import { getPublicRuntimeConfiguration } from "@/lib/public-config.functions";

type BrowserSupabaseClient = SupabaseClient<Database>;

function configurationError() {
  return new Error("Sign-in is temporarily unavailable. You can continue browsing public pages.");
}

function unavailableAuth() {
  const error = configurationError();
  return new Proxy({} as BrowserSupabaseClient["auth"], {
    get(_, property) {
      if (property === "onAuthStateChange") {
        return () => ({
          data: { subscription: { unsubscribe: () => undefined } },
          error: null,
        });
      }
      if (property === "getSession") {
        return async () => ({ data: { session: null }, error });
      }
      return async () => ({
        data: { session: null, user: null },
        error,
      });
    },
  });
}

function unavailableOperation(path: string): unknown {
  return new Proxy(() => Promise.reject(configurationError()), {
    get(_, property) {
      if (property === "then") return undefined;
      return unavailableOperation(`${path}.${String(property)}`);
    },
    apply() {
      return Promise.reject(configurationError());
    },
  });
}

const unavailableClient = new Proxy({} as BrowserSupabaseClient, {
  get(_, property) {
    if (property === "auth") return unavailableAuth();
    return unavailableOperation(`supabase.${String(property)}`);
  },
});

let supabaseClient: BrowserSupabaseClient | undefined;
let runtimeConfigurationPromise: Promise<PublicRuntimeConfiguration> | undefined;
let clientInitializationPromise: Promise<BrowserSupabaseClient> | undefined;
let publicRuntimeConfigurationBootstrapInProgress = false;

export function isPublicRuntimeConfigurationBootstrapInProgress() {
  return publicRuntimeConfigurationBootstrapInProgress;
}

/**
 * Fetch deployment settings once per browser session. Committed public settings
 * and legacy Vite values are used only when the runtime endpoint is unavailable.
 * A reachable runtime's unconfigured response is authoritative, avoiding mixed projects.
 */
export function loadPublicRuntimeConfiguration() {
  if (!runtimeConfigurationPromise) {
    runtimeConfigurationPromise = (async () => {
      publicRuntimeConfigurationBootstrapInProgress = true;
      try {
        const runtimeConfiguration = await getPublicRuntimeConfiguration();
        return applyPublicRuntimeConfiguration(runtimeConfiguration);
      } catch {
        return getAppConfig();
      } finally {
        publicRuntimeConfigurationBootstrapInProgress = false;
      }
    })();
  }
  return runtimeConfigurationPromise;
}

export async function ensureSupabaseClient(): Promise<BrowserSupabaseClient> {
  if (supabaseClient) return supabaseClient;
  if (!clientInitializationPromise) {
    clientInitializationPromise = (async () => {
      const configuration = await loadPublicRuntimeConfiguration();
      if (
        !configuration.configured ||
        !configuration.supabaseUrl ||
        !configuration.supabasePublishableKey
      ) {
        throw configurationError();
      }
      try {
        supabaseClient = createClient<Database>(
          configuration.supabaseUrl,
          configuration.supabasePublishableKey,
          {
            auth: {
              storage: typeof window !== "undefined" ? localStorage : undefined,
              persistSession: true,
              autoRefreshToken: true,
            },
          },
        );
        return supabaseClient;
      } catch {
        throw new Error(
          "Sign-in is temporarily unavailable. You can continue browsing public pages.",
        );
      }
    })().catch((error: unknown) => {
      clientInitializationPromise = undefined;
      throw error;
    });
  }
  return clientInitializationPromise;
}

// Existing imports can remain synchronous. Authenticated code calls ensureSupabaseClient first;
// unauthenticated direct auth calls receive a descriptive error result instead of throwing during
// render when a deployment has no Supabase settings.
export const supabase = new Proxy({} as BrowserSupabaseClient, {
  get(_, property) {
    if (supabaseClient) return Reflect.get(supabaseClient, property);
    return Reflect.get(unavailableClient, property);
  },
});
