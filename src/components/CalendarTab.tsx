import { useEffect, useState, useCallback } from 'react'
import { supabase, CalendarEvent, WeeklyPriority, ColorCategory } from '../supabase'
import { seedWeekData, WEEK_START, TIME_SLOTS } from '../seedData'
import styles from './CalendarTab.module.css'

const DAYS = ['Monday 5/4', 'Tuesday 5/5', 'Wednesday 5/6', 'Thursday 5/7', 'Friday 5/8']
const DAY_SHORT = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri']

const CATEGORIES: { key: ColorCategory; label: string }[] = [
  { key: 'check-ins', label: 'Check-Ins' },
  { key: 'admin', label: 'Admin' },
  { key: 'instruction', label: 'Instruction' },
  { key: 'family-engagement', label: 'Family Engagement' },
  { key: 'supervision', label: 'Supervision' },
  { key: 'out-of-building', label: 'Out of Building' },
  { key: 'discipline', label: 'Discipline' },
  { key: 'climate', label: 'Climate' },
  { key: 'personal', label: 'Personal' },
]

function categoryClass(cat: ColorCategory): string {
  const map: Record<string, string> = {
    'check-ins': styles.catCheckIns,
    admin: styles.catAdmin,
    instruction: styles.catInstruction,
    'family-engagement': styles.catFamily,
    supervision: styles.catSupervision,
    'out-of-building': styles.catOutOfBuilding,
    discipline: styles.catDiscipline,
    climate: styles.catClimate,
    personal: styles.catPersonal,
  }
  return map[cat] || ''
}

interface EditModal {
  event: CalendarEvent | null
  day: number
  timeSlot: string
  isNew: boolean
}

