import { createFileRoute } from "@tanstack/react-router";
import { getSupabaseAdmin } from "@/integrations/supabase/admin-access";

function constantTimeEqual(expected: string, provided: string) {
  const expectedBytes = new TextEncoder().encode(expected);
  const providedBytes = new TextEncoder().encode(provided);
  const width = Math.max(expectedBytes.length, providedBytes.length);
  let difference = expectedBytes.length ^ providedBytes.length;
  for (let index = 0; index < width; index += 1) {
    difference |= (expectedBytes[index] ?? 0) ^ (providedBytes[index] ?? 0);
  }
  return difference === 0;
}

function hasValidJobSecret(request: Request) {
  const expected = process.env.INVESTMENT_JOB_SECRET;
  if (!expected) return { configured: false, valid: false };
  const header = request.headers.get("authorization") ?? "";
  const prefix = "Bearer ";
  const providedToken = header.startsWith(prefix) ? header.slice(prefix.length) : "";
  return { configured: true, valid: constantTimeEqual(expected, providedToken) };
}

async function processJobs() {
  const supabaseAdmin = await getSupabaseAdmin();
  const { data, error } = await supabaseAdmin.rpc("engine_process_jobs");
  if (error) throw new Error(error.message);
  return data;
}

export const Route = createFileRoute("/api/public/hooks/process-jobs")({
  server: {
    handlers: {
      POST: async ({ request }: { request: Request }) => {
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
} as never);
