import { createContext, useContext, useEffect, useState } from "react";
import type { Session, User } from "@supabase/supabase-js";
import { ensureSupabaseClient } from "@/integrations/supabase/client";

interface AuthCtx {
  user: User | null;
  session: Session | null;
  loading: boolean;
  configurationError: string | null;
  configError: string | null;
}

const Ctx = createContext<AuthCtx>({
  user: null,
  session: null,
  loading: true,
  configurationError: null,
  configError: null,
});

function errorMessage(error: unknown) {
  return error instanceof Error ? error.message : "Supabase authentication is unavailable.";
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);
  const [configurationError, setConfigurationError] = useState<string | null>(null);

  useEffect(() => {
    let mounted = true;
    let unsubscribe: () => void = () => undefined;

    void (async () => {
      try {
        const client = await ensureSupabaseClient();
        if (!mounted) return;

        const { data: subscription } = client.auth.onAuthStateChange((_event, nextSession) => {
          if (!mounted) return;
          setSession(nextSession);
          setLoading(false);
        });
        unsubscribe = () => subscription.subscription.unsubscribe();

        // getSession may attempt a refresh using a stale local refresh token. On failure, clear
        // only the local session; do not retry or redirect in a loop.
        const { data, error } = await client.auth.getSession();
        if (!mounted) return;
        if (error) {
          setSession(null);
          void client.auth.signOut({ scope: "local" }).catch(() => undefined);
        } else {
          setSession(data.session);
        }
        setLoading(false);
      } catch (error) {
        if (!mounted) return;
        setSession(null);
        const message = errorMessage(error);
        setConfigurationError(message);
        setLoading(false);
      }
    })();

    return () => {
      mounted = false;
      unsubscribe();
    };
  }, []);

  return (
    <Ctx.Provider
      value={{
        user: session?.user ?? null,
        session,
        loading,
        configurationError,
        configError: configurationError,
      }}
    >
      {children}
    </Ctx.Provider>
  );
}

export function useAuth() {
  return useContext(Ctx);
}

export async function signOut() {
  try {
    const client = await ensureSupabaseClient();
    await client.auth.signOut({ scope: "local" });
  } catch {
    // Signing out is already complete when no local Supabase session can exist.
  }
}
