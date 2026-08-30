import { createFileRoute } from "@tanstack/react-router";
import { supabaseAdmin } from "@/integrations/supabase/client.server";

// Background processor:
//   • Deposits  : pending_confirmation → verifying → confirmed (credits wallet)
//   • Withdrawals: pending (0-2m) → processing (2-4m) → successful (5m+)
//   • Investments / Copy trades: credit capital + profit at maturity
//
// Idempotent: each transition uses status filters so re-runs are safe.
async function processJobs() {
  const now = Date.now();

  // ----- DEPOSITS -----
  const { data: deposits } = await supabaseAdmin
    .from("transactions")
    .select("*")
    .eq("type", "deposit")
    .in("status", ["pending_confirmation", "verifying", "pending"])
    .order("created_at", { ascending: true })
    .limit(200);

  for (const tx of deposits ?? []) {
    const ageMs = now - new Date(tx.created_at).getTime();
    // Single ~5 minute transition: pending → confirmed (credits wallet)
    if (ageMs >= 300_000) {
      const { data: w } = await supabaseAdmin
        .from("wallets")
        .select("balance")
        .eq("user_id", tx.user_id)
        .eq("asset", tx.asset)
        .single();
      if (w) {
        await supabaseAdmin
          .from("wallets")
          .update({
            balance: Number(w.balance) + Number(tx.amount),
            updated_at: new Date().toISOString(),
          })
          .eq("user_id", tx.user_id)
          .eq("asset", tx.asset);
      }
      await supabaseAdmin
        .from("transactions")
        .update({ status: "confirmed", updated_at: new Date().toISOString() })
        .eq("id", tx.id)
        .in("status", ["pending_confirmation", "verifying", "pending"]);
    }
  }

  // ----- WITHDRAWALS -----
  const { data: withdrawals } = await supabaseAdmin
    .from("transactions")
    .select("*")
    .eq("type", "withdrawal")
    .in("status", ["pending", "processing"])
    .order("created_at", { ascending: true })
    .limit(200);

  for (const tx of withdrawals ?? []) {
    const ageMs = now - new Date(tx.created_at).getTime();
    if (tx.status === "pending" && ageMs >= 120_000) {
      await supabaseAdmin
        .from("transactions")
        .update({ status: "processing", updated_at: new Date().toISOString() })
        .eq("id", tx.id)
        .eq("status", "pending");
    } else if (tx.status === "processing" && ageMs >= 300_000) {
      await supabaseAdmin
        .from("transactions")
        .update({ status: "successful", updated_at: new Date().toISOString() })
        .eq("id", tx.id)
        .eq("status", "processing");
    }
  }

  // ----- INVESTMENT MATURITY -----
  const { data: matured } = await supabaseAdmin
    .from("investments")
    .select("*")
    .eq("status", "active")
    .lte("matures_at", new Date().toISOString())
    .limit(200);

  for (const inv of matured ?? []) {
    const payout = Number(inv.amount) * (1 + Number(inv.profit_pct) / 100);
    const { data: w } = await supabaseAdmin
      .from("wallets")
      .select("balance")
      .eq("user_id", inv.user_id)
      .eq("asset", inv.asset)
      .single();
    if (w) {
      await supabaseAdmin
        .from("wallets")
        .update({
          balance: Number(w.balance) + payout,
          updated_at: new Date().toISOString(),
        })
        .eq("user_id", inv.user_id)
        .eq("asset", inv.asset);
    }
    const { data: updated } = await supabaseAdmin
      .from("investments")
      .update({ status: "matured", completed_at: new Date().toISOString() })
      .eq("id", inv.id)
      .eq("status", "active")
      .select();
    if (updated && updated.length > 0) {
      await supabaseAdmin.from("transactions").insert({
        user_id: inv.user_id,
        type: "return",
        amount: payout,
        asset: inv.asset,
        status: "completed",
        reference_id: inv.id,
        metadata: {
          plan: inv.plan_tier,
          principal: Number(inv.amount),
          profit_pct: Number(inv.profit_pct),
        },
      });
    }
  }

  // ----- COPY TRADE MATURITY -----
  const { data: maturedCopies } = await supabaseAdmin
    .from("copy_trades")
    .select("*")
    .eq("status", "active")
    .lte("matures_at", new Date().toISOString())
    .limit(200);

  for (const ct of maturedCopies ?? []) {
    const payout = Number(ct.amount) * (1 + Number(ct.profit_pct) / 100);
    const { data: w } = await supabaseAdmin
      .from("wallets")
      .select("balance")
      .eq("user_id", ct.user_id)
      .eq("asset", ct.asset)
      .single();
    if (w) {
      await supabaseAdmin
        .from("wallets")
        .update({
          balance: Number(w.balance) + payout,
          updated_at: new Date().toISOString(),
        })
        .eq("user_id", ct.user_id)
        .eq("asset", ct.asset);
    }
    const { data: updated } = await supabaseAdmin
      .from("copy_trades")
      .update({ status: "matured", completed_at: new Date().toISOString() })
      .eq("id", ct.id)
      .eq("status", "active")
      .select();
    if (updated && updated.length > 0) {
      await supabaseAdmin.from("transactions").insert({
        user_id: ct.user_id,
        type: "copy_return",
        amount: payout,
        asset: ct.asset,
        status: "completed",
        reference_id: ct.id,
        metadata: {
          principal: Number(ct.amount),
          profit_pct: Number(ct.profit_pct),
        },
      });
    }
  }
}

export const Route = createFileRoute("/api/public/hooks/process-jobs")({
  server: {
    handlers: {
      POST: async () => {
        try {
          await processJobs();
          return Response.json({ ok: true, ts: new Date().toISOString() });
        } catch (e) {
          console.error("[process-jobs]", e);
          return new Response(
            JSON.stringify({ ok: false, error: (e as Error).message }),
            { status: 500, headers: { "Content-Type": "application/json" } },
          );
        }
      },
      GET: async () => {
        try {
          await processJobs();
          return Response.json({ ok: true, ts: new Date().toISOString() });
        } catch (e) {
          return new Response((e as Error).message, { status: 500 });
        }
      },
    },
  },
});
