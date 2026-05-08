'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase'
import { formatPrice } from '@/lib/utils'
import type { Category, MenuItem } from '@/types'

export default function MenuPage() {
  const router = useRouter()
  const supabase = createClient()
  const [categories, setCategories] = useState<Category[]>([])
  const [items, setItems] = useState<MenuItem[]>([])
  const [loading, setLoading] = useState(true)
  const [activeCategory, setActiveCategory] = useState('')

  // 新增品項表單
  const [showAddItem, setShowAddItem] = useState(false)
  const [newItemName, setNewItemName] = useState('')
  const [newItemPrice, setNewItemPrice] = useState('')
  const [newItemDesc, setNewItemDesc] = useState('')
  const [newItemCategory, setNewItemCategory] = useState('')
  const [saving, setSaving] = useState(false)
  const [formError, setFormError] = useState('')

  // 新增分類表單
  const [showAddCat, setShowAddCat] = useState(false)
  const [newCatName, setNewCatName] = useState('')

  const load = async () => {
    const [catRes, itemRes] = await Promise.all([
      supabase.from('categories').select('*').order('sort_order'),
      supabase.from('items').select('*').order('sort_order'),
    ])
    setCategories(catRes.data ?? [])
    setItems(itemRes.data ?? [])
    if (catRes.data?.length && !activeCategory) {
      setActiveCategory(catRes.data[0].id)
      setNewItemCategory(catRes.data[0].id)
    }
    setLoading(false)
  }

  useEffect(() => { load() }, []) // eslint-disable-line

  const toggleItem = async (item: MenuItem) => {
    const { error } = await supabase
      .from('items')
      .update({ is_available: !item.is_available })
      .eq('id', item.id)
    if (!error) {
      setItems(prev => prev.map(i => i.id === item.id ? { ...i, is_available: !i.is_available } : i))
    }
  }

  const toggleCategory = async (cat: Category) => {
    const { error } = await supabase
      .from('categories')
      .update({ is_active: !cat.is_active })
      .eq('id', cat.id)
    if (!error) {
      setCategories(prev => prev.map(c => c.id === cat.id ? { ...c, is_active: !c.is_active } : c))
    }
  }

  const addItem = async () => {
    setFormError('')
    if (!newItemName.trim()) { setFormError('請輸入品項名稱'); return }
    const price = parseFloat(newItemPrice)
    if (isNaN(price) || price < 0) { setFormError('請輸入有效價格'); return }
    if (!newItemCategory) { setFormError('請選擇分類'); return }

    setSaving(true)
    const { error } = await supabase.from('items').insert({
      name: newItemName.trim(),
      price,
      description: newItemDesc.trim() || null,
      category_id: newItemCategory,
      is_available: true,
    })
    setSaving(false)

    if (error) { setFormError('新增失敗：' + error.message); return }

    setNewItemName('')
    setNewItemPrice('')
    setNewItemDesc('')
    setShowAddItem(false)
    load()
  }

  const addCategory = async () => {
    if (!newCatName.trim()) return
    setSaving(true)
    const maxOrder = Math.max(0, ...categories.map(c => c.sort_order))
    const { error } = await supabase.from('categories').insert({
      name: newCatName.trim(),
      sort_order: maxOrder + 1,
      is_active: true,
    })
    setSaving(false)
    if (!error) {
      setNewCatName('')
      setShowAddCat(false)
      load()
    }
  }

  const deleteItem = async (id: string, name: string) => {
    if (!confirm(`確定刪除「${name}」？此操作無法還原。`)) return
    const { error } = await supabase.from('items').delete().eq('id', id)
    if (!error) setItems(prev => prev.filter(i => i.id !== id))
  }

  const activeItems = items.filter(i => i.category_id === activeCategory)
  const activeCat = categories.find(c => c.id === activeCategory)

  return (
    <div className="min-h-screen bg-gray-50">
      {/* 頂部 */}
      <header className="bg-blue-900 text-white px-4 py-3 sticky top-0 z-20 shadow flex items-center gap-3">
        <button onClick={() => router.back()} className="text-blue-300 text-xl font-bold">←</button>
        <h1 className="text-lg font-bold flex-1">菜單管理</h1>
        <button
          onClick={() => setShowAddCat(true)}
          className="px-3 py-1.5 bg-blue-700 hover:bg-blue-600 text-white text-sm font-semibold rounded-lg"
        >
          + 分類
        </button>
        <button
          onClick={() => { setShowAddItem(true); setFormError('') }}
          className="px-3 py-1.5 bg-green-500 hover:bg-green-600 text-white text-sm font-semibold rounded-lg"
        >
          + 品項
        </button>
      </header>

      {loading ? (
        <div className="text-center py-16 text-gray-400">載入中…</div>
      ) : (
        <div className="flex max-w-2xl mx-auto">
          {/* 分類側欄 */}
          <div className="w-28 flex-shrink-0 bg-white border-r border-gray-200 min-h-[calc(100vh-56px)] sticky top-14">
            {categories.map(cat => (
              <button
                key={cat.id}
                onClick={() => setActiveCategory(cat.id)}
                className={`w-full text-left px-3 py-4 text-sm font-semibold border-b border-gray-100 transition-colors
                  ${activeCategory === cat.id ? 'bg-blue-50 text-blue-800 border-l-4 border-l-blue-600' : 'text-gray-700'}
                  ${!cat.is_active ? 'opacity-40 line-through' : ''}`}
              >
                {cat.name}
              </button>
            ))}
          </div>

          {/* 品項列表 */}
          <div className="flex-1 p-4">
            {activeCat && (
              <div className="flex items-center justify-between mb-3">
                <h2 className="font-bold text-gray-800 text-base">{activeCat.name}</h2>
                <button
                  onClick={() => toggleCategory(activeCat)}
                  className={`text-xs px-3 py-1.5 rounded-full font-semibold border
                    ${activeCat.is_active
                      ? 'bg-green-50 text-green-700 border-green-300'
                      : 'bg-gray-100 text-gray-500 border-gray-300'
                    }`}
                >
                  {activeCat.is_active ? '啟用中' : '已停用'}
                </button>
              </div>
            )}

            {activeItems.length === 0 ? (
              <p className="text-gray-400 text-center py-8">此分類無品項</p>
            ) : (
              <div className="flex flex-col gap-2">
                {activeItems.map(item => (
                  <div key={item.id} className={`bg-white rounded-xl border border-gray-200 px-4 py-3 flex items-center gap-3
                    ${!item.is_available ? 'opacity-50' : ''}`}>
                    <div className="flex-1 min-w-0">
                      <p className={`font-semibold text-gray-900 ${!item.is_available ? 'line-through' : ''}`}>
                        {item.name}
                      </p>
                      {item.description && (
                        <p className="text-xs text-gray-400">{item.description}</p>
                      )}
                      <p className="font-bold text-blue-700 text-sm">{formatPrice(item.price)}</p>
                    </div>
                    <div className="flex gap-2">
                      <button
                        onClick={() => toggleItem(item)}
                        className={`px-3 py-1.5 text-xs font-semibold rounded-lg border
                          ${item.is_available
                            ? 'bg-green-50 text-green-700 border-green-300'
                            : 'bg-gray-100 text-gray-500 border-gray-300'
                          }`}
                      >
                        {item.is_available ? '供應中' : '已停售'}
                      </button>
                      <button
                        onClick={() => deleteItem(item.id, item.name)}
                        className="p-1.5 text-red-400 hover:text-red-600 text-lg"
                        title="刪除"
                      >
                        🗑
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* 新增品項 Modal */}
      {showAddItem && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-end sm:items-center justify-center p-4">
          <div className="bg-white rounded-2xl w-full max-w-md p-5">
            <h3 className="font-bold text-gray-900 text-lg mb-4">新增品項</h3>

            <div className="flex flex-col gap-3">
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-1">分類</label>
                <select
                  value={newItemCategory}
                  onChange={e => setNewItemCategory(e.target.value)}
                  className="w-full border-2 border-gray-300 rounded-xl px-3 py-2.5 focus:outline-none focus:border-blue-500"
                >
                  {categories.filter(c => c.is_active).map(c => (
                    <option key={c.id} value={c.id}>{c.name}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-1">
                  品項名稱 <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  value={newItemName}
                  onChange={e => setNewItemName(e.target.value)}
                  placeholder="例：炒飯"
                  maxLength={30}
                  className="w-full border-2 border-gray-300 rounded-xl px-3 py-2.5 focus:outline-none focus:border-blue-500"
                />
              </div>

              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-1">
                  價格（NT$）<span className="text-red-500">*</span>
                </label>
                <input
                  type="number"
                  inputMode="numeric"
                  value={newItemPrice}
                  onChange={e => setNewItemPrice(e.target.value)}
                  placeholder="0"
                  min="0"
                  step="5"
                  className="w-full border-2 border-gray-300 rounded-xl px-3 py-2.5 focus:outline-none focus:border-blue-500"
                />
              </div>

              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-1">說明（選填）</label>
                <input
                  type="text"
                  value={newItemDesc}
                  onChange={e => setNewItemDesc(e.target.value)}
                  placeholder="例：蛋炒飯"
                  maxLength={50}
                  className="w-full border border-gray-200 rounded-xl px-3 py-2.5 focus:outline-none focus:border-blue-400"
                />
              </div>

              {formError && (
                <p className="text-red-600 text-sm">{formError}</p>
              )}
            </div>

            <div className="flex gap-3 mt-5">
              <button
                onClick={() => setShowAddItem(false)}
                className="flex-1 py-3 bg-gray-100 text-gray-700 font-semibold rounded-xl"
              >
                取消
              </button>
              <button
                onClick={addItem}
                disabled={saving}
                className="flex-1 py-3 bg-blue-700 text-white font-bold rounded-xl disabled:opacity-50"
              >
                {saving ? '新增中…' : '新增品項'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 新增分類 Modal */}
      {showAddCat && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl w-full max-w-sm p-5">
            <h3 className="font-bold text-gray-900 text-lg mb-4">新增分類</h3>
            <input
              type="text"
              value={newCatName}
              onChange={e => setNewCatName(e.target.value)}
              placeholder="例：主食"
              maxLength={20}
              className="w-full border-2 border-gray-300 rounded-xl px-3 py-3 text-base focus:outline-none focus:border-blue-500"
            />
            <div className="flex gap-3 mt-4">
              <button
                onClick={() => setShowAddCat(false)}
                className="flex-1 py-3 bg-gray-100 text-gray-700 font-semibold rounded-xl"
              >
                取消
              </button>
              <button
                onClick={addCategory}
                disabled={saving}
                className="flex-1 py-3 bg-blue-700 text-white font-bold rounded-xl disabled:opacity-50"
              >
                新增
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
