import { createFileRoute } from "@tanstack/react-router";
import { Header } from "@/components/site/Header";
import { Footer } from "@/components/site/Footer";
import { Ticker } from "@/components/site/Ticker";
import { Eye, Fingerprint, Lock, ShieldCheck, FileLock2, Snowflake } from "lucide-react";

export const Route = createFileRoute("/security")({
  head: () => ({
    meta: [
      { title: "Security & Infrastructure — Elite Stocks" },
      { name: "description", content: "Bank-grade custody architecture, multi-signature vaults, real-time threat monitoring." },
    ],
  }),
  component: SecurityPage,
});

function SecurityPage() {
  return (
    <div className="min-h-screen bg-background">
      <Header />
      <Ticker />
      <div className="mx-auto max-w-[1400px] px-4 py-10 lg:px-6">
        <div>
          <div className="text-xs uppercase tracking-widest text-gold">INFRASTRUCTURE & SECURITY</div>
          <h1 className="mt-2 font-display text-4xl font-bold tracking-tight md:text-5xl">
            Engineered for trust
          </h1>
          <p className="mt-2 max-w-2xl text-sm text-muted-foreground">
            Multi-layered custody, policy engine, and 24/7 forensic monitoring.
          </p>
        </div>

        <div className="mt-8 grid gap-4 md:grid-cols-3">
          {[
            { i: Snowflake, t: "Bank-Grade Cold Storage", d: "98% of assets in geo-distributed air-gapped vaults" },
            { i: Fingerprint, t: "Multi-Signature Vaults", d: "Threshold custody · M-of-N approval workflows" },
            { i: Eye, t: "Real-time Threat Monitoring", d: "24/7 SOC · behavioral anomaly detection" },
            { i: Lock, t: "Biometric Login", d: "FaceID / TouchID + hardware key attestation" },
            { i: FileLock2, t: "Encrypted Audit Trail", d: "Tamper-evident ledger of every action" },
            { i: ShieldCheck, t: "Insurance Coverage", d: "$500M custody insurance via Lloyd's syndicate" },
          ].map((f) => (
            <div key={f.t} className="panel p-6">
              <div className="inline-flex h-12 w-12 items-center justify-center rounded-lg border border-gold/30 bg-gold/5 text-gold">
                <f.i className="h-6 w-6" />
              </div>
              <h3 className="mt-4 font-semibold">{f.t}</h3>
              <p className="mt-1 text-sm text-muted-foreground">{f.d}</p>
            </div>
          ))}
        </div>

        <div className="mt-8 grid gap-4 lg:grid-cols-[1fr_1fr]">
          <div className="panel p-6">
            <div className="font-semibold">System Integrity Dashboard</div>
            <div className="mt-4 space-y-3">
              {[
                ["Matching Engine", "Operational", "100%"],
                ["Custody Vault A", "Operational", "100%"],
                ["Custody Vault B", "Operational", "100%"],
                ["API Gateway", "Operational", "99.99%"],
                ["AI Signal Engine", "Operational", "100%"],
                ["Web Frontend", "Operational", "100%"],
              ].map(([n, s, p]) => (
                <div key={n} className="flex items-center justify-between rounded-md border border-border bg-surface px-3 py-2.5 text-sm">
                  <span>{n}</span>
                  <div className="flex items-center gap-3">
                    <span className="font-mono text-[11px] text-muted-foreground">{p}</span>
                    <span className="inline-flex items-center gap-1.5 text-xs text-bull">
                      <span className="h-1.5 w-1.5 rounded-full bg-bull pulse-dot" /> {s}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="panel p-6">
            <div className="font-semibold">Audit Log</div>
            <div className="mt-4 space-y-2 font-mono text-[11px]">
              {[
                "20:42:18 · auth.login · success · IP 198.51.100.42",
                "20:41:02 · withdraw.policy · validated · BTC 0.12",
                "20:39:55 · vault.sign · 3-of-5 approved",
                "20:36:11 · api.key.rotate · scheduled",
                "20:31:08 · threat.scan · clean",
                "20:24:42 · session.create · device verified",
                "20:18:00 · cold.transfer · 12.4 BTC vault-A → vault-B",
              ].map((l, i) => (
                <div key={i} className="border-l-2 border-gold/40 pl-2 text-muted-foreground">{l}</div>
              ))}
            </div>
          </div>
        </div>
      </div>
      <Footer />
    </div>
  );
}
