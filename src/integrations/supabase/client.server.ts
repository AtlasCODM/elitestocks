// Server-side Supabase client with service role key - bypasses RLS.
// Use this for admin operations in server functions and server routes only.
// For user-authenticated queries (with RLS), use the auth middleware instead.
import { createClient } from "@supabase/supabase-js";
import process from "node:process";
import type { Database } from "./types";
import { getServerSupabaseConfiguration } from "@/lib/config.server";

function createSupabaseAdminClient() {
  const { supabaseUrl, missing } = getServerSupabaseConfiguration();
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  const missingVariables = [...missing, ...(!serviceRoleKey ? ["SUPABASE_SERVICE_ROLE_KEY"] : [])];

  if (!supabaseUrl || !serviceRoleKey) {
    const message = `Missing Supabase environment variable(s): ${missingVariables.join(", ")}.`;
    console.error(`[Supabase] ${message}`);
    throw new Error(message);
  }

  try {
    return createClient<Database>(supabaseUrl, serviceRoleKey, {
      auth: {
        storage: undefined,
        persistSession: false,
        autoRefreshToken: false,
      },
    });
  } catch {
    throw new Error("Unable to initialize the private Supabase service client.");
  }
}

let supabaseAdminClient: ReturnType<typeof createSupabaseAdminClient> | undefined;

// SECURITY: Only use this trusted server-side client; never expose it to browser code.
export const supabaseAdmin = new Proxy({} as ReturnType<typeof createSupabaseAdminClient>, {
  get(_, property, receiver) {
    if (!supabaseAdminClient) supabaseAdminClient = createSupabaseAdminClient();
    return Reflect.get(supabaseAdminClient, property, receiver);
  },
});
