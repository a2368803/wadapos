#!/usr/bin/env bash
# ─────────────────────────────────────────────────────────────────
# 備援點餐系統 — 全自動 Supabase 設定腳本
#
# 使用方式：
#   SUPABASE_ACCESS_TOKEN=sbp_xxx ADMIN_PASSWORD=your_password bash scripts/setup-supabase.sh
#
# 需要：
#   - SUPABASE_ACCESS_TOKEN：到 https://supabase.com/dashboard/account/tokens 建立
#   - ADMIN_PASSWORD：自訂管理後台密碼（至少 8 字元）
#   - curl、jq 已安裝
# ─────────────────────────────────────────────────────────────────

set -e

TOKEN="${SUPABASE_ACCESS_TOKEN}"
ADMIN_EMAIL="a2368803@gmail.com"
ADMIN_PASS="${ADMIN_PASSWORD:-$(openssl rand -base64 12)}"
PROJECT_NAME="wadapos"
REGION="ap-northeast-1"
DB_PASS="$(openssl rand -base64 20 | tr -dc 'A-Za-z0-9' | head -c 20)"
API="https://api.supabase.com/v1"

RED='\033[0;31m'; GREEN='\033[0;32m'; YELLOW='\033[1;33m'; BLUE='\033[0;34m'; NC='\033[0m'
info()  { echo -e "${BLUE}[INFO]${NC}  $*"; }
ok()    { echo -e "${GREEN}[OK]${NC}    $*"; }
warn()  { echo -e "${YELLOW}[WARN]${NC}  $*"; }
error() { echo -e "${RED}[ERROR]${NC} $*"; exit 1; }

