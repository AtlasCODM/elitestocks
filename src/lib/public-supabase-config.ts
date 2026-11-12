import publicConfiguration from "../../supabase.public.config.json";

export type PublicSupabaseConnection = {
  supabaseUrl: string | null;
  supabasePublishableKey: string | null;
  configured: boolean;
};

function text(value: unknown) {
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

export function isBrowserSafeSupabaseKey(value: unknown): boolean {
  const key = text(value);
  if (!key || key.startsWith("sb_secret_")) return false;
  if (/^sb_publishable_[A-Za-z0-9_-]+$/.test(key)) return true;
  const parts = key.split(".");
  if (parts.length !== 3 || parts.some((part) => !/^[A-Za-z0-9_-]+$/.test(part))) return false;
  try {
    const payload = parts[1].replace(/-/g, "+").replace(/_/g, "/");
    const claims = JSON.parse(globalThis.atob(payload)) as Record<string, unknown>;
    // Legacy anon JWTs are browser-safe; service_role/user tokens are not public config.
    return claims.role === "anon";
  } catch {
    return false;
  }
}

function safeUrl(value: unknown) {
  const candidate = text(value);
  if (!candidate) return null;
  try {
    const url = new URL(candidate);
    const local = ["localhost", "127.0.0.1", "[::1]"].includes(url.hostname);
    if (url.username || url.password || url.search || url.hash) return null;
    if (url.protocol !== "https:" && !(url.protocol === "http:" && local)) return null;
    return url.toString().replace(/\/$/, "");
  } catch {
    return null;
  }
}

/** Environment overrides are a complete pair; never mix credentials across projects. */
export function resolvePublicSupabaseConnection(
  overrideUrl?: unknown,
  overrideKey?: unknown,
  defaults: { supabaseUrl?: unknown; supabasePublishableKey?: unknown } = publicConfiguration,
): PublicSupabaseConnection {
  const hasOverride = text(overrideUrl) !== null || text(overrideKey) !== null;
  const source = hasOverride
    ? { supabaseUrl: overrideUrl, supabasePublishableKey: overrideKey }
    : defaults;
  const supabaseUrl = safeUrl(source.supabaseUrl);
  const supabasePublishableKey = isBrowserSafeSupabaseKey(source.supabasePublishableKey)
    ? text(source.supabasePublishableKey)
    : null;
  return {
    supabaseUrl,
    supabasePublishableKey,
    configured: Boolean(supabaseUrl && supabasePublishableKey),
  };
}
