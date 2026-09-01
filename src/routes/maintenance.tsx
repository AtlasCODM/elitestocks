import { createFileRoute } from "@tanstack/react-router";
import { Logo } from "@/components/site/Logo";
import { Clock3, ShieldCheck } from "lucide-react";

export const Route = createFileRoute("/maintenance")({
  head: () => ({
    meta: [
      { title: "Maintenance — Elite Stocks" },
      {
        name: "description",
        content: "Elite Stocks is temporarily unavailable while we perform scheduled maintenance.",
      },
    ],
  }),
  component: MaintenancePage,
});

export function MaintenancePage() {
  return (
    <main className="grid min-h-screen place-items-center bg-background px-6 py-12">
      <section className="panel relative w-full max-w-xl overflow-hidden p-8 text-center sm:p-12">
        <div className="pointer-events-none absolute inset-0 radial-gold opacity-60" />
        <div className="relative">
          <Logo className="mx-auto h-14 w-14" />
          <div className="mt-8 inline-flex items-center gap-2 rounded-full border border-gold/30 bg-gold/10 px-3 py-1.5 text-xs font-semibold uppercase tracking-[0.18em] text-gold">
            <Clock3 className="h-3.5 w-3.5" /> Scheduled maintenance
          </div>
          <h1 className="mt-6 font-display text-4xl font-bold tracking-tight sm:text-5xl">
            We’ll be back shortly.
          </h1>
          <p className="mx-auto mt-4 max-w-md text-sm leading-6 text-muted-foreground">
            Elite Stocks is temporarily offline while we improve the platform. Your account and
            funds remain protected, and access will return automatically when maintenance is
            complete.
          </p>
          <div className="mt-8 flex items-center justify-center gap-2 text-xs text-muted-foreground">
            <ShieldCheck className="h-4 w-4 text-bull" /> Secure platform maintenance in progress
          </div>
        </div>
      </section>
    </main>
  );
}