export default function CalendarTab() {
  const [events, setEvents] = useState<CalendarEvent[]>([])
  const [priorities, setPriorities] = useState<WeeklyPriority[]>([])
  const [loading, setLoading] = useState(true)
  const [editModal, setEditModal] = useState<EditModal | null>(null)
  const [editTitle, setEditTitle] = useState('')
  const [editCategory, setEditCategory] = useState<ColorCategory>('')
  const [priorityEdit, setPriorityEdit] = useState<string | null>(null)
  const [priorityText, setPriorityText] = useState('')
  const [newPriorityText, setNewPriorityText] = useState('')
  const [saving, setSaving] = useState(false)

  const load = useCallback(async () => {
    setLoading(true)
    await seedWeekData()
    const [evRes, prRes] = await Promise.all([
      supabase.from('calendar_events').select('*').eq('week_start', WEEK_START),
      supabase.from('weekly_priorities').select('*').eq('week_start', WEEK_START).order('sort_order'),
    ])
    if (evRes.data) setEvents(evRes.data as CalendarEvent[])
    if (prRes.data) setPriorities(prRes.data as WeeklyPriority[])
    setLoading(false)
  }, [])

  useEffect(() => { load() }, [load])

  function getEvent(day: number, slot: string): CalendarEvent | undefined {
    return events.find(e => e.day_of_week === day && e.time_slot === slot)
  }

  function openEditCell(day: number, slot: string) {
    const ev = getEvent(day, slot)
    setEditModal({ event: ev || null, day, timeSlot: slot, isNew: !ev })
    setEditTitle(ev?.title || '')
    setEditCategory(ev?.color_category || '')
  }

  async function saveCell() {
    if (!editModal) return
    setSaving(true)
    if (editModal.isNew && editTitle.trim()) {
      await supabase.from('calendar_events').insert({
        week_start: WEEK_START,
        day_of_week: editModal.day,
        time_slot: editModal.timeSlot,
        title: editTitle.trim(),
        color_category: editCategory,
      })
    } else if (!editModal.isNew && editModal.event) {
      if (editTitle.trim()) {
        await supabase.from('calendar_events').update({
          title: editTitle.trim(),
          color_category: editCategory,
        }).eq('id', editModal.event.id)
      } else {
        await supabase.from('calendar_events').delete().eq('id', editModal.event.id)
      }
    }
    setSaving(false)
    setEditModal(null)
    load()
  }

  async function togglePriorityStatus(p: WeeklyPriority) {
    const cycle = ['', 'IP', 'C']
    const next = cycle[(cycle.indexOf(p.status) + 1) % cycle.length]
    await supabase.from('weekly_priorities').update({ status: next }).eq('id', p.id)
    setPriorities(prev => prev.map(x => x.id === p.id ? { ...x, status: next } : x))
  }

  async function savePriorityEdit(p: WeeklyPriority) {
    if (!priorityText.trim()) return
    await supabase.from('weekly_priorities').update({ title: priorityText.trim() }).eq('id', p.id)
    setPriorities(prev => prev.map(x => x.id === p.id ? { ...x, title: priorityText.trim() } : x))
    setPriorityEdit(null)
  }

  async function addPriority() {
    if (!newPriorityText.trim()) return
    const { data } = await supabase.from('weekly_priorities').insert({
      week_start: WEEK_START,
      title: newPriorityText.trim(),
      status: '',
      sort_order: priorities.length,
    }).select().single()
    if (data) setPriorities(prev => [...prev, data as WeeklyPriority])
    setNewPriorityText('')
  }

  async function deletePriority(id: string) {
    await supabase.from('weekly_priorities').delete().eq('id', id)
    setPriorities(prev => prev.filter(p => p.id !== id))
  }

  if (loading) return (
    <div className={styles.loading}>
      <div className={styles.spinner} />
      <span>Loading calendar...</span>
    </div>
  )

  return (
    <div className={styles.container}>
      <div className={styles.layout}>
        {/* Calendar grid */}
        <div className={styles.calendarWrap}>
          <div className={styles.calendarHeader}>
            <div className={styles.timeColHeader} />
            {DAYS.map((d, i) => (
              <div key={i} className={styles.dayHeader}>
                <span className={styles.dayFull}>{d}</span>
                <span className={styles.dayShort}>{DAY_SHORT[i]}</span>
              </div>
            ))}
          </div>
          <div className={styles.calendarBody}>
            {TIME_SLOTS.map((slot) => (
              <div key={slot} className={styles.row}>
                <div className={styles.timeCell}>{slot}</div>
                {[0, 1, 2, 3, 4].map((day) => {
                  const ev = getEvent(day, slot)
                  return (
                    <div
                      key={day}
                      className={`${styles.cell} ${ev ? styles.cellFilled : styles.cellEmpty}`}
                      onClick={() => openEditCell(day, slot)}
                    >
                      {ev && (
                        <div className={`${styles.eventChip} ${categoryClass(ev.color_category)}`}>
                          {ev.title}
                        </div>
                      )}
                    </div>
                  )
                })}
              </div>
            ))}
          </div>
        </div>

        {/* Priorities sidebar */}
        <aside className={styles.sidebar}>
          <div className={styles.sidebarHeader}>
            <h2 className={styles.sidebarTitle}>Priorities for Week</h2>
          </div>
          <ul className={styles.priorityList}>
            {priorities.map((p) => (
              <li key={p.id} className={styles.priorityItem}>
                {priorityEdit === p.id ? (
                  <div className={styles.priorityEditRow}>
                    <input
                      className={styles.priorityInput}
                      value={priorityText}
                      onChange={e => setPriorityText(e.target.value)}
                      onKeyDown={e => e.key === 'Enter' && savePriorityEdit(p)}
                      autoFocus
                    />
                    <button className={styles.btnSm} onClick={() => savePriorityEdit(p)}>Save</button>
                    <button className={`${styles.btnSm} ${styles.btnGhost}`} onClick={() => setPriorityEdit(null)}>✕</button>
                  </div>
                ) : (
                  <div className={styles.priorityRow}>
                    <button
                      className={`${styles.statusBadge} ${p.status === 'IP' ? styles.statusIP : p.status === 'C' ? styles.statusC : styles.statusNone}`}
                      onClick={() => togglePriorityStatus(p)}
                      title="Click to cycle status"
                    >
                      {p.status || '—'}
                    </button>
                    <span
                      className={styles.priorityText}
                      onDoubleClick={() => { setPriorityEdit(p.id); setPriorityText(p.title) }}
                    >
                      {p.title}
                    </span>
                    <button
                      className={styles.deleteBtn}
                      onClick={() => deletePriority(p.id)}
                      title="Delete"
                    >×</button>
                  </div>
                )}
              </li>
            ))}
          </ul>
          <div className={styles.addPriority}>
            <input
              className={styles.addInput}
              placeholder="Add priority..."
              value={newPriorityText}
              onChange={e => setNewPriorityText(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && addPriority()}
            />
            <button className={styles.addBtn} onClick={addPriority}>Add</button>
          </div>

          {/* Legend */}
          <div className={styles.legend}>
            <p className={styles.legendTitle}>Color Legend</p>
            <div className={styles.legendGrid}>
              {CATEGORIES.map(c => (
                <div key={c.key} className={styles.legendItem}>
                  <span className={`${styles.legendDot} ${categoryClass(c.key)}`} />
                  <span className={styles.legendLabel}>{c.label}</span>
                </div>
              ))}
            </div>
          </div>
        </aside>
      </div>

      {/* Edit modal */}
      {editModal && (
        <div className={styles.modalBackdrop} onClick={() => setEditModal(null)}>
          <div className={styles.modal} onClick={e => e.stopPropagation()}>
            <div className={styles.modalHeader}>
              <h3>{editModal.isNew ? 'Add Event' : 'Edit Event'}</h3>
              <button className={styles.modalClose} onClick={() => setEditModal(null)}>×</button>
            </div>
            <div className={styles.modalBody}>
              <p className={styles.modalMeta}>
                {DAYS[editModal.day]} · {editModal.timeSlot}
              </p>
              <label className={styles.label}>Event title</label>
              <input
                className={styles.input}
                value={editTitle}
                onChange={e => setEditTitle(e.target.value)}
                placeholder="Enter event..."
                autoFocus
                onKeyDown={e => e.key === 'Enter' && saveCell()}
              />
              <label className={styles.label}>Category</label>
              <select
                className={styles.select}
                value={editCategory}
                onChange={e => setEditCategory(e.target.value as ColorCategory)}
              >
                <option value="">None</option>
                {CATEGORIES.map(c => (
                  <option key={c.key} value={c.key}>{c.label}</option>
                ))}
              </select>
              {!editModal.isNew && (
                <p className={styles.deleteHint}>Clear the title and save to remove this event.</p>
              )}
            </div>
            <div className={styles.modalFooter}>
              <button className={styles.btnGhost} onClick={() => setEditModal(null)}>Cancel</button>
              <button className={styles.btnPrimary} onClick={saveCell} disabled={saving}>
                {saving ? 'Saving...' : 'Save'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
