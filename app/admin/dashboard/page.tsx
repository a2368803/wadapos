'use client'

export const dynamic = 'force-dynamic'

import { useEffect, useState, useCallback, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase'
import {
  formatDateTime, formatPrice,
  getStatusLabel, getStatusColor, getOrderTypeLabel, playNewOrderAlert,
} from '@/lib/utils'
import type { Order, OrderStatus } from '@/types'

// ─── 訂單卡片 ─────────────────────────────────────────────────
function OrderCard({
  order,
  onPrint,
  onMarkPrinted,
  onMarkComplete,
  onCancel,
}: {
  order: Order
  onPrint: () => void
  onMarkPrinted: () => void
  onMarkComplete: () => void
  onCancel: () => void
}) {
  const items = order.order_items ?? []
  const isPending = order.status === 'pending'
  const isPrinted = order.status === 'printed'

  return (
    <div className={`bg-white rounded-xl border-2 shadow-sm overflow-hidden
      ${isPending ? 'border-yellow-400 order-pending' : 'border-gray-200'}`}>
      {/* 頭部 */}
      <div className={`px-4 py-3 flex items-center justify-between
        ${isPending ? 'bg-yellow-50' : 'bg-gray-50'}`}>
        <div className="flex items-center gap-3">
          <span className="text-2xl font-black text-gray-900">
            #{String(order.order_number).padStart(4, '0')}
          </span>
          <span className={`px-2 py-0.5 rounded-full text-xs font-bold border
            ${getStatusColor(order.status)}`}>
            {getStatusLabel(order.status)}
          </span>
          {order.created_by === 'staff' && (
            <span className="px-2 py-0.5 rounded-full text-xs font-bold border bg-purple-50 text-purple-700 border-purple-300">
              手動
            </span>
          )}
        </div>
        <div className="text-right">
          <p className="text-xs text-gray-500">{formatDateTime(order.created_at)}</p>
          <p className="font-bold text-gray-700 text-sm">
            {getOrderTypeLabel(order.order_type)}
            {order.table_number ? ` · ${order.table_number}號桌` : ''}
            {order.pickup_number ? ` · ${order.pickup_number}` : ''}
          </p>
        </div>
      </div>

      {/* 品項 */}
      <div className="px-4 py-3">
        {items.map(item => (
          <div key={item.id} className="flex justify-between items-start gap-2 py-1 border-b border-gray-50 last:border-0">
            <div className="flex-1 min-w-0">
              <span className="font-semibold text-gray-800">{item.item_name}</span>
              {item.item_note && (
                <span className="ml-2 text-xs text-gray-500">→ {item.item_note}</span>
              )}
            </div>
            <div className="text-right flex-shrink-0">
              <span className="text-gray-600 text-sm">x{item.quantity}</span>
              <span className="ml-2 text-gray-700 text-sm font-medium">
                {formatPrice(item.item_price * item.quantity)}
              </span>
            </div>
          </div>
        ))}

        {order.customer_note && (
          <div className="mt-2 p-2 bg-yellow-50 rounded text-sm text-yellow-800">
            備註：{order.customer_note}
          </div>
        )}

        <div className="mt-2 pt-2 border-t border-gray-200 flex justify-between">
          <span className="font-bold text-gray-700">合計</span>
          <span className="font-bold text-gray-900">{formatPrice(order.subtotal)}</span>
        </div>
      </div>

      {/* 操作按鈕 */}
      <div className="px-4 pb-3 flex gap-2 flex-wrap">
        <button
          onClick={onPrint}
          className="flex-1 min-w-[80px] py-2.5 bg-blue-700 text-white rounded-lg font-semibold text-sm active:bg-blue-800"
        >
          🖨 列印
        </button>
        {isPending && (
          <button
            onClick={onMarkPrinted}
            className="flex-1 min-w-[80px] py-2.5 bg-blue-100 text-blue-800 rounded-lg font-semibold text-sm border border-blue-300"
          >
            已列印
          </button>
        )}
        {(isPending || isPrinted) && (
          <button
            onClick={onMarkComplete}
            className="flex-1 min-w-[80px] py-2.5 bg-green-600 text-white rounded-lg font-semibold text-sm active:bg-green-700"
          >
            完成
          </button>
        )}
        <button
          onClick={onCancel}
          className="py-2.5 px-3 bg-gray-100 text-gray-500 rounded-lg text-sm border border-gray-200"
          title="取消訂單"
        >
          ✕
        </button>
      </div>
    </div>
  )
}

// ─── Dashboard 主頁 ───────────────────────────────────────────
export default function DashboardPage() {
  const router = useRouter()
  const supabase = createClient()
  const [orders, setOrders] = useState<Order[]>([])
  const [loading, setLoading] = useState(true)
  const [activeTab, setActiveTab] = useState<'active' | 'completed'>('active')
  const [soundEnabled, setSoundEnabled] = useState(true)
  const [newCount, setNewCount] = useState(0)
  const soundEnabledRef = useRef(soundEnabled)
  soundEnabledRef.current = soundEnabled

  // 載入訂單
  const loadOrders = useCallback(async () => {
    const { data, error } = await supabase
      .from('orders')
      .select('*, order_items(*)')
      .in('status', activeTab === 'active'
        ? ['pending', 'printed']
        : ['completed', 'cancelled']
      )
      .order('created_at', { ascending: false })
      .limit(100)

    if (!error && data) {
      setOrders(data as Order[])
    }
    setLoading(false)
  }, [activeTab, supabase])

  useEffect(() => {
    setLoading(true)
    loadOrders()
  }, [loadOrders])

  // Realtime 訂閱
  useEffect(() => {
    const channel = supabase
      .channel('orders-realtime')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'orders' },
        async (payload) => {
          if (payload.eventType === 'INSERT') {
            // 取得完整訂單（含 order_items）
            const { data } = await supabase
              .from('orders')
              .select('*, order_items(*)')
              .eq('id', payload.new.id)
              .single()

            if (data) {
              setOrders(prev => {
                if (activeTab === 'active') {
                  return [data as Order, ...prev]
                }
                return prev
              })
              if (soundEnabledRef.current) playNewOrderAlert()
              setNewCount(c => c + 1)
            }
          } else if (payload.eventType === 'UPDATE') {
            const updatedStatus = payload.new.status as OrderStatus
            const isActive = ['pending', 'printed'].includes(updatedStatus)
            const isCompleted = ['completed', 'cancelled'].includes(updatedStatus)

            if (activeTab === 'active' && isCompleted) {
              // 從 active 移除
              setOrders(prev => prev.filter(o => o.id !== payload.new.id))
            } else if (activeTab === 'active' && isActive) {
              // 更新狀態
              setOrders(prev => prev.map(o =>
                o.id === payload.new.id
                  ? { ...o, ...payload.new }
                  : o
              ))
            } else if (activeTab === 'completed' && isCompleted) {
              const { data } = await supabase
                .from('orders')
                .select('*, order_items(*)')
                .eq('id', payload.new.id)
                .single()
              if (data) {
                setOrders(prev => {
                  const exists = prev.some(o => o.id === payload.new.id)
                  if (exists) return prev.map(o => o.id === data.id ? data as Order : o)
                  return [data as Order, ...prev]
                })
              }
            }
          }
        }
      )
      .subscribe()

    return () => { supabase.removeChannel(channel) }
  }, [activeTab, supabase])

  const updateOrderStatus = async (id: string, status: OrderStatus) => {
    const updates: Partial<Order> = { status }
    if (status === 'printed') updates.printed_at = new Date().toISOString()
    if (status === 'completed') updates.completed_at = new Date().toISOString()

    const { error } = await supabase
      .from('orders')
      .update(updates)
      .eq('id', id)

    if (error) {
      alert('更新失敗：' + error.message)
    }
  }

  const handlePrint = (order: Order) => {
    window.open(`/print/${order.id}`, '_blank', 'width=480,height=720,toolbar=0,menubar=0')
    // 同時標記為已列印
    if (order.status === 'pending') {
      updateOrderStatus(order.id, 'printed')
    }
  }

  const handleLogout = async () => {
    await supabase.auth.signOut()
    router.push('/admin/login')
    router.refresh()
  }

  const pendingOrders = orders.filter(o => o.status === 'pending')
  const printedOrders = orders.filter(o => o.status === 'printed')

  return (
    <div className="min-h-screen bg-gray-100 flex flex-col">
      {/* 頂部導覽 */}
      <header className="bg-blue-900 text-white sticky top-0 z-20 shadow-md">
        <div className="max-w-5xl mx-auto px-4 py-3 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <h1 className="text-lg font-bold">訂單管理</h1>
            {pendingOrders.length > 0 && (
              <span className="bg-red-500 text-white text-sm font-bold px-2.5 py-0.5 rounded-full animate-pulse">
                {pendingOrders.length} 筆待處理
              </span>
            )}
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setSoundEnabled(s => !s)}
              title={soundEnabled ? '靜音' : '開啟提示音'}
              className="p-2 rounded-lg text-xl hover:bg-blue-800"
            >
              {soundEnabled ? '🔔' : '🔕'}
            </button>
            <button
              onClick={() => router.push('/admin/new-order')}
              className="px-3 py-2 bg-green-500 hover:bg-green-600 text-white text-sm font-bold rounded-lg"
            >
              + 建立訂單
            </button>
            <button
              onClick={() => router.push('/admin/menu')}
              className="px-3 py-2 bg-blue-700 hover:bg-blue-600 text-white text-sm font-bold rounded-lg"
            >
              菜單
            </button>
            <button
              onClick={handleLogout}
              className="px-3 py-2 bg-blue-800 hover:bg-red-700 text-white text-sm rounded-lg"
            >
              登出
            </button>
          </div>
        </div>

        {/* 狀態 Tab */}
        <div className="max-w-5xl mx-auto px-4 pb-0 flex gap-1">
          {(['active', 'completed'] as const).map(tab => (
            <button
              key={tab}
              onClick={() => { setActiveTab(tab); setNewCount(0) }}
              className={`px-4 py-2 text-sm font-semibold rounded-t-lg transition-colors
                ${activeTab === tab
                  ? 'bg-gray-100 text-blue-900'
                  : 'text-blue-200 hover:text-white'
                }`}
            >
              {tab === 'active' ? '進行中' : '已完成'}
              {tab === 'active' && newCount > 0 && activeTab !== 'active' && (
                <span className="ml-1.5 bg-red-500 text-white text-xs rounded-full px-1.5">{newCount}</span>
              )}
            </button>
          ))}
        </div>
      </header>

      {/* 主要內容 */}
      <main className="flex-1 max-w-5xl mx-auto w-full px-4 py-4">
        {loading ? (
          <div className="text-center py-16 text-gray-400 text-lg">載入中…</div>
        ) : orders.length === 0 ? (
          <div className="text-center py-16">
            <p className="text-5xl mb-4">
              {activeTab === 'active' ? '🎉' : '📋'}
            </p>
            <p className="text-gray-500 text-lg">
              {activeTab === 'active' ? '目前沒有待處理訂單' : '尚無完成訂單'}
            </p>
            {activeTab === 'active' && (
              <button
                onClick={() => router.push('/admin/new-order')}
                className="mt-4 px-6 py-3 bg-green-600 text-white font-bold rounded-xl"
              >
                + 手動建立訂單
              </button>
            )}
          </div>
        ) : activeTab === 'active' ? (
          <div>
            {/* 未列印區塊 */}
            {pendingOrders.length > 0 && (
              <div className="mb-4">
                <h2 className="text-sm font-bold text-yellow-700 mb-2 flex items-center gap-1">
                  <span className="w-2 h-2 rounded-full bg-yellow-500 animate-pulse inline-block" />
                  未列印 ({pendingOrders.length})
                </h2>
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                  {pendingOrders.map(order => (
                    <OrderCard
                      key={order.id}
                      order={order}
                      onPrint={() => handlePrint(order)}
                      onMarkPrinted={() => updateOrderStatus(order.id, 'printed')}
                      onMarkComplete={() => updateOrderStatus(order.id, 'completed')}
                      onCancel={() => {
                        if (confirm(`確定取消訂單 #${order.order_number}？`)) {
                          updateOrderStatus(order.id, 'cancelled')
                        }
                      }}
                    />
                  ))}
                </div>
              </div>
            )}

            {/* 已列印區塊 */}
            {printedOrders.length > 0 && (
              <div>
                <h2 className="text-sm font-bold text-blue-700 mb-2 flex items-center gap-1">
                  <span className="w-2 h-2 rounded-full bg-blue-500 inline-block" />
                  已列印，待出餐 ({printedOrders.length})
                </h2>
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                  {printedOrders.map(order => (
                    <OrderCard
                      key={order.id}
                      order={order}
                      onPrint={() => handlePrint(order)}
                      onMarkPrinted={() => updateOrderStatus(order.id, 'printed')}
                      onMarkComplete={() => updateOrderStatus(order.id, 'completed')}
                      onCancel={() => {
                        if (confirm(`確定取消訂單 #${order.order_number}？`)) {
                          updateOrderStatus(order.id, 'cancelled')
                        }
                      }}
                    />
                  ))}
                </div>
              </div>
            )}
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {orders.map(order => (
              <OrderCard
                key={order.id}
                order={order}
                onPrint={() => handlePrint(order)}
                onMarkPrinted={() => {}}
                onMarkComplete={() => {}}
                onCancel={() => {}}
              />
            ))}
          </div>
        )}
      </main>

      {/* 重新整理提示 */}
      <footer className="text-center text-xs text-gray-400 py-3">
        即時更新中 · 如有問題請手動
        <button onClick={loadOrders} className="ml-1 underline">重新整理</button>
      </footer>
    </div>
  )
}
