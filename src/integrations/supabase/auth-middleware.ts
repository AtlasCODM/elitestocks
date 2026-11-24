/* eslint-disable @typescript-eslint/no-explicit-any -- Supabase generated types predate workspace authorization tables. */
import { createMiddleware } from "@tanstack/react-start";
import { getRequest } from "@tanstack/react-start/server";
import { createClient } from "@supabase/supabase-js";
import type { Database } from "./types";
import { getServerSupabaseConfiguration } from "@/lib/config.server";
import { supabaseAdmin } from "./client.server";
import { PRIMARY_WORKSPACE_ID } from "./workspace";

function requestedWorkspaceId(request: Request) {
  const header = request.headers.get("x-workspace-id")?.trim();
  if (header) return header;

  const cookie = request.headers.get("cookie") ?? "";
  const match = cookie.match(/(?:^|;\s*)elitestocks_workspace_id=([^;]+)/);
  return match ? decodeURIComponent(match[1]) : PRIMARY_WORKSPACE_ID;
}

async function resolveWorkspace(userId: string, request: Request) {
  const workspaceId = requestedWorkspaceId(request);
  if (
    !/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(workspaceId)
  ) {
    throw new Error("Invalid workspace context");
  }

  const admin = supabaseAdmin as any;
  const [{ data: workspace, error: workspaceError }, { data: role, error: roleError }] =
    await Promise.all([
      admin.from("workspaces").select("id,is_active").eq("id", workspaceId).maybeSingle(),
      admin
        .from("user_roles")
        .select("role")
        .eq("user_id", userId)
        .eq("role", "admin")
        .maybeSingle(),
    ]);
  if (workspaceError) throw new Error(`Unable to resolve workspace: ${workspaceError.message}`);
  if (roleError) throw new Error(`Unable to resolve administrator role: ${roleError.message}`);
  if (!workspace?.is_active) throw new Error("Workspace is not active");

  const isAdmin = role?.role === "admin";
  if (!isAdmin) {
    const { data: membership, error } = await admin
      .from("workspace_members")
      .select("workspace_id")
      .eq("workspace_id", workspaceId)
      .eq("user_id", userId)
      .maybeSingle();
    if (error) throw new Error(`Unable to verify workspace membership: ${error.message}`);
    if (!membership) throw new Error("Forbidden: workspace membership required");
  }

  return { workspaceId, isAdmin };
}

export const requireSupabaseAuth = createMiddleware({ type: "function" }).server(
  async ({ next }) => {
    const { supabaseUrl, supabasePublishableKey, missing } = getServerSupabaseConfiguration();

    if (!supabaseUrl || !supabasePublishableKey) {
      const message = `Missing Supabase environment variable(s): ${missing.join(", ")}.`;
      console.error(`[Supabase] ${message}`);
      throw new Error(message);
    }

    const request = getRequest();
    if (!request?.headers) throw new Error("Unauthorized: No request headers available");

    const authHeader = request.headers.get("authorization");
    if (!authHeader) throw new Error("Unauthorized: No authorization header provided");
    if (!authHeader.startsWith("Bearer ")) {
      throw new Error("Unauthorized: Only Bearer tokens are supported");
    }

    const token = authHeader.replace("Bearer ", "");
    if (!token) throw new Error("Unauthorized: No token provided");

    const supabase = createClient<Database>(supabaseUrl, supabasePublishableKey, {
      global: { headers: { Authorization: `Bearer ${token}` } },
      auth: { storage: undefined, persistSession: false, autoRefreshToken: false },
    });

    const { data, error } = await supabase.auth.getClaims(token);
    if (error || !data?.claims) throw new Error("Unauthorized: Invalid token");
    if (!data.claims.sub) throw new Error("Unauthorized: No user ID found in token");

    const workspace = await resolveWorkspace(data.claims.sub, request);

    return next({
      context: {
        supabase,
        userId: data.claims.sub,
        claims: data.claims,
        ...workspace,
      },
    });
  },
);
