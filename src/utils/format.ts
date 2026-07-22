export function formatBytes(n: number): string {
  if (!n || n < 0) return '0 B'
  const units = ['B', 'K', 'M', 'G', 'T', 'P']
  let i = 0
  let v = n
  while (v >= 1024 && i < units.length - 1) {
    v /= 1024
    i++
  }
  // Up to 2 decimals, dropping unnecessary trailing zeros so values stay uniform
  // (e.g. 200 -> "200G", 50 -> "50G", 50.5 -> "50.5G").
  return `${parseFloat(v.toFixed(2))} ${units[i]}`
}

// formatPrice renders a cents amount as a yuan string, e.g. 1234 -> "¥12.34".
export function formatPrice(cents: number): string {
  if (!cents || cents < 0) return '¥0.00'
  return `¥${(cents / 100).toFixed(2)}`
}

export function formatDateTime(iso?: string | null): string {
  if (!iso) return '—'
  const d = new Date(iso)
  if (isNaN(d.getTime())) return iso
  return d.toLocaleString()
}

// formatRelative returns "just now" / "3 min ago" / "offline".
export function formatRelative(iso?: string | null): string {
  if (!iso) return 'offline'
  const d = new Date(iso)
  if (isNaN(d.getTime())) return '—'
  const diff = Date.now() - d.getTime()
  const sec = Math.floor(diff / 1000)
  if (sec < 60) return 'just now'
  const min = Math.floor(sec / 60)
  if (min < 60) return `${min} min ago`
  const hr = Math.floor(min / 60)
  if (hr < 24) return `${hr} h ago`
  const day = Math.floor(hr / 24)
  return `${day} d ago`
}
