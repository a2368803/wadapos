export function formatPrice(price: number): string {
  return `NT$ ${price.toLocaleString()}`
}

export function formatDateTime(dateString: string): string {
  const date = new Date(dateString)
  return date.toLocaleString('zh-TW', {
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  })
}

export function formatTime(dateString: string): string {
  const date = new Date(dateString)
  return date.toLocaleString('zh-TW', {
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false,
  })
}

export function generateIdempotencyKey(): string {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`
}

export function getStatusLabel(status: string): string {
  const labels: Record<string, string> = {
    pending: '未列印',
    printed: '已列印',
    completed: '已完成',
    cancelled: '已取消',
  }
  return labels[status] ?? status
}

export function getStatusColor(status: string): string {
  const colors: Record<string, string> = {
    pending: 'bg-yellow-100 text-yellow-800 border-yellow-300',
    printed: 'bg-blue-100 text-blue-800 border-blue-300',
    completed: 'bg-green-100 text-green-800 border-green-300',
    cancelled: 'bg-gray-100 text-gray-600 border-gray-300',
  }
  return colors[status] ?? 'bg-gray-100 text-gray-600'
}

export function getOrderTypeLabel(type: string): string {
  return type === 'dine-in' ? '內用' : '外帶'
}

export function playNewOrderAlert() {
  try {
    const AudioCtx = window.AudioContext || (window as Window & { webkitAudioContext?: typeof AudioContext }).webkitAudioContext
    if (!AudioCtx) return
    const ctx = new AudioCtx()
    const beep = (freq: number, start: number, duration: number) => {
      const osc = ctx.createOscillator()
      const gain = ctx.createGain()
      osc.connect(gain)
      gain.connect(ctx.destination)
      osc.type = 'sine'
      osc.frequency.value = freq
      gain.gain.setValueAtTime(0.4, ctx.currentTime + start)
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + start + duration)
      osc.start(ctx.currentTime + start)
      osc.stop(ctx.currentTime + start + duration)
    }
    beep(880, 0, 0.15)
    beep(1100, 0.2, 0.15)
    beep(880, 0.4, 0.25)
  } catch {
    // Audio not critical — silent fail
  }
}
