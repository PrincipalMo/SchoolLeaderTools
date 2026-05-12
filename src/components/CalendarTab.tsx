import { useEffect, useState, useCallback } from 'react'
import { supabase, CalendarEvent, WeeklyPriority, ColorCategory, ICalFeed } from '../supabase'
import { seedWeekData, SEED_WEEK } from '../seedData'
import { addWeeks, formatWeekLabel, formatDayHeader, getWeekDays, currentWeekMonday } from '../utils/weekUtils'
import CalendarImport from './CalendarImport'
import styles from './CalendarTab.module.css'

const TIME_SLOTS = [
  '7:00 - 7:30', '7:30 - 8:00', '8:00 - 8:30', '8:30 - 9:00', '9:00 - 9:30',
  '9:30 - 10:00', '10:00 - 10:30', '10:30 - 11:00', '11:00 - 11:30', '11:30 - 12:00',
  '12:00 - 12:30', '12:30 - 1:00', '1:00 - 1:30', '1:30 - 2:00', '2:00 - 2:30',
  '2:30 - 3:00', '3:00 - 3:30', '3:30 - 4:00', '4:00 - 4:30', '4:30 - 5:00',
]

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
  return map[cat] || styles.catNone
}

interface EditModal {
  event: CalendarEvent | null
  day: number
  timeSlot: string
  isNew: boolean
}

interface Props {
  userId: string
}

