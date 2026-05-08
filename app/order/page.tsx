'use client'

import { useEffect, useState, useCallback } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { createClient } from '@/lib/supabase'
import { formatPrice, generateIdempotencyKey } from '@/lib/utils'
import type { Category, MenuItem, CartItem, OrderType, CreateOrderPayload } from '@/types'

// ─── 購物車品項列 ───────────────────────────────────────────
function CartRow({
  item,
  onInc,
  onDec,
  onNoteChange,
}: {
  item: CartItem
  onInc: () => void
  onDec: () => void
  onNoteChange: (note: string) => void
}) {
  return (
    <div className="border-b border-gray-100 py-3">
      <div className="flex items-center justify-between gap-2">
        <span className="font-medium text-gray-800 flex-1">{item.item_name}</span>
        <span className="text-gray-500 text-sm w-20 text-right">
          {formatPrice(item.item_price * item.quantity)}
        </span>
        <div className="flex items-center gap-1">
          <button
            onClick={onDec}
            className="w-8 h-8 rounded-full bg-gray-200 text-gray-700 text-lg font-bold flex items-center justify-center"
          >
            −
          </button>
          <span className="w-7 text-center font-bold text-gray-900">{item.quantity}</span>
          <button
            onClick={onInc}
            className="w-8 h-8 rounded-full bg-blue-600 text-white text-lg font-bold flex items-center justify-center"
          >
            +
          </button>
        </div>
      </div>
      <input
        type="text"
        placeholder="備註（例：少辣、不加蔥）"
        value={item.item_note}
        onChange={e => onNoteChange(e.target.value)}
        maxLength={60}
        className="mt-1 w-full text-sm border border-gray-200 rounded px-2 py-1 text-gray-600 placeholder-gray-400 focus:outline-none focus:border-blue-400"
      />
    </div>
  )
}

// ─── 菜單品項卡片 ───────────────────────────────────────────
function ItemCard({
  item,
  qty,
  onAdd,
}: {
  item: MenuItem
  qty: number
  onAdd: () => void
}) {
  return (
    <div className="flex items-center justify-between bg-white rounded-lg border border-gray-200 px-4 py-3 shadow-sm">
      <div className="flex-1 min-w-0">
        <p className="font-semibold text-gray-900 truncate">{item.name}</p>
        {item.description && (
          <p className="text-xs text-gray-400 mt-0.5 truncate">{item.description}</p>
        )}
        <p className="text-blue-700 font-bold mt-1">{formatPrice(item.price)}</p>
      </div>
      <button
        onClick={onAdd}
        className="ml-3 flex-shrink-0 flex items-center justify-center w-10 h-10 rounded-full bg-blue-600 text-white text-2xl font-bold shadow-sm active:bg-blue-700"
      >
        {qty > 0 ? (
          <span className="text-base font-bold">{qty}</span>
        ) : (
          '+'
        )}
      </button>
    </div>
  )
}

