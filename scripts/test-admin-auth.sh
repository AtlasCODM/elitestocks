#!/usr/bin/env bash
set -euo pipefail

# Usage:
#   SUPABASE_URL=https://... \
#   SUPABASE_PUBLISHABLE_KEY=... \
#   ADMIN_USER_ID=... \
#   ACCESS_TOKEN=... \
#   APP_URL=https://... \
#   ./scripts/test-admin-auth.sh
#
# ACCESS_TOKEN is the current Supabase access_token for the account being tested.
# Do not paste tokens into shell history or commit them.

: "${APP_URL:?Set APP_URL to the deployed Vercel URL}"
: "${SUPABASE_URL:?Set SUPABASE_URL to the Supabase project URL}"
: "${SUPABASE_PUBLISHABLE_KEY:?Set SUPABASE_PUBLISHABLE_KEY to the anon/publishable key}"
: "${ADMIN_USER_ID:?Set ADMIN_USER_ID to the authenticated user's UUID}"
: "${ACCESS_TOKEN:?Set ACCESS_TOKEN to the user's current Supabase access token}"

ADMIN_ACCESS_FN_ID="${ADMIN_ACCESS_FN_ID:-c537c61a4035f3abece539c0e61b1c7c8962bbde05db253e67fd0274eec024ea}"
ADMIN_STATE_FN_ID="${ADMIN_STATE_FN_ID:-7570dd1f4ad41aacc5bf163b18cd3d1e9cf6b6ebdfcb9eb0015c4f968c59db8d}"
AUTH_HEADERS=(-H "Authorization: Bearer ${ACCESS_TOKEN}")
SUPABASE_HEADERS=(
  -H "apikey: ${SUPABASE_PUBLISHABLE_KEY}"
  -H "Authorization: Bearer ${ACCESS_TOKEN}"
  -H "Accept-Profile: public"
)

request() {
  local label="$1"; shift
  local body_file
  body_file="$(mktemp)"
  local status
  status="$(curl --silent --show-error --output "$body_file" --write-out '%{http_code}' "$@")"
  echo
  echo "===== ${label} (HTTP ${status}) ====="
  if command -v jq >/dev/null 2>&1; then
    jq . "$body_file" 2>/dev/null || cat "$body_file"
  else
    cat "$body_file"
  fi
  rm -f "$body_file"
}

# 1. Normal route request. The admin data is loaded by the server function below;
# this confirms whether the deployed route itself is reachable.
request "GET /admin route" \
  "${APP_URL%/}/admin" \
  "${AUTH_HEADERS[@]}" \
  -H 'Accept: text/html'

# 2. Exact TanStack Start server-function request used by getAdminAccess.
request "getAdminAccess server function" \
  "${APP_URL%/}/_serverFn/${ADMIN_ACCESS_FN_ID}" \
  "${AUTH_HEADERS[@]}" \
  -H 'x-tsr-serverFn: true' \
  -H 'Accept: application/json'

# 3. Exact protected admin data request used by /admin.
request "getAdminState server function" \
  "${APP_URL%/}/_serverFn/${ADMIN_STATE_FN_ID}" \
  "${AUTH_HEADERS[@]}" \
  -H 'x-tsr-serverFn: true' \
  -H 'Accept: application/json'

# 4. Direct authenticated read of the role table. A 200 with an admin row proves
# the current user's RLS policy permits this query. A 401/403 identifies RLS/auth.
request "authenticated user_roles admin row" \
  "${SUPABASE_URL%/}/rest/v1/user_roles?select=user_id,role&user_id=eq.${ADMIN_USER_ID}&role=eq.admin&limit=1" \
  "${SUPABASE_HEADERS[@]}"

# 5. The database function must derive auth.uid() from the same bearer token.
request "authenticated is_admin RPC" \
  "${SUPABASE_URL%/}/rest/v1/rpc/is_admin" \
  "${SUPABASE_HEADERS[@]}" \
  -H 'Content-Type: application/json' \
  --data '{}'