export default function CalendarTab({ userId }: Props) {
  const [weekStart, setWeekStart] = useState<string>(currentWeekMonday())
  const [events, setEvents] = useState<CalendarEvent[]>([])
  const [priorities, setPriorities] = useState<WeeklyPriority[]>([])
  const [feeds, setFeeds] = useState<ICalFeed[]>([])
  const [loading, setLoading] = useState(true)
  const [editModal, setEditModal] = useState<EditModal | null>(null)
  const [editTitle, setEditTitle] = useState('')
  const [editCategory, setEditCategory] = useState<ColorCategory>('')
  const [editIsPriority, setEditIsPriority] = useState(false)
  const [priorityEdit, setPriorityEdit] = useState<string | null>(null)
  const [priorityText, setPriorityText] = useState('')
  const [newPriorityText, setNewPriorityText] = useState('')
  const [saving, setSaving] = useState(false)
  const [showImport, setShowImport] = useState(false)

  const weekDays = getWeekDays(weekStart)
  const isCurrentWeek = weekStart === currentWeekMonday()
  const isSeedWeek = weekStart === SEED_WEEK

  const load = useCallback(async () => {
    setLoading(true)
    // Only seed sample data when on the seed week
    if (isSeedWeek) await seedWeekData(userId)
    const [evRes, prRes, feedRes] = await Promise.all([
      supabase.from('calendar_events').select('*').eq('week_start', weekStart).eq('user_id', userId),
      supabase.from('weekly_priorities').select('*').eq('week_start', weekStart).eq('user_id', userId).order('sort_order'),
      supabase.from('ical_feeds').select('*').eq('user_id', userId).order('created_at'),
    ])
    if (evRes.data) setEvents(evRes.data as CalendarEvent[])
    if (prRes.data) setPriorities(prRes.data as WeeklyPriority[])
    if (feedRes.data) setFeeds(feedRes.data as ICalFeed[])
    setLoading(false)
  }, [userId, weekStart, isSeedWeek])

  useEffect(() => { load() }, [load])

  function getEventsForCell(day: number, slot: string): CalendarEvent[] {
    return events.filter(e => e.day_of_week === day && e.time_slot === slot)
  }

  function openEditCell(day: number, slot: string) {
    const ev = events.find(e => e.day_of_week === day && e.time_slot === slot && e.source === 'manual')
    setEditModal({ event: ev || null, day, timeSlot: slot, isNew: !ev })
    setEditTitle(ev?.title || '')
    setEditCategory(ev?.color_category || '')
    setEditIsPriority(ev?.is_priority || false)
  }

  async function saveCell() {
    if (!editModal) return
    setSaving(true)
    if (editModal.isNew && editTitle.trim()) {
      await supabase.from('calendar_events').insert({
        user_id: userId,
        week_start: weekStart,
        day_of_week: editModal.day,
        time_slot: editModal.timeSlot,
        title: editTitle.trim(),
        color_category: editCategory,
        source: 'manual',
        is_priority: editIsPriority,
      })
      await logAction('create', 'calendar_event', { title: editTitle.trim(), week: weekStart })
    } else if (!editModal.isNew && editModal.event) {
      if (editTitle.trim()) {
        await supabase.from('calendar_events').update({
          title: editTitle.trim(),
          color_category: editCategory,
          is_priority: editIsPriority,
        }).eq('id', editModal.event.id)
        await logAction('update', 'calendar_event', { title: editTitle.trim() })
      } else {
        await supabase.from('calendar_events').delete().eq('id', editModal.event.id)
        await logAction('delete', 'calendar_event', { title: editModal.event.title })
      }
    }
    setSaving(false)
    setEditModal(null)
    load()
  }

  async function logAction(action: string, entityType: string, details: object) {
    await supabase.from('activity_log').insert({ user_id: userId, action, entity_type: entityType, details })
  }

  async function toggleEventPriority(ev: CalendarEvent, e: React.MouseEvent) {
    e.stopPropagation()
    const next = !ev.is_priority
    await supabase.from('calendar_events').update({ is_priority: next }).eq('id', ev.id)
    setEvents(prev => prev.map(x => x.id === ev.id ? { ...x, is_priority: next } : x))
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
      user_id: userId,
      week_start: weekStart,
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

  function goToPrev() { setWeekStart(w => addWeeks(w, -1)) }
  function goToNext() { setWeekStart(w => addWeeks(w, 1)) }
  function goToToday() { setWeekStart(currentWeekMonday()) }

  return (
    <div className={styles.container}>
      {/* Week navigation toolbar */}
      <div className={styles.toolbar}>
        <div className={styles.weekNav}>
          <button className={styles.navBtn} onClick={goToPrev} title="Previous week">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
              <polyline points="15 18 9 12 15 6"/>
            </svg>
          </button>
          <div className={styles.weekLabelWrap}>
            <span className={styles.weekLabel}>{formatWeekLabel(weekStart)}</span>
            {isCurrentWeek && <span className={styles.currentBadge}>Current Week</span>}
          </div>
          <button className={styles.navBtn} onClick={goToNext} title="Next week">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
              <polyline points="9 18 15 12 9 6"/>
            </svg>
          </button>
          {!isCurrentWeek && (
            <button className={styles.todayBtn} onClick={goToToday}>Today</button>
          )}
        </div>
        <button className={styles.importBtn} onClick={() => setShowImport(true)}>
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/>
            <polyline points="7 10 12 15 17 10"/>
            <line x1="12" y1="15" x2="12" y2="3"/>
          </svg>
          Import Calendar
          {feeds.length > 0 && <span className={styles.feedBadge}>{feeds.length}</span>}
        </button>
      </div>

      {loading ? (
        <div className={styles.loading}>
          <div className={styles.spinner} />
          <span>Loading...</span>
        </div>
      ) : (
        <div className={styles.layout}>
          {/* Calendar grid */}
          <div className={styles.calendarWrap}>
            <div className={styles.calendarHeader}>
              <div className={styles.timeColHeader} />
              {weekDays.map((d, i) => (
                <div key={i} className={styles.dayHeader}>
                  <span className={styles.dayFull}>{formatDayHeader(d)}</span>
                  <span className={styles.dayShort}>{formatDayHeader(d, true)}</span>
                </div>
              ))}
            </div>
            <div className={styles.calendarBody}>
              {TIME_SLOTS.map((slot) => (
                <div key={slot} className={styles.row}>
                  <div className={styles.timeCell}>{slot}</div>
                  {[0, 1, 2, 3, 4].map((day) => {
                    const cellEvents = getEventsForCell(day, slot)
                    return (
                      <div
                        key={day}
                        className={`${styles.cell} ${cellEvents.length ? styles.cellFilled : styles.cellEmpty}`}
                        onClick={() => openEditCell(day, slot)}
                      >
                        {cellEvents.map(ev => (
                          <div
                            key={ev.id}
                            className={`${styles.eventChip} ${categoryClass(ev.color_category)} ${ev.source === 'imported' ? styles.chipImported : ''} ${ev.is_priority ? styles.chipPriority : ''}`}
                          >
                            <span className={styles.chipLabel}>
                              {ev.source === 'imported' && <span className={styles.importedDot} />}
                              {ev.title}
                            </span>
                            <button
                              className={`${styles.starBtn} ${ev.is_priority ? styles.starOn : styles.starOff}`}
                              onClick={e => toggleEventPriority(ev, e)}
                              title={ev.is_priority ? 'Remove priority flag' : 'Mark as priority'}
                            >
                              ★
                            </button>
                          </div>
                        ))}
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

            {/* Priority events from calendar */}
            {events.filter(e => e.is_priority).length > 0 && (
              <div className={styles.priorityEventsSection}>
                <p className={styles.priorityEventsLabel}>
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor">
                    <path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z"/>
                  </svg>
                  Priority Events ({events.filter(e => e.is_priority).length})
                </p>
                <ul className={styles.priorityEventsList}>
                  {events.filter(e => e.is_priority).map(ev => (
                    <li key={ev.id} className={styles.priorityEventItem}>
                      <span className={`${styles.priorityEventDot} ${categoryClass(ev.color_category)}`} />
                      <div className={styles.priorityEventText}>
                        <span className={styles.priorityEventTitle}>{ev.title}</span>
                        <span className={styles.priorityEventMeta}>
                          {['Mon', 'Tue', 'Wed', 'Thu', 'Fri'][ev.day_of_week]} · {ev.time_slot}
                        </span>
                      </div>
                      <button
                        className={styles.starBtnSm}
                        onClick={e => toggleEventPriority(ev, e)}
                        title="Remove priority flag"
                      >★</button>
                    </li>
                  ))}
                </ul>
              </div>
            )}

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
                      <button className={styles.deleteBtn} onClick={() => deletePriority(p.id)} title="Delete">×</button>
                    </div>
                  )}
                </li>
              ))}
              {priorities.length === 0 && (
                <li className={styles.emptyPriorities}>No priorities yet for this week.</li>
              )}
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

            <div className={styles.legend}>
              <p className={styles.legendTitle}>Color Legend</p>
              <div className={styles.legendGrid}>
                {CATEGORIES.map(c => (
                  <div key={c.key} className={styles.legendItem}>
                    <span className={`${styles.legendDot} ${categoryClass(c.key)}`} />
                    <span className={styles.legendLabel}>{c.label}</span>
                  </div>
                ))}
                <div className={styles.legendItem}>
                  <span className={`${styles.legendDot} ${styles.catNone}`} style={{ border: '1.5px dashed #9ca3af' }} />
                  <span className={styles.legendLabel}>Imported</span>
                </div>
              </div>
            </div>
          </aside>
        </div>
      )}

      {showImport && (
        <CalendarImport
          userId={userId}
          weekStart={weekStart}
          feeds={feeds}
          onFeedsChange={setFeeds}
          onImported={load}
          onClose={() => setShowImport(false)}
        />
      )}

      {editModal && (
        <div className={styles.modalBackdrop} onClick={() => setEditModal(null)}>
          <div className={styles.modal} onClick={e => e.stopPropagation()}>
            <div className={styles.modalHeader}>
              <h3>{editModal.isNew ? 'Add Event' : 'Edit Event'}</h3>
              <button className={styles.modalClose} onClick={() => setEditModal(null)}>×</button>
            </div>
            <div className={styles.modalBody}>
              <p className={styles.modalMeta}>
                {formatDayHeader(weekDays[editModal.day])} · {editModal.timeSlot}
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
              <label className={styles.priorityCheckLabel}>
                <input
                  type="checkbox"
                  checked={editIsPriority}
                  onChange={e => setEditIsPriority(e.target.checked)}
                  className={styles.priorityCheckbox}
                />
                <span className={styles.priorityCheckText}>
                  <span className={styles.priorityCheckStar}>★</span>
                  Mark as priority event
                </span>
              </label>
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
