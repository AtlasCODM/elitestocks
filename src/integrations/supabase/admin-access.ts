import { createServerOnlyFn } from "@tanstack/react-start";

export const getSupabaseAdmin = createServerOnlyFn(async () => {
  const { supabaseAdmin } = await import("./client.server");
  return supabaseAdmin;
});
