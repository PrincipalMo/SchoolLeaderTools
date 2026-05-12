import { supabase, CalendarEvent, WeeklyPriority } from '../supabase'
import { formatWeekLabel, getWeekDays, formatDayHeader } from './weekUtils'

function escapeCsv(val: unknown): string {
  const s = val === null || val === undefined ? '' : String(val)
  if (s.includes(',') || s.includes('"') || s.includes('\n')) {
    return `"${s.replace(/"/g, '""')}"`
  }
  return s
}

function toCsvRow(row: string[]): string {
  return row.map(escapeCsv).join(',')
}

function downloadBlob(content: string, filename: string, type: string) {
  const blob = new Blob([content], { type })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  a.click()
  URL.revokeObjectURL(url)
}

export async function exportWeekCsv(userId: string, weekStart: string) {
  const [evRes, prRes] = await Promise.all([
    supabase.from('calendar_events').select('*').eq('user_id', userId).eq('week_start', weekStart).order('day_of_week').order('time_slot'),
    supabase.from('weekly_priorities').select('*').eq('user_id', userId).eq('week_start', weekStart).order('sort_order'),
  ])

  const events = (evRes.data || []) as CalendarEvent[]
  const priorities = (prRes.data || []) as WeeklyPriority[]
  const days = getWeekDays(weekStart)
  const dayNames = days.map(d => formatDayHeader(d))

  const TIME_SLOTS = [
    '7:00 - 7:30', '7:30 - 8:00', '8:00 - 8:30', '8:30 - 9:00', '9:00 - 9:30',
    '9:30 - 10:00', '10:00 - 10:30', '10:30 - 11:00', '11:00 - 11:30', '11:30 - 12:00',
    '12:00 - 12:30', '12:30 - 1:00', '1:00 - 1:30', '1:30 - 2:00', '2:00 - 2:30',
    '2:30 - 3:00', '3:00 - 3:30', '3:30 - 4:00', '4:00 - 4:30', '4:30 - 5:00',
  ]

  const sections: string[] = []

  sections.push(`Week at a Glance — ${formatWeekLabel(weekStart)}`)
  sections.push('')
  sections.push('=== CALENDAR ===')
  sections.push(toCsvRow(['Time', ...dayNames]))

  for (const slot of TIME_SLOTS) {
    const row: string[] = [slot]
    for (let d = 0; d < 5; d++) {
      const cell = events.filter(e => e.day_of_week === d && e.time_slot === slot)
      row.push(cell.map(e => (e.is_priority ? '★ ' : '') + e.title).join(' | '))
    }
    sections.push(toCsvRow(row))
  }

  sections.push('')
  sections.push('=== PRIORITIES ===')
  sections.push(toCsvRow(['#', 'Title', 'Status', 'Priority Event']))
  priorities.forEach((p, i) => {
    const linked = events.find(e => e.is_priority && e.title.toLowerCase().includes(p.title.toLowerCase()))
    sections.push(toCsvRow([String(i + 1), p.title, p.status || '—', linked ? 'Yes' : '']))
  })

  downloadBlob(sections.join('\n'), `WAG-${weekStart}.csv`, 'text/csv;charset=utf-8;')
}

// Category display names for the PDF
const CAT_LABELS: Record<string, string> = {
  'check-ins': 'Check-Ins',
  admin: 'Admin',
  instruction: 'Instruction',
  'family-engagement': 'Family Engagement',
  supervision: 'Supervision',
  'out-of-building': 'Out of Building',
  discipline: 'Discipline',
  climate: 'Climate',
  personal: 'Personal',
}

// Category colors matching the app's CSS vars
const CAT_COLORS: Record<string, { bg: string; text: string; border: string }> = {
  'check-ins':         { bg: '#dcfce7', text: '#14532d', border: '#22c55e' },
  admin:               { bg: '#dbeafe', text: '#1e3a8a', border: '#3b82f6' },
  instruction:         { bg: '#fef3c7', text: '#78350f', border: '#f59e0b' },
  'family-engagement': { bg: '#fce7f3', text: '#831843', border: '#ec4899' },
  supervision:         { bg: '#e0e7ff', text: '#312e81', border: '#6366f1' },
  'out-of-building':   { bg: '#ffedd5', text: '#7c2d12', border: '#f97316' },
  discipline:          { bg: '#fee2e2', text: '#7f1d1d', border: '#ef4444' },
  climate:             { bg: '#ccfbf1', text: '#134e4a', border: '#14b8a6' },
  personal:            { bg: '#fef9c3', text: '#713f12', border: '#a16207' },
}

