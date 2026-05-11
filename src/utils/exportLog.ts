import { supabase, ActivityLog, CalendarEvent, WeeklyPriority, DelegatedTask, Leader } from '../supabase'

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

function downloadCsv(content: string, filename: string) {
  const blob = new Blob([content], { type: 'text/csv;charset=utf-8;' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  a.click()
  URL.revokeObjectURL(url)
}

export async function exportFullRecord(userId: string) {
  const [evRes, prRes, leadersRes, tasksRes, logRes] = await Promise.all([
    supabase.from('calendar_events').select('*').eq('user_id', userId).order('week_start').order('day_of_week').order('time_slot'),
    supabase.from('weekly_priorities').select('*').eq('user_id', userId).order('week_start').order('sort_order'),
    supabase.from('leaders').select('*').eq('user_id', userId).order('name'),
    supabase.from('delegated_tasks').select('*').eq('user_id', userId).order('created_at'),
    supabase.from('activity_log').select('*').eq('user_id', userId).order('created_at', { ascending: false }),
  ])

  const sections: string[] = []

  // Calendar Events
  sections.push('=== CALENDAR EVENTS ===')
  sections.push(toCsvRow(['Week Start', 'Day', 'Time Slot', 'Title', 'Category', 'Source', 'Created At']))
  const dayNames = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday']
  for (const ev of (evRes.data || []) as CalendarEvent[]) {
    sections.push(toCsvRow([
      ev.week_start,
      dayNames[ev.day_of_week] || String(ev.day_of_week),
      ev.time_slot,
      ev.title,
      ev.color_category,
      ev.source,
      ev.created_at,
    ]))
  }

  sections.push('')

  // Weekly Priorities
  sections.push('=== WEEKLY PRIORITIES ===')
  sections.push(toCsvRow(['Week Start', 'Title', 'Status', 'Sort Order', 'Created At']))
  for (const p of (prRes.data || []) as WeeklyPriority[]) {
    sections.push(toCsvRow([p.week_start, p.title, p.status, String(p.sort_order), p.created_at]))
  }

  sections.push('')

  // Leaders
  sections.push('=== LEADERS ===')
  sections.push(toCsvRow(['Name', 'Role', 'Created At']))
  for (const l of (leadersRes.data || []) as Leader[]) {
    sections.push(toCsvRow([l.name, l.role, l.created_at]))
  }

  sections.push('')

  // Delegated Tasks
  const leaderMap: Record<string, string> = {}
  for (const l of (leadersRes.data || []) as Leader[]) leaderMap[l.id] = l.name

  sections.push('=== DELEGATED TASKS ===')
  sections.push(toCsvRow(['Leader', 'Title', 'Description', 'Due Date', 'Status', 'Week Start', 'Created At']))
  for (const t of (tasksRes.data || []) as DelegatedTask[]) {
    sections.push(toCsvRow([
      leaderMap[t.leader_id] || t.leader_id,
      t.title,
      t.description,
      t.due_date || '',
      t.status,
      t.week_start || '',
      t.created_at,
    ]))
  }

  sections.push('')

  // Activity Log
  sections.push('=== ACTIVITY LOG ===')
  sections.push(toCsvRow(['Date/Time', 'Action', 'Entity Type', 'Details']))
  for (const entry of (logRes.data || []) as ActivityLog[]) {
    sections.push(toCsvRow([
      new Date(entry.created_at).toLocaleString(),
      entry.action,
      entry.entity_type,
      entry.details ? JSON.stringify(entry.details) : '',
    ]))
  }

  const date = new Date().toISOString().slice(0, 10)
  downloadCsv(sections.join('\n'), `WAG-Record-${date}.csv`)
}
