import { NextRequest, NextResponse } from 'next/server'
import { createServiceRoleClient } from '@/lib/supabase-server'
import type { CreateOrderPayload } from '@/types'

// ─── 簡易 IP 限流（記憶體，Vercel 無狀態環境適用） ─────────────
const rateLimitStore = new Map<string, { count: number; reset: number }>()

function checkRateLimit(ip: string): boolean {
  const now = Date.now()
  const window = 60_000 // 1 分鐘
  const limit = 20      // 每 IP 每分鐘最多 20 筆訂單

  const entry = rateLimitStore.get(ip)
  if (!entry || now > entry.reset) {
    rateLimitStore.set(ip, { count: 1, reset: now + window })
    return true
  }
  if (entry.count >= limit) return false
  entry.count++
  return true
}

// ─── 輸入驗證 ────────────────────────────────────────────────────
function sanitize(str: unknown, maxLen = 100): string {
  if (typeof str !== 'string') return ''
  return str.trim().slice(0, maxLen)
    .replace(/[<>]/g, '') // 移除尖括號防 XSS
}

function validatePayload(body: unknown): { valid: true; data: CreateOrderPayload } | { valid: false; error: string } {
  if (!body || typeof body !== 'object') return { valid: false, error: '無效資料' }
  const b = body as Record<string, unknown>

  if (!['dine-in', 'takeout'].includes(b.order_type as string)) {
    return { valid: false, error: '無效的訂單類型' }
  }
  if (!['customer', 'staff'].includes(b.created_by as string)) {
    return { valid: false, error: '無效的建立者類型' }
  }
  if (b.order_type === 'dine-in' && !sanitize(b.table_number)) {
    return { valid: false, error: '內用訂單需輸入桌號' }
  }
  if (b.order_type === 'takeout' && !sanitize(b.pickup_number)) {
    return { valid: false, error: '外帶訂單需輸入取餐號' }
  }
  if (!Array.isArray(b.items) || b.items.length === 0) {
    return { valid: false, error: '訂單需至少一個品項' }
  }
  if (b.items.length > 50) {
    return { valid: false, error: '單筆訂單品項上限 50 個' }
  }

  for (const item of b.items) {
    if (!item || typeof item !== 'object') return { valid: false, error: '品項資料無效' }
    const it = item as Record<string, unknown>
    if (typeof it.item_name !== 'string' || !it.item_name.trim()) {
      return { valid: false, error: '品項名稱不可空白' }
    }
    if (typeof it.item_price !== 'number' || it.item_price < 0 || it.item_price > 99999) {
      return { valid: false, error: '品項價格無效' }
    }
    if (typeof it.quantity !== 'number' || !Number.isInteger(it.quantity) || it.quantity < 1 || it.quantity > 99) {
      return { valid: false, error: '品項數量無效（1–99）' }
    }
  }

  if (!sanitize(b.idempotency_key, 80)) {
    return { valid: false, error: '缺少 idempotency_key' }
  }

  return { valid: true, data: b as unknown as CreateOrderPayload }
}

// ─── POST /api/orders ────────────────────────────────────────────
export async function POST(request: NextRequest) {
  // IP 限流
  const ip =
    request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ??
    request.headers.get('x-real-ip') ??
    'unknown'

  if (!checkRateLimit(ip)) {
    return NextResponse.json(
      { error: '請求過於頻繁，請稍後再試' },
      { status: 429 }
    )
  }

  // 解析 body
  let rawBody: unknown
  try {
    rawBody = await request.json()
  } catch {
    return NextResponse.json({ error: '請求格式錯誤' }, { status: 400 })
  }

  // 驗證
  const validated = validatePayload(rawBody)
  if (!validated.valid) {
    return NextResponse.json({ error: validated.error }, { status: 400 })
  }

  const payload = validated.data

  // 計算小計
  const subtotal = payload.items.reduce(
    (sum, item) => sum + item.item_price * item.quantity,
    0
  )

  // 建立訂單（使用 service_role，繞過 RLS）
  const supabase = createServiceRoleClient()

  // 先檢查 idempotency_key（防重複送出）
  const idKey = sanitize(payload.idempotency_key, 80)
  const { data: existing } = await supabase
    .from('orders')
    .select('id, order_number')
    .eq('idempotency_key', idKey)
    .maybeSingle()

  if (existing) {
    // 相同 key 的訂單已存在 → 回傳原訂單（冪等性）
    return NextResponse.json(
      { id: existing.id, order_number: existing.order_number, duplicate: true },
      { status: 200 }
    )
  }

  // 建立主單
  const { data: order, error: orderError } = await supabase
    .from('orders')
    .insert({
      order_type: payload.order_type,
      table_number: payload.order_type === 'dine-in'
        ? sanitize(payload.table_number, 20)
        : null,
      pickup_number: payload.order_type === 'takeout'
        ? sanitize(payload.pickup_number, 20)
        : null,
      customer_note: sanitize(payload.customer_note, 200) || null,
      created_by: payload.created_by,
      subtotal,
      status: 'pending',
      idempotency_key: idKey,
    })
    .select('id, order_number')
    .single()

  if (orderError || !order) {
    console.error('[orders] insert error:', orderError)
    return NextResponse.json({ error: '建立訂單失敗，請重試' }, { status: 500 })
  }

  // 建立品項
  const orderItemsPayload = payload.items.map(item => ({
    order_id: order.id,
    item_id: item.item_id || null,
    item_name: sanitize(item.item_name, 60),
    item_price: item.item_price,
    quantity: item.quantity,
    item_note: item.item_note ? sanitize(item.item_note, 100) : null,
  }))

  const { error: itemsError } = await supabase
    .from('order_items')
    .insert(orderItemsPayload)

  if (itemsError) {
    console.error('[order_items] insert error:', itemsError)
    // 品項寫入失敗 → 刪除主單（避免孤立訂單）
    await supabase.from('orders').delete().eq('id', order.id)
    return NextResponse.json({ error: '儲存品項失敗，請重試' }, { status: 500 })
  }

  return NextResponse.json(
    { id: order.id, order_number: order.order_number },
    { status: 201 }
  )
}
