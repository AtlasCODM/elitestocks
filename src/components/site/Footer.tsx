import { Link } from "@tanstack/react-router";
import { Logo } from "./Logo";

export function Footer() {
  return (
    <footer className="mt-24 border-t border-border bg-surface/40">
      <div className="mx-auto grid max-w-[1600px] gap-10 px-6 py-14 md:grid-cols-5">
        <div className="md:col-span-2">
          <div className="flex items-center gap-2">
            <Logo />
            <span className="font-display text-lg font-bold tracking-tight">
              ELITE STOCK<span className="text-gold">.</span>
            </span>
          </div>
          <p className="mt-4 max-w-sm text-sm text-muted-foreground">
            Institutional-grade digital asset trading infrastructure. Engineered for
            scale, security, and execution.
          </p>
          <div className="mt-6 flex items-center gap-4 text-xs text-muted-foreground">
            <span>elite.stock</span>
            <span className="text-border">·</span>
            <span>contact@elitestock.cc</span>
          </div>
        </div>

        <FooterCol
          title="Platform"
          links={[
            ["Trading Terminal", "/terminal"],
            ["Markets", "/markets"],
            ["Copy Trading", "/copy-trading"],
            ["AI Intelligence", "/ai"],
          ]}
        />
        <FooterCol
          title="Products"
          links={[
            ["Strategies", "/strategies"],
            ["Wallet", "/wallet"],
            ["Security", "/security"],
          ]}
        />
        <FooterCol
          title="Company"
          links={[
            ["About", "/"],
            ["Newsroom", "/"],
            ["Careers", "/"],
            ["Legal", "/"],
          ]}
        />
      </div>
      <div className="border-t border-border/60 py-5">
        <div className="mx-auto flex max-w-[1600px] flex-col items-start justify-between gap-2 px-6 text-xs text-muted-foreground md:flex-row md:items-center">
          <span>© 2026 Elite Stock. All rights reserved.</span>
          <span>System status: <span className="text-bull">All systems operational</span></span>
        </div>
      </div>
    </footer>
  );
}

function FooterCol({ title, links }: { title: string; links: [string, string][] }) {
  return (
    <div>
      <div className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
        {title}
      </div>
      <ul className="mt-4 space-y-2 text-sm">
        {links.map(([l, to]) => (
          <li key={l}>
            <Link to={to} className="text-foreground/80 hover:text-gold">
              {l}
            </Link>
          </li>
        ))}
      </ul>
    </div>
  );
}
