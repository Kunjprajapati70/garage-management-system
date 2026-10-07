export function escapeRegex(value: string) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

export function parseSort(sort: string | undefined, allowed: string[], fallback = '-createdAt') {
  if (!sort) return fallback
  const field = sort.startsWith('-') ? sort.slice(1) : sort
  if (!allowed.includes(field)) return fallback
  return sort
}

export function roundMoney(value: number) {
  return Math.round((value + Number.EPSILON) * 100) / 100
}

export function escapeHtml(value: string) {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')
}

export function durationToMs(value: string) {
  const match = /^(\d+)([smhd])$/.exec(value.trim())
  if (!match) return 15 * 60 * 1000
  const amount = Number(match[1])
  const unit = match[2]
  const multipliers: Record<string, number> = { s: 1000, m: 60_000, h: 3_600_000, d: 86_400_000 }
  return amount * multipliers[unit]
}

export function startOfDay(date = new Date()) {
  const copy = new Date(date)
  copy.setHours(0, 0, 0, 0)
  return copy
}

export function startOfMonth(date = new Date()) {
  return new Date(date.getFullYear(), date.getMonth(), 1)
}

export function monthKey(date: Date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`
}

export function monthLabel(key: string) {
  const [year, month] = key.split('-').map(Number)
  return new Date(year, month - 1, 1).toLocaleString('en-IN', { month: 'short', year: 'numeric' })
}

export function pageMeta(page: number, limit: number, total: number) {
  return { page, limit, total, totalPages: Math.max(1, Math.ceil(total / limit)) }
}

export function blankToUndefined(value?: string | null) {
  const trimmed = value?.trim()
  return trimmed ? trimmed : undefined
}

export function monthsBetween(from: Date, to: Date) {
  const cursor = new Date(from.getFullYear(), from.getMonth(), 1)
  const end = new Date(to.getFullYear(), to.getMonth(), 1)
  const months: { key: string; label: string; start: Date; end: Date }[] = []
  while (cursor <= end && months.length < 18) {
    const key = monthKey(cursor)
    const next = new Date(cursor.getFullYear(), cursor.getMonth() + 1, 1)
    months.push({ key, label: monthLabel(key), start: new Date(cursor), end: next })
    cursor.setMonth(cursor.getMonth() + 1)
  }
  return months
}

export function lastMonths(count: number, from = new Date()) {
  const months: { key: string; label: string; start: Date; end: Date }[] = []
  for (let index = count - 1; index >= 0; index -= 1) {
    const start = new Date(from.getFullYear(), from.getMonth() - index, 1)
    const end = new Date(from.getFullYear(), from.getMonth() - index + 1, 1)
    const key = monthKey(start)
    months.push({ key, label: monthLabel(key), start, end })
  }
  return months
}
