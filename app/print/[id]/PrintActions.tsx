'use client'

export function PrintActions() {
  return (
    <div className="no-print mt-6 flex gap-3 justify-center">
      <button
        onClick={() => window.print()}
        style={{
          padding: '12px 32px',
          background: '#1d4ed8',
          color: 'white',
          fontWeight: 700,
          fontSize: '16px',
          border: 'none',
          borderRadius: '8px',
          cursor: 'pointer',
        }}
      >
        🖨 列印
      </button>
      <button
        onClick={() => window.close()}
        style={{
          padding: '12px 24px',
          background: '#e5e7eb',
          color: '#374151',
          fontWeight: 600,
          fontSize: '16px',
          border: 'none',
          borderRadius: '8px',
          cursor: 'pointer',
        }}
      >
        關閉
      </button>
    </div>
  )
}
