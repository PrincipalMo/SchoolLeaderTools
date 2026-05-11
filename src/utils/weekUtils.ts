// Returns the ISO date string (YYYY-MM-DD) of the Monday for a given date
export function getMondayOf(date: Date): string {
  const d = new Date(date)
  const day = d.getDay() // 0=Sun
  const diff = day === 0 ? -6 : 1 - day
  d.setDate(d.getDate() + diff)
  return toISO(d)
}

export function toISO(date: Date): string {
  const y = date.getFullYear()
  const m = String(date.getMonth() + 1).padStart(2, '0')
  const d = String(date.getDate()).padStart(2, '0')
  return `${y}-${m}-${d}`
}

export function addWeeks(isoMonday: string, delta: number): string {
  const d = new Date(isoMonday + 'T00:00:00')
  d.setDate(d.getDate() + delta * 7)
  return toISO(d)
}

// Returns [Mon, Tue, Wed, Thu, Fri] dates from a Monday ISO string
export function getWeekDays(isoMonday: string): Date[] {
  const base = new Date(isoMonday + 'T00:00:00')
  return [0, 1, 2, 3, 4].map(i => {
    const d = new Date(base)
    d.setDate(d.getDate() + i)
    return d
  })
}

const SHORT_DAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri']
const LONG_DAYS  = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday']

export function formatDayHeader(date: Date, short = false): string {
  const prefix = short ? SHORT_DAYS[date.getDay() - 1] : LONG_DAYS[date.getDay() - 1]
  const m = date.getMonth() + 1
  const d = date.getDate()
  return `${prefix} ${m}/${d}`
}

export function formatWeekLabel(isoMonday: string): string {
  const days = getWeekDays(isoMonday)
  const start = days[0]
  const end   = days[4]
  const opts: Intl.DateTimeFormatOptions = { month: 'long', day: 'numeric', year: 'numeric' }
  const startStr = start.toLocaleDateString('en-US', { month: 'long', day: 'numeric' })
  const endStr   = end.toLocaleDateString('en-US', { day: 'numeric', year: 'numeric' })
  // same month: "May 4 – 8, 2026"
  if (start.getMonth() === end.getMonth()) {
    return `${startStr} – ${endStr}`
  }
  // cross-month: "Apr 28 – May 2, 2026"
  return `${startStr} – ${end.toLocaleDateString('en-US', opts)}`
}

export function currentWeekMonday(): string {
  return getMondayOf(new Date())
}
