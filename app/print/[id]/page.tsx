import { notFound } from 'next/navigation'
import { createServiceRoleClient } from '@/lib/supabase-server'
import { formatDateTime, formatPrice, getOrderTypeLabel } from '@/lib/utils'
import type { Order } from '@/types'

export const dynamic = 'force-dynamic'

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
    <html lang="zh-TW">
      <head>
        <meta charSet="UTF-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <title>訂單 #{o.order_number} 列印</title>
        <style>{`
          /* ─── 螢幕預覽 ─── */
          * { box-sizing: border-box; margin: 0; padding: 0; }
          body {
            font-family: 'Courier New', Courier, monospace;
            background: #f3f4f6;
            display: flex;
            flex-direction: column;
            align-items: center;
            padding: 20px;
            min-height: 100vh;
          }
          .ticket {
            background: white;
            width: 220px;
            padding: 8px 6px;
            border: 1px solid #ddd;
            border-radius: 4px;
            font-size: 12px;
            line-height: 1.5;
          }
          .center { text-align: center; }
          .bold { font-weight: bold; }
          .big { font-size: 18px; }
          .xbig { font-size: 22px; font-weight: 900; letter-spacing: 2px; }
          .divider {
            border-top: 1px dashed #000;
            margin: 4px 0;
          }
          .row {
            display: flex;
            justify-content: space-between;
            gap: 4px;
          }
          .item-name { flex: 1; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
          .item-qty { width: 28px; text-align: center; flex-shrink: 0; }
          .item-price { width: 60px; text-align: right; flex-shrink: 0; }
          .note { font-size: 10px; color: #555; padding-left: 8px; }
          .total { font-size: 14px; font-weight: bold; }
          .actions {
            margin-top: 20px;
            display: flex;
            gap: 10px;
          }
          .btn {
            padding: 12px 28px;
            font-size: 16px;
            font-weight: bold;
            border: none;
            border-radius: 8px;
            cursor: pointer;
          }
          .btn-print { background: #1d4ed8; color: white; }
          .btn-close { background: #e5e7eb; color: #374151; }

          /* ─── 列印媒體查詢：58mm 熱感紙 ─── */
          @media print {
            @page {
              size: 58mm auto;
              margin: 2mm 2mm;
            }
            html, body {
              width: 54mm;
              background: white;
              padding: 0;
              display: block;
            }
            .ticket {
              width: 54mm;
              border: none;
              padding: 0;
              font-size: 11pt;
            }
            .no-print { display: none !important; }
          }
        `}</style>
      </head>
      <body>
        <div className="ticket">
          {/* 店名標題 */}
          <div className="center bold big" style={{ padding: '4px 0 2px' }}>
            備援點餐
          </div>
          <div className="divider" />

          {/* 訂單號 */}
          <div className="center" style={{ padding: '4px 0' }}>
            <div style={{ fontSize: '10px' }}>訂單號碼</div>
            <div className="xbig">#{String(o.order_number).padStart(4, '0')}</div>
          </div>
          <div className="divider" />

          {/* 類型 + 桌號 */}
          <div style={{ padding: '2px 0' }}>
            <div className="row">
              <span>類型</span>
              <span className="bold">{getOrderTypeLabel(o.order_type)}</span>
            </div>
            {o.order_type === 'dine-in' && o.table_number && (
              <div className="row">
                <span>桌號</span>
                <span className="bold">{o.table_number}</span>
              </div>
            )}
            {o.order_type === 'takeout' && o.pickup_number && (
              <div className="row">
                <span>取餐號</span>
                <span className="bold">{o.pickup_number}</span>
              </div>
            )}
            <div className="row" style={{ fontSize: '10px', color: '#555' }}>
              <span>時間</span>
              <span>{formatDateTime(o.created_at)}</span>
            </div>
          </div>
          <div className="divider" />

          {/* 品項 */}
          <div style={{ padding: '2px 0' }}>
            <div className="row bold" style={{ fontSize: '10px', marginBottom: '2px' }}>
              <span className="item-name">品項</span>
              <span className="item-qty">數量</span>
              <span className="item-price">金額</span>
            </div>
            {items.map((item) => (
              <div key={item.id} style={{ marginBottom: '3px' }}>
                <div className="row">
                  <span className="item-name">{item.item_name}</span>
                  <span className="item-qty">x{item.quantity}</span>
                  <span className="item-price">{formatPrice(item.item_price * item.quantity)}</span>
                </div>
                {item.item_note && (
                  <div className="note">→ {item.item_note}</div>
                )}
              </div>
            ))}
          </div>
          <div className="divider" />

          {/* 備註 */}
          {o.customer_note && (
            <>
              <div style={{ fontSize: '10px', padding: '2px 0' }}>
                <span className="bold">備註：</span>{o.customer_note}
              </div>
              <div className="divider" />
            </>
          )}

          {/* 合計 */}
          <div className="row total" style={{ padding: '3px 0' }}>
            <span>合計</span>
            <span>{formatPrice(o.subtotal)}</span>
          </div>

          {/* 由員工建立標記 */}
          {o.created_by === 'staff' && (
            <div className="center" style={{ fontSize: '10px', color: '#555', marginTop: '4px' }}>
              [ 店員手動建立 ]
            </div>
          )}

          <div style={{ height: '8px' }} />
        </div>

        {/* 螢幕操作按鈕 */}
        <div className="actions no-print">
          <button className="btn btn-print" onClick={() => window.print()}>
            🖨 列印
          </button>
          <button className="btn btn-close" onClick={() => window.close()}>
            關閉
          </button>
        </div>

        <script dangerouslySetInnerHTML={{
          __html: `
            // 自動觸發列印（選用：可以移除這段讓店員手動按）
            // window.onload = function() { window.print(); }
          `
        }} />
      </body>
    </html>
  )
}
