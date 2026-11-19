import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { ensureSupabaseClient } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { toast } from "sonner";
import { Logo } from "@/components/site/Logo";

export const Route = createFileRoute("/reset-password")({
  head: () => ({
    meta: [
      { title: "Reset Password — Elite Stocks" },
      { name: "description", content: "Recover access to your Elite Stocks account." },
    ],
  }),
  component: ResetPasswordPage,
});

function errorMessage(error: unknown) {
  return error instanceof Error ? error.message : "Password recovery is temporarily unavailable.";
}

function ResetPasswordPage() {
  const { user, loading, configurationError } = useAuth();
  const navigate = useNavigate();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [sentTo, setSentTo] = useState<string | null>(null);

  const sendRecovery = async (event: React.FormEvent) => {
    event.preventDefault();
    if (configurationError) return;
    setBusy(true);
    try {
      const client = await ensureSupabaseClient();
      const { error } = await client.auth.resetPasswordForEmail(email.trim(), {
        redirectTo: `${window.location.origin}/reset-password`,
      });
      if (error) throw error;
      setSentTo(email.trim());
      toast.success("If an account matches that email, a password reset link is on its way.");
    } catch (error) {
      toast.error(errorMessage(error));
    } finally {
      setBusy(false);
    }
  };

  const savePassword = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!user || password.length < 8) return;
    setBusy(true);
    try {
      const client = await ensureSupabaseClient();
      const { error } = await client.auth.updateUser({ password });
      if (error) throw error;
      toast.success("Your password has been updated.");
      await navigate({ to: "/wallet" });
    } catch (error) {
      toast.error(errorMessage(error));
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <div className="w-full max-w-sm panel p-8">
        <div className="flex justify-center">
          <Logo />
        </div>
        <h1 className="mt-4 text-center font-display text-2xl font-bold">
          {user ? "Choose a new password" : "Reset your password"}
        </h1>
        {configurationError && (
          <p role="status" className="mt-4 rounded-md border border-border bg-muted/30 px-3 py-2 text-center text-xs text-muted-foreground">
            {configurationError}
          </p>
        )}
        {user ? (
          <form onSubmit={savePassword} className="mt-6 space-y-4">
            <p className="text-sm text-muted-foreground">
              Set a new password for {user.email ?? "your account"}.
            </p>
            <label className="block text-[11px] uppercase tracking-wider text-muted-foreground">
              New password
              <input
                type="password"
                required
                minLength={8}
                autoComplete="new-password"
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                className="mt-1 w-full rounded-md border border-border bg-background px-3 py-2.5 text-sm outline-none focus:border-gold"
              />
            </label>
            <p className="text-[10px] text-muted-foreground">Minimum 8 characters</p>
            <button
              disabled={busy || loading || Boolean(configurationError)}
              className="w-full rounded-md bg-gold py-2.5 text-sm font-bold text-primary-foreground disabled:opacity-60"
            >
              {busy ? "Updating…" : "Update password"}
            </button>
          </form>
        ) : (
          <form onSubmit={sendRecovery} className="mt-6 space-y-4">
            <p className="text-sm text-muted-foreground">
              Enter the email for your account. We’ll send a reset link if the account is eligible.
            </p>
            <label className="block text-[11px] uppercase tracking-wider text-muted-foreground">
              Email
              <input
                type="email"
                required
                autoComplete="email"
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                className="mt-1 w-full rounded-md border border-border bg-background px-3 py-2.5 text-sm outline-none focus:border-gold"
              />
            </label>
            {sentTo && (
              <p role="status" className="rounded-md border border-border bg-muted/30 px-3 py-2 text-xs text-muted-foreground">
                If an account matches {sentTo}, check that inbox for the reset link.
              </p>
            )}
            <button
              disabled={busy || loading || Boolean(configurationError)}
              className="w-full rounded-md bg-gold py-2.5 text-sm font-bold text-primary-foreground disabled:opacity-60"
            >
              {busy ? "Sending…" : "Send reset link"}
            </button>
          </form>
        )}
        <p className="mt-6 text-center text-xs text-muted-foreground">
          <Link to="/login" className="text-gold hover:underline">
            Return to sign in
          </Link>
        </p>
      </div>
    </div>
  );
}
