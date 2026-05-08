import Link from 'next/link'

export default function OrderSuccessPage({
  searchParams,
}: {
  searchParams: Promise<{ no?: string; type?: string }>
}) {
  return <SuccessContent searchParamsPromise={searchParams} />
}

async function SuccessContent({
  searchParamsPromise,
}: {
  searchParamsPromise: Promise<{ no?: string; type?: string }>
}) {
  const params = await searchParamsPromise
  const orderNo = params.no ?? '—'
  const isPickup = params.type === 'takeout'

  return (
    <div className="min-h-screen bg-gradient-to-b from-blue-900 to-blue-700 flex flex-col items-center justify-center px-6 text-white">
      <div className="text-center">
        {/* 圓形打勾 */}
        <div className="mx-auto mb-6 w-24 h-24 rounded-full bg-white/20 flex items-center justify-center">
          <span className="text-5xl">✓</span>
        </div>

        <h1 className="text-3xl font-bold mb-2">訂單已送出！</h1>
        <p className="text-blue-100 text-lg mb-8">廚房收到了，請稍候</p>

        <div className="bg-white/15 rounded-2xl px-8 py-6 mb-8">
          <p className="text-blue-100 text-sm mb-1">
            {isPickup ? '取餐號' : '訂單號碼'}
          </p>
          <p className="text-5xl font-black tracking-widest">#{orderNo}</p>
        </div>

        {isPickup ? (
          <p className="text-blue-100">叫號時請至取餐區領取</p>
        ) : (
          <p className="text-blue-100">餐點備妥後會送到您的桌位</p>
        )}
      </div>

      <div className="mt-12 flex flex-col gap-3 w-full max-w-xs">
        <Link
          href="/order"
          className="block text-center py-4 bg-white text-blue-900 font-bold text-lg rounded-xl shadow"
        >
          再點一單
        </Link>
        <p className="text-center text-blue-200 text-sm">
          如需修改，請告知服務人員
        </p>
      </div>
    </div>
  )
}
