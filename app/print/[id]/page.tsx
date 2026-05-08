import { notFound } from 'next/navigation'
import { createServiceRoleClient } from '@/lib/supabase-server'
import { formatDateTime, formatPrice, getOrderTypeLabel } from '@/lib/utils'
import { PrintActions } from './PrintActions'
import type { Order } from '@/types'

export const dynamic = 'force-dynamic'

const printCSS = `
  /* ─── 螢幕：模擬熱感票預覽 ─── */
  body { background: #e5e7eb !important; }
  .ticket-wrapper {
    display: flex;
    flex-direction: column;
    align-items: center;
    min-height: 100vh;
    padding: 24px 16px;
  }
  .ticket {
    background: white;
    width: 220px;
    padding: 10px 8px;
    border: 1px solid #d1d5db;
    border-radius: 4px;
    font-family: 'Courier New', Courier, monospace !important;
    font-size: 12px !important;
    line-height: 1.5;
    color: #000 !important;
  }
  .t-center { text-align: center; }
  .t-bold   { font-weight: 700; }
  .t-big    { font-size: 16px !important; }
  .t-xbig  { font-size: 22px !important; font-weight: 900; letter-spacing: 3px; }
  .t-small  { font-size: 10px !important; color: #555; }
  .t-divider { border-top: 1px dashed #000; margin: 5px 0; }
  .t-row { display: flex; justify-content: space-between; gap: 4px; }
  .t-name  { flex: 1; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
  .t-qty   { width: 28px; text-align: center; flex-shrink: 0; }
  .t-price { width: 64px; text-align: right; flex-shrink: 0; }
  .t-note  { font-size: 10px !important; color: #444; padding-left: 8px; }
  .t-total { font-size: 14px !important; font-weight: 700; }
  .t-spacer { height: 8px; }

  /* ─── 列印：58mm 熱感紙 ─── */
  @media print {
    @page {
      size: 58mm auto;
      margin: 2mm 2mm;
    }
    html, body {
      width: 54mm !important;
      background: white !important;
      margin: 0 !important;
      padding: 0 !important;
    }
    .ticket-wrapper {
      padding: 0 !important;
      min-height: unset !important;
      display: block !important;
    }
    .ticket {
      width: 54mm !important;
      border: none !important;
      padding: 0 !important;
      font-size: 11pt !important;
    }
    .no-print { display: none !important; }
  }
`

export default async function PrintPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const supabase = createServiceRoleClient()

  const { data: order, error } = await supabase
    .from('orders')
    .select('*, order_items(*)')
    .eq('id', id)
    .single()

  if (error || !order) notFound()

  const o = order as Order
  const items = o.order_items ?? []

  return (
    <>
      {/* 注入列印 CSS — 置於 <head> 之外仍有效 */}
      <style dangerouslySetInnerHTML={{ __html: printCSS }} />

      <div className="ticket-wrapper">
        <div className="ticket">
          {/* 標題 */}
          <div className="t-center t-bold t-big" style={{ padding: '4px 0 2px' }}>
            備援點餐
          </div>
          <div className="t-divider" />

          {/* 訂單號 */}
          <div className="t-center" style={{ padding: '4px 0' }}>
            <div className="t-small">訂單號碼</div>
            <div className="t-xbig">#{String(o.order_number).padStart(4, '0')}</div>
          </div>
          <div className="t-divider" />

          {/* 類型 / 桌號 / 時間 */}
          <div style={{ padding: '3px 0' }}>
            <div className="t-row">
              <span>類型</span>
              <span className="t-bold">{getOrderTypeLabel(o.order_type)}</span>
            </div>
            {o.order_type === 'dine-in' && o.table_number && (
              <div className="t-row">
                <span>桌號</span>
                <span className="t-bold">{o.table_number}</span>
              </div>
            )}
            {o.order_type === 'takeout' && o.pickup_number && (
              <div className="t-row">
                <span>取餐號</span>
                <span className="t-bold">{o.pickup_number}</span>
              </div>
            )}
            <div className="t-row t-small">
              <span>時間</span>
              <span>{formatDateTime(o.created_at)}</span>
            </div>
          </div>
          <div className="t-divider" />

          {/* 品項 */}
          <div style={{ padding: '3px 0' }}>
            <div className="t-row t-bold t-small" style={{ marginBottom: '3px' }}>
              <span className="t-name">品項</span>
              <span className="t-qty">數</span>
              <span className="t-price">金額</span>
            </div>
            {items.map((item) => (
              <div key={item.id} style={{ marginBottom: '4px' }}>
                <div className="t-row">
                  <span className="t-name">{item.item_name}</span>
                  <span className="t-qty">x{item.quantity}</span>
                  <span className="t-price">{formatPrice(item.item_price * item.quantity)}</span>
                </div>
                {item.item_note && (
                  <div className="t-note">→ {item.item_note}</div>
                )}
              </div>
            ))}
          </div>
          <div className="t-divider" />

          {/* 備註 */}
          {o.customer_note && (
            <>
              <div style={{ padding: '2px 0', fontSize: '11px' }}>
                <span className="t-bold">備註：</span>{o.customer_note}
              </div>
              <div className="t-divider" />
            </>
          )}

          {/* 合計 */}
          <div className="t-row t-total" style={{ padding: '4px 0' }}>
            <span>合計</span>
            <span>{formatPrice(o.subtotal)}</span>
          </div>

          {/* 手動建立標記 */}
          {o.created_by === 'staff' && (
            <div className="t-center t-small" style={{ marginTop: '4px' }}>
              [ 店員手動建立 ]
            </div>
          )}

          <div className="t-spacer" />
        </div>

        {/* 螢幕操作按鈕（列印時隱藏） */}
        <PrintActions />
      </div>
    </>
  )
}
