import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: '管理後台 — 備援點餐',
}

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>
}
