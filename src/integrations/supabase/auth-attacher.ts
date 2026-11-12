import { createMiddleware } from "@tanstack/react-start";
import { ensureSupabaseClient, isPublicRuntimeConfigurationBootstrapInProgress } from "./client";

// Must be registered as a global `functionMiddleware` in `src/start.ts`; otherwise the browser
// never attaches the bearer token to serverFn RPCs.
export const attachSupabaseAuth = createMiddleware({ type: "function" }).client(
  async ({ next }) => {
    // The runtime configuration function is the bootstrap dependency of this middleware. Calling
    // ensureSupabaseClient for its marked request would recurse forever through this middleware.
    if (isPublicRuntimeConfigurationBootstrapInProgress()) return next();

    try {
      const client = await ensureSupabaseClient();
      const { data } = await client.auth.getSession();
      const token = data.session?.access_token;
      return next({
        headers: token ? { Authorization: `Bearer ${token}` } : {},
      });
    } catch {
      // Public functions remain usable when auth is not configured. Protected server middleware
      // will reject the request without ever receiving a fabricated credential.
      return next({ headers: {} });
    }
  },
);
