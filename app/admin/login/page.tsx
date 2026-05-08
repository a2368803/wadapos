'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase'

export default function LoginPage() {
  const router = useRouter()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    setLoading(true)

    try {
      const supabase = createClient()
      const { error: authError } = await supabase.auth.signInWithPassword({
        email: email.trim().toLowerCase(),
        password,
      })

      if (authError) {
        setError('帳號或密碼錯誤，請重試')
        return
      }

      router.push('/admin/dashboard')
      router.refresh()
    } catch {
      setError('登入失敗，請檢查網路連線')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-blue-950 flex items-center justify-center px-6">
      <div className="w-full max-w-sm">
        {/* Logo / 標題 */}
        <div className="text-center mb-8">
          <div className="text-5xl mb-3">🍽</div>
          <h1 className="text-white text-2xl font-bold">備援點餐系統</h1>
          <p className="text-blue-300 text-sm mt-1">管理後台登入</p>
        </div>

        <form onSubmit={handleLogin} className="bg-white rounded-2xl shadow-xl p-6 flex flex-col gap-4">
          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-1">
              電子信箱
            </label>
            <input
              type="email"
              autoComplete="email"
              required
              value={email}
              onChange={e => setEmail(e.target.value)}
              className="w-full border-2 border-gray-300 rounded-xl px-4 py-3 text-base focus:outline-none focus:border-blue-500"
              placeholder="admin@example.com"
            />
          </div>

          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-1">
              密碼
            </label>
            <input
              type="password"
              autoComplete="current-password"
              required
              value={password}
              onChange={e => setPassword(e.target.value)}
              className="w-full border-2 border-gray-300 rounded-xl px-4 py-3 text-base focus:outline-none focus:border-blue-500"
              placeholder="••••••••"
            />
          </div>

          {error && (
            <div className="bg-red-50 border border-red-200 rounded-lg px-4 py-3 text-red-700 text-sm">
              {error}
            </div>
          )}

          <button
            type="submit"
            disabled={loading}
            className="w-full py-4 bg-blue-700 hover:bg-blue-800 text-white font-bold text-lg rounded-xl disabled:opacity-50 transition-colors"
          >
            {loading ? '登入中…' : '登入'}
          </button>
        </form>

        <p className="text-center text-blue-400 text-xs mt-6">
          僅限授權人員使用
        </p>
      </div>
    </div>
  )
}
