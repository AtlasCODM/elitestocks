import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { Header } from "@/components/site/Header";
import { Footer } from "@/components/site/Footer";
import { useAuth, signOut } from "@/hooks/useAuth";
import { useEffect } from "react";
import { LogOut, ShieldCheck, Wallet, TrendingUp } from "lucide-react";
import { useServerFn } from "@tanstack/react-start";
import { useQuery } from "@tanstack/react-query";
import { getAdminAccess } from "@/lib/admin.functions";

export const Route = createFileRoute("/profile")({
  head: () => ({
    meta: [
      { title: "Profile — Elite Stocks" },
      { name: "description", content: "Your Elite Stocks account." },
    ],
  }),
  component: ProfilePage,
});

function ProfilePage() {
  const { user, loading } = useAuth();
  const navigate = useNavigate();
  const checkAdmin = useServerFn(getAdminAccess);
  const { data: adminAccess } = useQuery({
    queryKey: ["admin-access", user?.id],
    queryFn: () => checkAdmin(),
    enabled: Boolean(user),
    staleTime: 30_000,
  });

  useEffect(() => {
    if (!loading && !user) navigate({ to: "/login" });
  }, [user, loading, navigate]);

  if (loading || !user) return <div className="min-h-screen bg-background" />;

  const name =
    (user.user_metadata?.display_name as string) || user.email?.split("@")[0] || "Trader";

  return (
    <div className="min-h-screen bg-background">
      <Header />
      <div className="mx-auto max-w-[1000px] px-4 py-10 lg:px-6">
        <h1 className="font-display text-4xl font-bold tracking-tight">Profile</h1>
        <p className="mt-1 text-sm text-muted-foreground">Account details and quick actions.</p>

        <div className="mt-8 panel p-6">
          <div className="flex items-center gap-4">
            <div className="flex h-16 w-16 items-center justify-center rounded-full bg-gold/15 text-2xl font-bold text-gold">
              {name.charAt(0).toUpperCase()}
            </div>
            <div>
              <div className="font-display text-xl font-bold">{name}</div>
              <div className="text-sm text-muted-foreground">{user.email}</div>
              <div className="mt-1 inline-flex items-center gap-1 rounded bg-bull/10 px-2 py-0.5 text-[11px] text-bull">
                <ShieldCheck className="h-3 w-3" /> Verified account
              </div>
            </div>
          </div>

          <dl className="mt-8 grid gap-4 sm:grid-cols-2">
            <div className="rounded-md border border-border bg-surface p-4">
              <dt className="text-[11px] uppercase tracking-wider text-muted-foreground">
                User ID
              </dt>
              <dd className="mt-1 font-mono text-xs">{user.id}</dd>
            </div>
            <div className="rounded-md border border-border bg-surface p-4">
              <dt className="text-[11px] uppercase tracking-wider text-muted-foreground">Joined</dt>
              <dd className="mt-1 font-mono text-xs">
                {new Date(user.created_at).toLocaleDateString()}
              </dd>
            </div>
          </dl>
        </div>

        <div className="mt-6 grid gap-4 sm:grid-cols-3">
          {adminAccess?.isAdmin && (
            <Link to="/admin" className="panel flex items-center gap-3 p-5 hover:border-gold">
              <ShieldCheck className="h-5 w-5 text-gold" />
              <div>
                <div className="font-semibold">Admin Dashboard</div>
                <div className="text-xs text-muted-foreground">Manage platform activity</div>
              </div>
            </Link>
          )}
          <Link to="/wallet" className="panel flex items-center gap-3 p-5 hover:border-gold">
            <Wallet className="h-5 w-5 text-gold" />
            <div>
              <div className="font-semibold">Wallet</div>
              <div className="text-xs text-muted-foreground">Deposit & withdraw</div>
            </div>
          </Link>
          <Link to="/strategies" className="panel flex items-center gap-3 p-5 hover:border-gold">
            <TrendingUp className="h-5 w-5 text-gold" />
            <div>
              <div className="font-semibold">Invest</div>
              <div className="text-xs text-muted-foreground">Strategy plans</div>
            </div>
          </Link>
          <button
            onClick={async () => {
              await signOut();
              navigate({ to: "/" });
            }}
            className="panel flex items-center gap-3 p-5 text-left hover:border-bear"
          >
            <LogOut className="h-5 w-5 text-bear" />
            <div>
              <div className="font-semibold">Sign out</div>
              <div className="text-xs text-muted-foreground">End your session</div>
            </div>
          </button>
        </div>
      </div>
      <Footer />
    </div>
  );
}