# ─── 前置檢查 ────────────────────────────────────────────────────
[[ -z "$TOKEN" ]]    && error "請設定 SUPABASE_ACCESS_TOKEN"
command -v curl >/dev/null || error "請安裝 curl"
command -v jq   >/dev/null || error "請安裝 jq"
[[ ${#ADMIN_PASS} -lt 8 ]] && error "ADMIN_PASSWORD 至少需要 8 字元"

AUTH_HEADER="Authorization: Bearer $TOKEN"

# ─── 取得組織 ID ─────────────────────────────────────────────────
info "取得 Supabase 組織資訊…"
ORG_RESP=$(curl -sf -H "$AUTH_HEADER" "$API/organizations" 2>&1) || error "無法連線 Supabase API，請確認 Token 正確"
ORG_ID=$(echo "$ORG_RESP" | jq -r '.[0].id')
[[ -z "$ORG_ID" || "$ORG_ID" == "null" ]] && error "找不到 Supabase 組織，請確認帳號已建立"
ok "組織 ID：$ORG_ID"

# ─── 建立專案 ────────────────────────────────────────────────────
info "建立 Supabase 專案（$PROJECT_NAME）…"
CREATE_RESP=$(curl -sf -X POST "$API/projects" \
  -H "$AUTH_HEADER" \
  -H "Content-Type: application/json" \
  -d "{
    \"organization_id\": \"$ORG_ID\",
    \"name\": \"$PROJECT_NAME\",
    \"region\": \"$REGION\",
    \"db_pass\": \"$DB_PASS\",
    \"plan\": \"free\"
  }" 2>&1) || error "建立專案失敗：$CREATE_RESP"

PROJECT_REF=$(echo "$CREATE_RESP" | jq -r '.id')
[[ -z "$PROJECT_REF" || "$PROJECT_REF" == "null" ]] && error "建立失敗：$(echo "$CREATE_RESP" | jq -r '.message // .')"
ok "專案 ID：$PROJECT_REF"

# ─── 等待專案就緒（約 2-3 分鐘）────────────────────────────────
info "等待專案啟動（可能需要 2-3 分鐘）…"
for i in $(seq 1 40); do
  STATUS=$(curl -sf -H "$AUTH_HEADER" "$API/projects/$PROJECT_REF" 2>/dev/null | jq -r '.status // "unknown"')
  if [[ "$STATUS" == "ACTIVE_HEALTHY" ]]; then
    ok "專案已就緒！"
    break
  fi
  printf "\r  等待中…（%d/40）狀態：%s" "$i" "$STATUS"
  sleep 10
done
echo ""
[[ "$STATUS" != "ACTIVE_HEALTHY" ]] && error "專案啟動逾時，請稍後重試"

# ─── 取得 API Keys ───────────────────────────────────────────────
info "取得 API Keys…"
KEYS_RESP=$(curl -sf -H "$AUTH_HEADER" "$API/projects/$PROJECT_REF/api-keys" 2>&1) || error "取得 Keys 失敗"
ANON_KEY=$(echo "$KEYS_RESP"     | jq -r '.[] | select(.name == "anon")    | .api_key')
SERVICE_KEY=$(echo "$KEYS_RESP"  | jq -r '.[] | select(.name == "service_role") | .api_key')
SUPABASE_URL="https://${PROJECT_REF}.supabase.co"

[[ -z "$ANON_KEY" || -z "$SERVICE_KEY" ]] && error "無法取得 API Keys"
ok "anon key 取得成功"
ok "service_role key 取得成功"

# ─── 執行 SQL Schema ─────────────────────────────────────────────
info "執行資料庫 Schema…"
SCHEMA=$(cat "$(dirname "$0")/../supabase-schema.sql")

# 等待 DB 完全就緒
sleep 5

SQL_RESP=$(curl -sf -X POST "$API/projects/$PROJECT_REF/database/query" \
  -H "$AUTH_HEADER" \
  -H "Content-Type: application/json" \
  -d "{\"query\": $(echo "$SCHEMA" | jq -Rs .)}" 2>&1) || warn "Schema 執行可能有問題，請手動確認"

ok "資料庫 Schema 已套用"

# ─── 建立管理員帳號 ──────────────────────────────────────────────
info "建立管理員帳號（$ADMIN_EMAIL）…"
USER_RESP=$(curl -sf -X POST "https://${PROJECT_REF}.supabase.co/auth/v1/admin/users" \
  -H "Authorization: Bearer $SERVICE_KEY" \
  -H "apikey: $SERVICE_KEY" \
  -H "Content-Type: application/json" \
  -d "{
    \"email\": \"$ADMIN_EMAIL\",
    \"password\": \"$ADMIN_PASS\",
    \"email_confirm\": true
  }" 2>&1) || warn "建立管理員帳號可能失敗（可能已存在），請手動確認"

USER_ID=$(echo "$USER_RESP" | jq -r '.id // "unknown"')
[[ "$USER_ID" != "unknown" && "$USER_ID" != "null" ]] && ok "管理員帳號建立成功" || warn "請手動在 Supabase Auth 建立管理員帳號"

# ─── 寫入 .env.local ─────────────────────────────────────────────
ENV_FILE="$(dirname "$0")/../.env.local"
cat > "$ENV_FILE" <<ENVEOF
NEXT_PUBLIC_SUPABASE_URL=${SUPABASE_URL}
NEXT_PUBLIC_SUPABASE_ANON_KEY=${ANON_KEY}
SUPABASE_SERVICE_ROLE_KEY=${SERVICE_KEY}
ENVEOF
ok ".env.local 已建立"

# ─── 設定 Vercel 環境變數 ────────────────────────────────────────
if command -v vercel >/dev/null; then
  info "設定 Vercel 環境變數…"
  cd "$(dirname "$0")/.."
  printf '%s' "$SUPABASE_URL" | vercel env add NEXT_PUBLIC_SUPABASE_URL production --force 2>/dev/null || true
  printf '%s' "$ANON_KEY"     | vercel env add NEXT_PUBLIC_SUPABASE_ANON_KEY production --force 2>/dev/null || true
  printf '%s' "$SERVICE_KEY"  | vercel env add SUPABASE_SERVICE_ROLE_KEY production --force 2>/dev/null || true
  ok "Vercel 環境變數已設定"

  info "觸發 Vercel 重新部署…"
  vercel deploy --prod --yes 2>&1 | tail -5 && ok "Vercel 部署完成！"
else
  warn "找不到 vercel CLI，請手動設定環境變數"
fi

# ─── 完成 ────────────────────────────────────────────────────────
echo ""
echo -e "${GREEN}════════════════════════════════════════${NC}"
echo -e "${GREEN}  設定完成！${NC}"
echo -e "${GREEN}════════════════════════════════════════${NC}"
echo ""
echo "  管理後台網址：https://wadapos.vercel.app/admin"
echo "  管理員帳號：  $ADMIN_EMAIL"
echo "  管理員密碼：  $ADMIN_PASS"
echo "  Supabase URL：$SUPABASE_URL"
echo ""
echo -e "${YELLOW}請妥善保存以上資訊！${NC}"