function hexToRgb(hex: string): [number, number, number] {
  const r = parseInt(hex.slice(1, 3), 16)
  const g = parseInt(hex.slice(3, 5), 16)
  const b = parseInt(hex.slice(5, 7), 16)
  return [r, g, b]
}

export async function exportWeekPdf(userId: string, weekStart: string, priorityColor: string) {
  const [evRes, prRes] = await Promise.all([
    supabase.from('calendar_events').select('*').eq('user_id', userId).eq('week_start', weekStart).order('day_of_week').order('time_slot'),
    supabase.from('weekly_priorities').select('*').eq('user_id', userId).eq('week_start', weekStart).order('sort_order'),
  ])

  const events = (evRes.data || []) as CalendarEvent[]
  const priorities = (prRes.data || []) as WeeklyPriority[]
  const days = getWeekDays(weekStart)

  const TIME_SLOTS = [
    '7:00 - 7:30', '7:30 - 8:00', '8:00 - 8:30', '8:30 - 9:00', '9:00 - 9:30',
    '9:30 - 10:00', '10:00 - 10:30', '10:30 - 11:00', '11:00 - 11:30', '11:30 - 12:00',
    '12:00 - 12:30', '12:30 - 1:00', '1:00 - 1:30', '1:30 - 2:00', '2:00 - 2:30',
    '2:30 - 3:00', '3:00 - 3:30', '3:30 - 4:00', '4:00 - 4:30', '4:30 - 5:00',
  ]

  // Build a full HTML page for printing
  const dayHeaders = days.map(d => formatDayHeader(d))

  // Build calendar rows HTML
  const rowsHtml = TIME_SLOTS.map(slot => {
    const cells = [0, 1, 2, 3, 4].map(day => {
      const cellEvents = events.filter(e => e.day_of_week === day && e.time_slot === slot)
      if (!cellEvents.length) return '<td class="cell"></td>'
      const chips = cellEvents.map(ev => {
        const c = CAT_COLORS[ev.color_category] || { bg: '#f3f4f6', text: '#374151', border: '#9ca3af' }
        const isPriority = ev.is_priority
        const [pr, pg, pb] = hexToRgb(priorityColor)
        const priStyle = isPriority
          ? `outline: 2px solid ${priorityColor}; font-weight: 700; box-shadow: 0 0 0 1px rgba(${pr},${pg},${pb},0.2);`
          : ''
        return `<div class="chip" style="background:${c.bg};color:${c.text};border-left:3px solid ${c.border};${priStyle}">
          ${isPriority ? `<span class="star" style="color:${priorityColor}">★</span>` : ''}
          ${ev.title}
        </div>`
      }).join('')
      return `<td class="cell">${chips}</td>`
    }).join('')
    return `<tr><td class="time">${slot}</td>${cells}</tr>`
  }).join('')

  // Priorities section
  const prioritiesHtml = priorities.length === 0
    ? '<p class="no-priorities">No priorities set for this week.</p>'
    : `<table class="pri-table">
        <thead><tr><th>#</th><th>Priority</th><th>Status</th></tr></thead>
        <tbody>${priorities.map((p, i) => `
          <tr>
            <td class="pri-num">${i + 1}</td>
            <td class="pri-title">${p.title}</td>
            <td class="pri-status ${p.status === 'C' ? 'status-c' : p.status === 'IP' ? 'status-ip' : 'status-none'}">${p.status || '—'}</td>
          </tr>`).join('')}
        </tbody>
      </table>`

  // Legend
  const legendHtml = Object.entries(CAT_LABELS).map(([key, label]) => {
    const c = CAT_COLORS[key]
    return `<div class="legend-item"><span class="legend-dot" style="background:${c.bg};border:2px solid ${c.border}"></span>${label}</div>`
  }).join('')

  const html = `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <title>Week at a Glance — ${formatWeekLabel(weekStart)}</title>
  <style>
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; font-size: 10px; color: #1f2937; background: #fff; }
    .page { padding: 16px 20px; }
    .header { display: flex; justify-content: space-between; align-items: flex-end; border-bottom: 2px solid #1f2937; padding-bottom: 8px; margin-bottom: 12px; }
    .header-title { font-size: 18px; font-weight: 800; color: #111827; }
    .header-sub { font-size: 11px; color: #6b7280; margin-top: 2px; }
    .header-date { font-size: 11px; color: #9ca3af; text-align: right; }
    table { width: 100%; border-collapse: collapse; }
    th { background: #1f2937; color: #fff; padding: 6px 5px; font-size: 10px; font-weight: 600; text-align: center; }
    th.time-header { width: 68px; }
    .time { padding: 4px 5px; font-size: 9px; color: #6b7280; white-space: nowrap; background: #f9fafb; border: 1px solid #e5e7eb; vertical-align: top; font-weight: 500; width: 68px; }
    .cell { padding: 2px 3px; border: 1px solid #e5e7eb; vertical-align: top; min-height: 22px; }
    .chip { padding: 2px 5px 2px 6px; border-radius: 3px; font-size: 9px; font-weight: 500; margin-bottom: 2px; display: flex; align-items: center; gap: 2px; line-height: 1.3; }
    .chip:last-child { margin-bottom: 0; }
    .star { font-size: 9px; flex-shrink: 0; }
    .section { margin-top: 14px; }
    .section-title { font-size: 11px; font-weight: 800; text-transform: uppercase; letter-spacing: 0.06em; color: #374151; border-bottom: 1px solid #d1d5db; padding-bottom: 4px; margin-bottom: 8px; }
    .pri-table { width: 100%; border-collapse: collapse; }
    .pri-table th { background: #374151; color: #fff; padding: 5px 8px; font-size: 9px; text-align: left; }
    .pri-table td { padding: 4px 8px; border-bottom: 1px solid #f3f4f6; font-size: 10px; }
    .pri-num { width: 28px; color: #9ca3af; text-align: center; font-weight: 600; }
    .pri-title { font-weight: 500; color: #111827; }
    .pri-status { width: 60px; text-align: center; font-weight: 700; font-size: 9px; border-radius: 4px; padding: 2px 4px; }
    .status-c { background: #dcfce7; color: #14532d; }
    .status-ip { background: #fef3c7; color: #92400e; }
    .status-none { background: #f3f4f6; color: #9ca3af; }
    .no-priorities { color: #9ca3af; font-style: italic; font-size: 10px; }
    .legend { display: flex; flex-wrap: wrap; gap: 6px 14px; margin-top: 10px; }
    .legend-item { display: flex; align-items: center; gap: 4px; font-size: 9px; color: #4b5563; }
    .legend-dot { width: 10px; height: 10px; border-radius: 2px; flex-shrink: 0; }
    @media print {
      body { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
      .page { padding: 10px 14px; }
    }
  </style>
</head>
<body>
  <div class="page">
    <div class="header">
      <div>
        <div class="header-title">Week at a Glance</div>
        <div class="header-sub">${formatWeekLabel(weekStart)}</div>
      </div>
      <div class="header-date">Printed ${new Date().toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })}</div>
    </div>

    <table>
      <thead>
        <tr>
          <th class="time-header"></th>
          ${dayHeaders.map(d => `<th>${d}</th>`).join('')}
        </tr>
      </thead>
      <tbody>
        ${rowsHtml}
      </tbody>
    </table>

    <div class="section">
      <div class="section-title">Priorities for Week</div>
      ${prioritiesHtml}
    </div>

    <div class="section">
      <div class="section-title">Color Legend</div>
      <div class="legend">${legendHtml}</div>
    </div>
  </div>
</body>
</html>`

  const printWindow = window.open('', '_blank', 'width=900,height=700')
  if (!printWindow) return
  printWindow.document.write(html)
  printWindow.document.close()
  printWindow.focus()
  setTimeout(() => {
    printWindow.print()
  }, 400)
}
