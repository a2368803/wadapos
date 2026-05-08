'use client'

export const dynamic = 'force-dynamic'

import { useEffect, useState, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase'
import { formatPrice, generateIdempotencyKey } from '@/lib/utils'
import type { Category, MenuItem, CartItem, OrderType, CreateOrderPayload } from '@/types'

export default function NewOrderPage() {
  const router = useRouter()
  const [categories, setCategories] = useState<Category[]>([])
  const [items, setItems] = useState<MenuItem[]>([])
  const [cart, setCart] = useState<CartItem[]>([])
  const [orderType, setOrderType] = useState<OrderType>('dine-in')
  const [tableNumber, setTableNumber] = useState('')
  const [pickupNumber, setPickupNumber] = useState('')
  const [orderNote, setOrderNote] = useState('')
  const [activeCategory, setActiveCategory] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState('')
  const [printAfter, setPrintAfter] = useState(true)
  const [loadError, setLoadError] = useState('')

  useEffect(() => {
    const load = async () => {
      const supabase = createClient()
      const [catRes, itemRes] = await Promise.all([
        supabase.from('categories').select('*').eq('is_active', true).order('sort_order'),
        supabase.from('items').select('*').eq('is_available', true).order('sort_order'),
      ])
      if (catRes.error || itemRes.error) {
        setLoadError('無法載入菜單')
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

  const updateQty = (item_id: string, delta: number) => {
    setCart(prev => prev.map(c =>
      c.item_id === item_id ? { ...c, quantity: c.quantity + delta } : c
    ).filter(c => c.quantity > 0))
  }

  const updateNote = (item_id: string, note: string) => {
    setCart(prev => prev.map(c => c.item_id === item_id ? { ...c, item_note: note } : c))
  }

  const handleSubmit = async () => {
    setError('')
    if (!cart.length) { setError('請選擇餐點'); return }
    const id = orderType === 'dine-in' ? tableNumber.trim() : pickupNumber.trim()
    if (!id) { setError(orderType === 'dine-in' ? '請輸入桌號' : '請輸入取餐號'); return }

    setSubmitting(true)
    try {
      const payload: CreateOrderPayload = {
        order_type: orderType,
        table_number: orderType === 'dine-in' ? tableNumber.trim() : undefined,
        pickup_number: orderType === 'takeout' ? pickupNumber.trim() : undefined,
        customer_note: orderNote.trim() || undefined,
        created_by: 'staff',
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
        setError(data.error ?? '建立失敗')
        return
      }

      if (printAfter) {
        window.open(`/print/${data.id}`, '_blank', 'width=480,height=720,toolbar=0,menubar=0')
      }

      router.push('/admin/dashboard')
    } catch {
      setError('網路錯誤，請重試')
    } finally {
      setSubmitting(false)
    }
  }

  const activeItems = items.filter(i => i.category_id === activeCategory)

  if (loadError) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <p className="text-red-600 text-lg">{loadError}</p>
          <button onClick={() => window.location.reload()} className="mt-4 px-6 py-3 bg-blue-600 text-white rounded-lg">重新整理</button>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col max-w-lg mx-auto">
      {/* 頂部 */}
      <header className="bg-blue-900 text-white px-4 py-3 sticky top-0 z-20 shadow flex items-center gap-3">
        <button
          onClick={() => router.back()}
          className="text-blue-300 text-xl font-bold"
        >
          ←
        </button>
        <div>
          <h1 className="text-lg font-bold">手動建立訂單</h1>
          <p className="text-blue-300 text-xs">最後防線模式</p>
        </div>
      </header>

      <div className="flex-1 overflow-y-auto pb-44">
        {/* 類型選擇 */}
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

          <div className="mt-3">
            <label className="block text-sm font-semibold text-gray-700 mb-1">
              {orderType === 'dine-in' ? '桌號' : '取餐號'}
              <span className="text-red-500 ml-1">*</span>
            </label>
            <input
              type="text"
              inputMode="numeric"
              placeholder={orderType === 'dine-in' ? '例：5' : '例：A08'}
              value={orderType === 'dine-in' ? tableNumber : pickupNumber}
              onChange={e => orderType === 'dine-in'
                ? setTableNumber(e.target.value)
                : setPickupNumber(e.target.value)
              }
              maxLength={10}
              className="w-full border-2 border-gray-300 rounded-xl px-4 py-3 text-2xl font-black focus:outline-none focus:border-blue-500"
            />
          </div>

          {/* 整單備註 */}
          <div className="mt-3">
            <label className="block text-sm font-semibold text-gray-700 mb-1">整單備註</label>
            <textarea
              placeholder="例：全部少辣、不加蔥"
              value={orderNote}
              onChange={e => setOrderNote(e.target.value)}
              maxLength={120}
              rows={2}
              className="w-full border border-gray-200 rounded-xl px-4 py-2 text-sm focus:outline-none focus:border-blue-400 resize-none"
            />
          </div>
        </section>

        {/* 分類 Tab */}
        {categories.length > 0 && (
          <div className="mt-3 sticky top-[60px] bg-gray-50 z-10 px-4 pb-2">
            <div className="flex gap-2 overflow-x-auto">
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

        {/* 品項 — 大按鈕，適合快速點擊 */}
        <section className="px-4 mt-1 flex flex-col gap-2">
          {activeItems.map(item => {
            const qty = cart.find(c => c.item_id === item.id)?.quantity ?? 0
            return (
              <div key={item.id} className="bg-white rounded-xl border border-gray-200 px-4 py-3 shadow-sm">
                <div className="flex items-center justify-between gap-2">
                  <div className="flex-1 min-w-0">
                    <p className="font-bold text-gray-900 text-base">{item.name}</p>
                    <p className="text-blue-700 font-bold">{formatPrice(item.price)}</p>
                  </div>
                  <div className="flex items-center gap-2">
                    {qty > 0 && (
                      <>
                        <button
                          onClick={() => updateQty(item.id, -1)}
                          className="w-10 h-10 rounded-full bg-gray-200 text-gray-700 text-2xl font-bold flex items-center justify-center"
                        >
                          −
                        </button>
                        <span className="w-8 text-center font-black text-xl text-gray-900">{qty}</span>
                      </>
                    )}
                    <button
                      onClick={() => addToCart(item)}
                      className="w-10 h-10 rounded-full bg-blue-600 text-white text-2xl font-bold flex items-center justify-center active:bg-blue-700"
                    >
                      +
                    </button>
                  </div>
                </div>
                {/* 備註輸入（僅有品項才顯示） */}
                {qty > 0 && (
                  <input
                    type="text"
                    placeholder="備註（例：少辣）"
                    value={cart.find(c => c.item_id === item.id)?.item_note ?? ''}
                    onChange={e => updateNote(item.id, e.target.value)}
                    maxLength={60}
                    className="mt-2 w-full text-sm border border-gray-200 rounded-lg px-3 py-1.5 text-gray-600 focus:outline-none focus:border-blue-400"
                  />
                )}
              </div>
            )
          })}
        </section>
      </div>

      {/* 底部操作區 */}
      <div className="fixed bottom-0 left-0 right-0 max-w-lg mx-auto z-30 bg-white border-t border-gray-200 shadow-xl">
        {/* 購物車摘要 */}
        {cart.length > 0 && (
          <div className="px-4 pt-3 pb-1">
            <div className="flex flex-col gap-1">
              {cart.map(item => (
                <div key={item.item_id} className="flex items-center justify-between text-sm">
                  <span className="text-gray-700 flex-1 truncate">{item.item_name}</span>
                  <div className="flex items-center gap-2 ml-2">
                    <button onClick={() => updateQty(item.item_id, -1)}
                      className="w-6 h-6 rounded-full bg-gray-200 text-gray-600 text-sm font-bold flex items-center justify-center">
                      −
                    </button>
                    <span className="w-5 text-center font-bold">{item.quantity}</span>
                    <button onClick={() => updateQty(item.item_id, 1)}
                      className="w-6 h-6 rounded-full bg-blue-100 text-blue-700 text-sm font-bold flex items-center justify-center">
                      +
                    </button>
                    <span className="w-16 text-right text-gray-600">
                      {formatPrice(item.item_price * item.quantity)}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {error && (
          <div className="px-4 py-2 bg-red-50 border-t border-red-200 text-red-700 text-sm">
            ⚠ {error}
          </div>
        )}

        <div className="px-4 py-3 flex items-center gap-3">
          {/* 列印選項 */}
          <label className="flex items-center gap-1.5 text-sm text-gray-600 cursor-pointer">
            <input
              type="checkbox"
              checked={printAfter}
              onChange={e => setPrintAfter(e.target.checked)}
              className="w-4 h-4"
            />
            送出後列印
          </label>
          <div className="flex-1 text-right">
            <p className="text-xs text-gray-500">合計</p>
            <p className="font-black text-blue-900 text-xl">{formatPrice(cartTotal)}</p>
          </div>
          <button
            onClick={handleSubmit}
            disabled={submitting || cartCount === 0}
            className="px-6 py-3.5 bg-green-600 hover:bg-green-700 text-white font-black text-lg rounded-xl disabled:opacity-40 shadow"
          >
            {submitting ? '建立中…' : `建立 (${cartCount})`}
          </button>
        </div>
      </div>
    </div>
  )
}
