import { createContext, useContext, useEffect, useState } from "react";
import type { Session, User } from "@supabase/supabase-js";
import { supabase } from "@/integrations/supabase/client";

interface AuthCtx {
  user: User | null;
  session: Session | null;
  loading: boolean;
}

const Ctx = createContext<AuthCtx>({ user: null, session: null, loading: true });

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let mounted = true;
    const { data: sub } = supabase.auth.onAuthStateChange((_event, nextSession) => {
      if (!mounted) return;
      setSession(nextSession);
      setLoading(false);
    });

    // getSession may attempt a refresh using a stale local refresh token. On
    // failure, clear only the local session; do not retry or redirect in a loop.
    supabase.auth
      .getSession()
      .then(({ data, error }) => {
        if (!mounted) return;
        if (error) {
          setSession(null);
          void supabase.auth.signOut({ scope: "local" }).catch(() => undefined);
          setLoading(false);
          return;
        }
        setSession(data.session);
        setLoading(false);
      })
      .catch(() => {
        if (!mounted) return;
        setSession(null);
        void supabase.auth.signOut({ scope: "local" }).catch(() => undefined);
        setLoading(false);
      });

    return () => {
      mounted = false;
      sub.subscription.unsubscribe();
    };
  }, []);

  return (
    <Ctx.Provider value={{ user: session?.user ?? null, session, loading }}>
      {children}
    </Ctx.Provider>
  );
}

export function useAuth() {
  return useContext(Ctx);
}

export async function signOut() {
  await supabase.auth.signOut({ scope: "local" });
}
