import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { ensureSupabaseClient } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { toast } from "sonner";
import { Logo } from "@/components/site/Logo";

export const Route = createFileRoute("/signup")({
  head: () => ({
    meta: [
      { title: "Create Account — Elite Stocks" },
      { name: "description", content: "Open an Elite Stocks account in seconds." },
    ],
  }),
  component: SignupPage,
});

function authErrorMessage(error: unknown) {
  return error instanceof Error ? error.message : "Authentication is unavailable.";
}

function SignupPage() {
  const { user, loading, configurationError } = useAuth();
  const navigate = useNavigate();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (user) navigate({ to: "/wallet" });
  }, [user, navigate]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (loading || configurationError) return;
    if (password.length < 8) return toast.error("Password must be at least 8 characters");

    setBusy(true);
    try {
      const client = await ensureSupabaseClient();
      const { error } = await client.auth.signUp({
        email,
        password,
        options: {
          emailRedirectTo: `${window.location.origin}/wallet`,
          data: { display_name: name },
        },
      });
      if (error) return toast.error(error.message);

      // Auto sign-in (no email verification required)
      const { error: signInErr } = await client.auth.signInWithPassword({ email, password });
      if (signInErr) {
        toast.success("Account created — please sign in");
        return navigate({ to: "/login" });
      }
      toast.success("Welcome to Elite Stocks! Your account has been created.");
      navigate({ to: "/wallet" });
    } catch (error) {
      toast.error(authErrorMessage(error));
    } finally {
      setBusy(false);
    }
  };

  const submitDisabled = busy || loading || Boolean(configurationError);

  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <div className="w-full max-w-sm panel p-8">
        <div className="flex justify-center">
          <Logo />
        </div>
        <h1 className="mt-4 text-center font-display text-2xl font-bold">Create your account</h1>
        {configurationError && (
          <p
            role="status"
            className="mt-4 rounded-md border border-border bg-muted/30 px-3 py-2 text-center text-xs text-muted-foreground"
          >
            {configurationError} Public browsing remains available.{" "}
            <Link to="/" className="text-gold hover:underline">
              Return home
            </Link>
          </p>
        )}
        <form onSubmit={handleSubmit} className="mt-6 space-y-4">
          <div>
            <label className="text-[11px] uppercase tracking-wider text-muted-foreground">
              Full name
            </label>
            <input
              required
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="mt-1 w-full rounded-md border border-border bg-background px-3 py-2.5 text-sm outline-none focus:border-gold"
            />
          </div>
          <div>
            <label className="text-[11px] uppercase tracking-wider text-muted-foreground">
              Email
            </label>
            <input
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="mt-1 w-full rounded-md border border-border bg-background px-3 py-2.5 text-sm outline-none focus:border-gold"
            />
          </div>
          <div>
            <label className="text-[11px] uppercase tracking-wider text-muted-foreground">
              Password
            </label>
            <input
              type="password"
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="mt-1 w-full rounded-md border border-border bg-background px-3 py-2.5 text-sm outline-none focus:border-gold"
            />
            <p className="mt-1 text-[10px] text-muted-foreground">Minimum 8 characters</p>
          </div>
          <button
            disabled={submitDisabled}
            type="submit"
            className="w-full rounded-md bg-gold py-2.5 text-sm font-bold text-primary-foreground hover:brightness-110 disabled:opacity-60"
          >
            {busy ? "Creating account…" : loading ? "Checking authentication…" : "Create Account"}
          </button>
        </form>
        <p className="mt-6 text-center text-xs text-muted-foreground">
          Already have an account?{" "}
          <Link to="/login" className="text-gold hover:underline">
            Sign in
          </Link>
        </p>
      </div>
    </div>
  );
}
