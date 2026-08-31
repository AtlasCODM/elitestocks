import { Link, useNavigate } from "@tanstack/react-router";
import { Logo } from "./Logo";
import { Bell, LogOut, Menu, X } from "lucide-react";
import { useAuth, signOut } from "@/hooks/useAuth";
import { useEffect, useState } from "react";

const NAV = [
  { to: "/terminal", label: "Dashboard" },
  { to: "/wallet", label: "Wallet" },
  { to: "/strategies", label: "Invest" },
  { to: "/copy-trading", label: "Copy Trade" },
  { to: "/investments", label: "Investments" },
  { to: "/history", label: "History" },
  { to: "/profile", label: "Profile" },
] as const;

export function Header() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);

  useEffect(() => {
    if (open) document.body.style.overflow = "hidden";
    else document.body.style.overflow = "";
    return () => {
      document.body.style.overflow = "";
    };
  }, [open]);

  const handleSignOut = async () => {
    await signOut();
    setOpen(false);
    navigate({ to: "/" });
  };

  return (
    <>
      <header className="sticky top-0 z-50 border-b border-border/70 bg-background/90 backdrop-blur-xl">
        <div className="mx-auto flex h-14 max-w-[1600px] items-center gap-4 px-4 lg:px-6">
          <Link to="/" className="flex items-center gap-2" onClick={() => setOpen(false)}>
            <Logo />
            <span className="font-display text-lg font-bold tracking-tight">
              ELITE STOCKS<span className="text-gold">.</span>
            </span>
          </Link>

          <nav className="hidden items-center gap-1 xl:flex">
            {NAV.map((n) => (
              <Link
                key={n.to}
                to={n.to}
                className="rounded-md px-3 py-1.5 text-sm text-muted-foreground transition-colors hover:bg-surface-2 hover:text-foreground"
                activeProps={{ className: "text-gold bg-surface-2" }}
              >
                {n.label}
              </Link>
            ))}
          </nav>

          <div className="ml-auto flex items-center gap-2">
            <button className="hidden rounded-md border border-border bg-surface p-2 text-muted-foreground hover:text-foreground md:inline-flex">
              <Bell className="h-4 w-4" />
            </button>
            {user ? (
              <>
                <Link
                  to="/profile"
                  className="hidden rounded-md border border-border bg-surface px-3 py-1.5 text-xs font-semibold text-foreground hover:bg-surface-2 md:inline-block"
                >
                  {user.email?.split("@")[0]}
                </Link>
                <button
                  onClick={handleSignOut}
                  className="hidden rounded-md border border-border bg-surface p-2 text-muted-foreground hover:text-foreground md:inline-flex"
                  aria-label="Sign out"
                >
                  <LogOut className="h-4 w-4" />
                </button>
              </>
            ) : (
              <>
                <Link
                  to="/login"
                  className="hidden rounded-md border border-border bg-surface px-3 py-1.5 text-xs font-semibold text-foreground hover:bg-surface-2 sm:inline-block"
                >
                  Sign In
                </Link>
                <Link
                  to="/signup"
                  className="rounded-md bg-gold px-3 py-1.5 text-xs font-semibold text-primary-foreground hover:brightness-110"
                >
                  Open Account
                </Link>
              </>
            )}
            <button
              onClick={() => setOpen((s) => !s)}
              className="inline-flex rounded-md border border-border bg-surface p-2 text-muted-foreground hover:text-foreground xl:hidden"
              aria-label="Toggle menu"
              aria-expanded={open}
            >
              {open ? <X className="h-4 w-4" /> : <Menu className="h-4 w-4" />}
            </button>
          </div>
        </div>
      </header>
      {/* Rendered outside the sticky header so fixed layers cannot be clipped or
          trapped by its stacking context. */}
      {open && (
        <>
          <div
            className="fixed inset-0 z-[60] bg-black/60 backdrop-blur-sm xl:hidden"
            onClick={() => setOpen(false)}
          />
          <aside
            className="fixed inset-y-0 right-0 top-14 z-[70] w-72 max-w-[85vw] overflow-y-auto border-l border-border/70 bg-background shadow-2xl xl:hidden"
            aria-label="Mobile navigation"
          >
            <nav className="flex flex-col px-3 py-3">
              {NAV.map((n) => (
                <Link
                  key={n.to}
                  to={n.to}
                  onClick={() => setOpen(false)}
                  className="rounded-md px-3 py-3 text-sm font-medium text-muted-foreground hover:bg-surface-2 hover:text-foreground"
                  activeProps={{ className: "text-gold bg-surface-2" }}
                >
                  {n.label}
                </Link>
              ))}
              <div className="my-2 border-t border-border" />
              {user ? (
                <button
                  onClick={handleSignOut}
                  className="flex items-center gap-2 rounded-md px-3 py-3 text-left text-sm text-muted-foreground hover:bg-surface-2 hover:text-foreground"
                >
                  <LogOut className="h-4 w-4" /> Sign out
                </button>
              ) : (
                <>
                  <Link
                    to="/login"
                    onClick={() => setOpen(false)}
                    className="rounded-md px-3 py-3 text-sm font-medium text-muted-foreground hover:bg-surface-2 hover:text-foreground"
                  >
                    Sign In
                  </Link>
                  <Link
                    to="/signup"
                    onClick={() => setOpen(false)}
                    className="mt-1 rounded-md bg-gold px-3 py-3 text-center text-sm font-semibold text-primary-foreground"
                  >
                    Open Account
                  </Link>
                </>
              )}
            </nav>
          </aside>
        </>
      )}
    </>
  );
}
