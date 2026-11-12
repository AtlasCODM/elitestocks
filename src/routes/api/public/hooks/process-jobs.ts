import { timingSafeEqual } from "node:crypto";
import { createFileRoute } from "@tanstack/react-router";
import { supabaseAdmin } from "@/integrations/supabase/client.server";

function hasValidJobSecret(request: Request) {
  const expected = process.env.INVESTMENT_JOB_SECRET;
  if (!expected) return { configured: false, valid: false };
  const header = request.headers.get("authorization") ?? "";
  const prefix = "Bearer ";
  const providedToken = header.startsWith(prefix) ? header.slice(prefix.length) : "";
  const expectedBytes = Buffer.from(expected, "utf8");
  const providedBytes = Buffer.from(providedToken, "utf8");
  const width = Math.max(expectedBytes.length, providedBytes.length);
  const expectedPadded = Buffer.alloc(width);
  const providedPadded = Buffer.alloc(width);
  expectedBytes.copy(expectedPadded);
  providedBytes.copy(providedPadded);
  const equal = width > 0 && timingSafeEqual(expectedPadded, providedPadded);
  return { configured: true, valid: equal && expectedBytes.length === providedBytes.length };
}

async function processJobs() {
  const { data, error } = await supabaseAdmin.rpc("engine_process_jobs");
  if (error) throw new Error(error.message);
  return data;
}

export const Route = createFileRoute("/api/public/hooks/process-jobs")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const auth = hasValidJobSecret(request);
        if (!auth.configured) {
          return Response.json(
            { ok: false, error: "Job processor is not configured" },
            { status: 503 },
          );
        }
        if (!auth.valid) {
          return Response.json({ ok: false, error: "Unauthorized" }, { status: 401 });
        }
        try {
          const result = await processJobs();
          return Response.json({ ok: true, result, ts: new Date().toISOString() });
        } catch (e) {
          console.error("[process-jobs]", e);
          return Response.json({ ok: false, error: "Job processing failed" }, { status: 500 });
        }
      },
      GET: async () =>
        Response.json(
          { ok: false, error: "Method Not Allowed" },
          { status: 405, headers: { Allow: "POST" } },
        ),
    },
  },
});