// ─── 主頁面 ───────────────────────────────────────────────────
export default function OrderPage() {
  const router = useRouter()
  const searchParams = useSearchParams()

  const [categories, setCategories] = useState<Category[]>([])
  const [items, setItems] = useState<MenuItem[]>([])
  const [cart, setCart] = useState<CartItem[]>([])
  const [orderType, setOrderType] = useState<OrderType>('dine-in')
  const [tableNumber, setTableNumber] = useState(searchParams.get('table') ?? '')
  const [pickupNumber, setPickupNumber] = useState('')
  const [orderNote, setOrderNote] = useState('')
  const [activeCategory, setActiveCategory] = useState<string>('')
  const [cartOpen, setCartOpen] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [loadError, setLoadError] = useState('')
  const [submitError, setSubmitError] = useState('')

  // 載入菜單
  useEffect(() => {
    const load = async () => {
      const supabase = createClient()
      const [catRes, itemRes] = await Promise.all([
        supabase.from('categories').select('*').eq('is_active', true).order('sort_order'),
        supabase.from('items').select('*').eq('is_available', true).order('sort_order'),
      ])
      if (catRes.error || itemRes.error) {
        setLoadError('無法載入菜單，請重新整理。')
        return
      }
      setCategories(catRes.data ?? [])
      setItems(itemRes.data ?? [])
      if (catRes.data?.length) setActiveCategory(catRes.data[0].id)
    }
    load()
  }, [])

  const cartCount = cart.reduce((sum, i) => sum + i.quantity, 0)
  const cartTotal = cart.reduce((sum, i) => sum + i.item_price * i.quantity, 0)

  const addToCart = useCallback((item: MenuItem) => {
    setCart(prev => {
      const idx = prev.findIndex(c => c.item_id === item.id)
      if (idx >= 0) {
        const next = [...prev]
        next[idx] = { ...next[idx], quantity: next[idx].quantity + 1 }
        return next
      }
      return [...prev, {
        item_id: item.id,
        item_name: item.name,
        item_price: item.price,
        quantity: 1,
        item_note: '',
      }]
    })
  }, [])

  const updateQty = useCallback((item_id: string, delta: number) => {
    setCart(prev => {
      const next = prev.map(c =>
        c.item_id === item_id ? { ...c, quantity: c.quantity + delta } : c
      ).filter(c => c.quantity > 0)
      return next
    })
  }, [])

  const updateNote = useCallback((item_id: string, note: string) => {
    setCart(prev => prev.map(c => c.item_id === item_id ? { ...c, item_note: note } : c))
  }, [])

  const handleSubmit = async () => {
    setSubmitError('')

    if (!cart.length) { setSubmitError('請先選擇餐點'); return }
    const identifier = orderType === 'dine-in' ? tableNumber.trim() : pickupNumber.trim()
    if (!identifier) {
      setSubmitError(orderType === 'dine-in' ? '請輸入桌號' : '請輸入取餐號')
      return
    }

    setSubmitting(true)
    try {
      const payload: CreateOrderPayload = {
        order_type: orderType,
        table_number: orderType === 'dine-in' ? tableNumber.trim() : undefined,
        pickup_number: orderType === 'takeout' ? pickupNumber.trim() : undefined,
        customer_note: orderNote.trim() || undefined,
        created_by: 'customer',
        items: cart.map(c => ({
          item_id: c.item_id,
          item_name: c.item_name,
          item_price: c.item_price,
          quantity: c.quantity,
          item_note: c.item_note || undefined,
        })),
        idempotency_key: generateIdempotencyKey(),
      }

      const res = await fetch('/api/orders', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })

      const data = await res.json()
      if (!res.ok) {
        setSubmitError(data.error ?? '送出失敗，請重試')
        return
      }

      router.push(`/order/success?no=${data.order_number}&type=${orderType}`)
    } catch {
      setSubmitError('網路錯誤，請重試')
    } finally {
      setSubmitting(false)
    }
  }

  const activeItems = items.filter(i => i.category_id === activeCategory)

  if (loadError) {
    return (
      <div className="min-h-screen flex items-center justify-center p-6">
        <div className="text-center">
          <p className="text-red-600 text-lg font-semibold">{loadError}</p>
          <button
            onClick={() => window.location.reload()}
            className="mt-4 px-6 py-3 bg-blue-600 text-white rounded-lg font-semibold"
          >
            重新整理
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col max-w-lg mx-auto">
      {/* 頂部標題 */}
      <header className="bg-blue-900 text-white px-4 py-3 sticky top-0 z-20 shadow">
        <h1 className="text-xl font-bold tracking-wide">備援點餐</h1>
        <p className="text-blue-200 text-xs mt-0.5">請選擇用餐方式與餐點</p>
      </header>

      <div className="flex-1 overflow-y-auto pb-36">
        {/* 用餐類型 */}
        <section className="px-4 pt-4">
          <div className="flex gap-3">
            {(['dine-in', 'takeout'] as OrderType[]).map(t => (
              <button
                key={t}
                onClick={() => setOrderType(t)}
                className={`flex-1 py-3 rounded-xl font-bold text-base border-2 transition-colors
                  ${orderType === t
                    ? 'bg-blue-700 border-blue-700 text-white shadow'
                    : 'bg-white border-gray-300 text-gray-600'
                  }`}
              >
                {t === 'dine-in' ? '🍽 內用' : '🥡 外帶'}
              </button>
            ))}
          </div>

          {/* 桌號 / 取餐號 */}
          <div className="mt-3">
            <label className="block text-sm font-semibold text-gray-700 mb-1">
              {orderType === 'dine-in' ? '桌號' : '取餐號'}
              <span className="text-red-500 ml-1">*</span>
            </label>
            <input
              type="text"
              inputMode="numeric"
              placeholder={orderType === 'dine-in' ? '例：5 號桌' : '例：A08'}
              value={orderType === 'dine-in' ? tableNumber : pickupNumber}
              onChange={e => orderType === 'dine-in'
                ? setTableNumber(e.target.value)
                : setPickupNumber(e.target.value)
              }
              maxLength={10}
              className="w-full border-2 border-gray-300 rounded-xl px-4 py-3 text-lg font-bold focus:outline-none focus:border-blue-500"
            />
          </div>
        </section>

        {/* 分類 Tab */}
        {categories.length > 0 && (
          <div className="mt-4 sticky top-[60px] bg-gray-50 z-10 px-4 pb-2">
            <div className="flex gap-2 overflow-x-auto scrollbar-hide">
              {categories.map(cat => (
                <button
                  key={cat.id}
                  onClick={() => setActiveCategory(cat.id)}
                  className={`flex-shrink-0 px-4 py-2 rounded-full font-semibold text-sm border transition-colors
                    ${activeCategory === cat.id
                      ? 'bg-blue-700 text-white border-blue-700'
                      : 'bg-white text-gray-600 border-gray-300'
                    }`}
                >
                  {cat.name}
                </button>
              ))}
            </div>
          </div>
        )}

        {/* 品項列表 */}
        <section className="px-4 mt-2 flex flex-col gap-2">
          {activeItems.length === 0 ? (
            <p className="text-center text-gray-400 py-8">此分類暫無品項</p>
          ) : (
            activeItems.map(item => (
              <ItemCard
                key={item.id}
                item={item}
                qty={cart.find(c => c.item_id === item.id)?.quantity ?? 0}
                onAdd={() => addToCart(item)}
              />
            ))
          )}
        </section>
      </div>

      {/* 底部購物車 */}
      <div className="fixed bottom-0 left-0 right-0 max-w-lg mx-auto z-30">
        {/* 展開的購物車 */}
        {cartOpen && cart.length > 0 && (
          <div className="bg-white border-t border-gray-200 px-4 py-3 max-h-[60vh] overflow-y-auto">
            <div className="flex justify-between items-center mb-2">
              <h3 className="font-bold text-gray-800 text-base">購物車</h3>
              <button onClick={() => setCartOpen(false)} className="text-gray-400 text-xl">✕</button>
            </div>
            {cart.map(item => (
              <CartRow
                key={item.item_id}
                item={item}
                onInc={() => updateQty(item.item_id, 1)}
                onDec={() => updateQty(item.item_id, -1)}
                onNoteChange={(note) => updateNote(item.item_id, note)}
              />
            ))}
            <div className="mt-3">
              <label className="block text-sm font-semibold text-gray-700 mb-1">整單備註</label>
              <textarea
                placeholder="特殊需求（例：全部少油）"
                value={orderNote}
                onChange={e => setOrderNote(e.target.value)}
                maxLength={120}
                rows={2}
                className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-blue-400 resize-none"
              />
            </div>
          </div>
        )}

        {/* 錯誤訊息 */}
        {submitError && (
          <div className="bg-red-50 border-t border-red-200 px-4 py-2 text-red-700 text-sm font-medium">
            ⚠ {submitError}
          </div>
        )}

        {/* 購物車列 + 送出 */}
        <div className="bg-white border-t border-gray-200 px-4 py-3 flex items-center gap-3 shadow-lg">
          <button
            onClick={() => setCartOpen(o => !o)}
            disabled={cartCount === 0}
            className="relative flex items-center justify-center w-12 h-12 rounded-full bg-blue-100 text-blue-800 disabled:opacity-40"
          >
            🛒
            {cartCount > 0 && (
              <span className="absolute -top-1 -right-1 bg-red-500 text-white text-xs rounded-full w-5 h-5 flex items-center justify-center font-bold">
                {cartCount}
              </span>
            )}
          </button>
          <div className="flex-1">
            <p className="text-xs text-gray-500">合計</p>
            <p className="font-bold text-blue-900 text-lg">{formatPrice(cartTotal)}</p>
          </div>
          <button
            onClick={handleSubmit}
            disabled={submitting || cartCount === 0}
            className="px-6 py-3 bg-blue-700 text-white font-bold text-base rounded-xl disabled:opacity-40 active:bg-blue-800 shadow"
          >
            {submitting ? '送出中…' : '送出訂單'}
          </button>
        </div>
      </div>
    </div>
  )
}
