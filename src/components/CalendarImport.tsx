import { useState } from 'react'
import { supabase, ICalFeed, ColorCategory } from '../supabase'
import styles from './CalendarImport.module.css'

interface ParsedEvent {
  uid: string
  summary: string
  dtstart: string | null
  dtend: string | null
  description: string
  location: string
}

interface Props {
  userId: string
  weekStart: string
  feeds: ICalFeed[]
  onFeedsChange: (feeds: ICalFeed[]) => void
  onImported: () => void
  onClose: () => void
}

function toWeekday(iso: string): number {
  const d = new Date(iso)
  const day = d.getDay() // 0=Sun
  return day - 1 // Mon=0 ... Fri=4
}

function toTimeSlot(iso: string): string {
  const d = new Date(iso)
  const h = d.getHours()
  const m = d.getMinutes()
  const roundedM = m < 30 ? 0 : 30
  const endH = roundedM === 30 ? h + 1 : h
  const endM = roundedM === 30 ? 0 : 30
  const fmt = (hh: number, mm: number) => {
    const period = hh < 12 ? 'AM' : 'PM'
    const h12 = hh % 12 === 0 ? 12 : hh % 12
    return mm === 0 ? `${h12}:00 ${period}` : `${h12}:30 ${period}`
  }
  return `${fmt(h, roundedM)} - ${fmt(endH, endM)}`
}

// Map to the 30-min slot labels used in the grid
function toGridSlot(iso: string): string {
  const d = new Date(iso)
  const h = d.getHours()
  const m = d.getMinutes()
  const slotM = m < 30 ? 0 : 30
  const endH = slotM === 0 ? h : h + 1
  const endM = slotM === 0 ? 30 : 0
  const fmt12 = (hh: number, mm: number) => {
    const h12 = hh === 0 ? 12 : hh > 12 ? hh - 12 : hh
    return `${h12}:${mm === 0 ? '00' : '30'}`
  }
  return `${fmt12(h, slotM)} - ${fmt12(endH, endM)}`
}

function isInWeek(isoDate: string, weekStart: string): boolean {
  const d = new Date(isoDate)
  const ws = new Date(weekStart + 'T00:00:00')
  const we = new Date(weekStart + 'T00:00:00')
  we.setDate(we.getDate() + 5)
  return d >= ws && d < we
}

export default function CalendarImport({ userId, weekStart, feeds, onFeedsChange, onImported, onClose }: Props) {
  const [url, setUrl] = useState('')
  const [feedName, setFeedName] = useState('')
  const [fetching, setFetching] = useState(false)
  const [syncing, setSyncing] = useState<string | null>(null)
  const [error, setError] = useState('')
  const [preview, setPreview] = useState<ParsedEvent[] | null>(null)
  const [selectedUids, setSelectedUids] = useState<Set<string>>(new Set())
  const [importing, setImporting] = useState(false)
  const [step, setStep] = useState<'feeds' | 'preview'>('feeds')

  async function fetchPreview() {
    if (!url.trim()) return
    setError('')
    setFetching(true)
    setPreview(null)
    try {
      const res = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/ical-proxy`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${import.meta.env.VITE_SUPABASE_SUPABASE_ANON_KEY}`,
          },
          body: JSON.stringify({ url: url.trim() }),
        }
      )
      const data = await res.json()
      if (!res.ok || data.error) throw new Error(data.error || 'Failed to fetch')
      const thisWeek: ParsedEvent[] = (data.events as ParsedEvent[]).filter(
        e => e.dtstart && isInWeek(e.dtstart, weekStart)
      )
      setPreview(data.events as ParsedEvent[])
      setSelectedUids(new Set(thisWeek.map((e: ParsedEvent) => e.uid)))
      setStep('preview')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to fetch calendar')
    } finally {
      setFetching(false)
    }
  }

  async function importSelected() {
    if (!preview) return
    setImporting(true)
    const toImport = preview.filter(e => selectedUids.has(e.uid))

    // Upsert events by external_uid
    const rows = toImport.map(e => {
      const weekday = e.dtstart ? toWeekday(e.dtstart) : 0
      const slot = e.dtstart ? toGridSlot(e.dtstart) : ''
      return {
        user_id: userId,
        week_start: weekStart,
        day_of_week: Math.max(0, Math.min(4, weekday)),
        time_slot: slot,
        title: e.summary,
        color_category: '' as ColorCategory,
        source: 'imported',
        external_uid: e.uid,
        start_time: e.dtstart,
        end_time: e.dtend,
      }
    })

    // Delete existing imported events for this week to avoid duplicates
    await supabase
      .from('calendar_events')
      .delete()
      .eq('user_id', userId)
      .eq('week_start', weekStart)
      .eq('source', 'imported')
      .in('external_uid', rows.map(r => r.external_uid))

    await supabase.from('calendar_events').insert(rows)

    // Save feed if named
    if (feedName.trim() && url.trim()) {
      const existing = feeds.find(f => f.url === url.trim())
      if (!existing) {
        const { data: newFeed } = await supabase.from('ical_feeds').insert({
          user_id: userId,
          name: feedName.trim() || url.trim(),
          url: url.trim(),
          last_synced_at: new Date().toISOString(),
        }).select().single()
        if (newFeed) onFeedsChange([...feeds, newFeed as ICalFeed])
      } else {
        await supabase.from('ical_feeds').update({ last_synced_at: new Date().toISOString() }).eq('id', existing.id)
      }
    }

    await supabase.from('activity_log').insert({
      user_id: userId,
      action: 'import',
      entity_type: 'calendar_events',
      details: { count: rows.length, week_start: weekStart },
    })

    setImporting(false)
    onImported()
    onClose()
  }

  async function syncFeed(feed: ICalFeed) {
    setSyncing(feed.id)
    setError('')
    try {
      const res = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/ical-proxy`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${import.meta.env.VITE_SUPABASE_SUPABASE_ANON_KEY}`,
          },
          body: JSON.stringify({ url: feed.url }),
        }
      )
      const data = await res.json()
      if (!res.ok || data.error) throw new Error(data.error || 'Sync failed')

      const thisWeek: ParsedEvent[] = (data.events as ParsedEvent[]).filter(
        e => e.dtstart && isInWeek(e.dtstart, weekStart)
      )

      if (thisWeek.length > 0) {
        await supabase
          .from('calendar_events')
          .delete()
          .eq('user_id', userId)
          .eq('week_start', weekStart)
          .eq('source', 'imported')

        await supabase.from('calendar_events').insert(
          thisWeek.map(e => ({
            user_id: userId,
            week_start: weekStart,
            day_of_week: Math.max(0, Math.min(4, e.dtstart ? toWeekday(e.dtstart) : 0)),
            time_slot: e.dtstart ? toGridSlot(e.dtstart) : '',
            title: e.summary,
            color_category: '' as ColorCategory,
            source: 'imported',
            external_uid: e.uid,
            start_time: e.dtstart,
            end_time: e.dtend,
          }))
        )
      }

      await supabase.from('ical_feeds').update({ last_synced_at: new Date().toISOString() }).eq('id', feed.id)
      onFeedsChange(feeds.map(f => f.id === feed.id ? { ...f, last_synced_at: new Date().toISOString() } : f))
      onImported()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Sync failed')
    } finally {
      setSyncing(null)
    }
  }

  async function deleteFeed(id: string) {
    await supabase.from('ical_feeds').delete().eq('id', id)
    onFeedsChange(feeds.filter(f => f.id !== id))
  }

  function toggleUid(uid: string) {
    setSelectedUids(prev => {
      const next = new Set(prev)
      next.has(uid) ? next.delete(uid) : next.add(uid)
      return next
    })
  }

  const thisWeekEvents = preview?.filter(e => e.dtstart && isInWeek(e.dtstart, weekStart)) || []
  const otherEvents = preview?.filter(e => !e.dtstart || !isInWeek(e.dtstart, weekStart)) || []

  return (
    <div className={styles.backdrop} onClick={onClose}>
      <div className={styles.modal} onClick={e => e.stopPropagation()}>
        <div className={styles.header}>
          <div>
            <h2 className={styles.title}>Import Calendar</h2>
            <p className={styles.subtitle}>Connect Google Calendar or Outlook via iCal/ICS link</p>
          </div>
          <button className={styles.closeBtn} onClick={onClose}>×</button>
        </div>

        {step === 'feeds' && (
          <div className={styles.body}>
            {feeds.length > 0 && (
              <div className={styles.section}>
                <h3 className={styles.sectionTitle}>Saved Calendars</h3>
                <ul className={styles.feedList}>
                  {feeds.map(feed => (
                    <li key={feed.id} className={styles.feedItem}>
                      <div className={styles.feedIcon}>
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                          <rect x="3" y="4" width="18" height="18" rx="2"/><line x1="16" y1="2" x2="16" y2="6"/>
                          <line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/>
                        </svg>
                      </div>
                      <div className={styles.feedInfo}>
                        <span className={styles.feedName}>{feed.name}</span>
                        <span className={styles.feedUrl}>{feed.url.length > 50 ? feed.url.slice(0, 50) + '…' : feed.url}</span>
                        {feed.last_synced_at && (
                          <span className={styles.feedSynced}>
                            Last synced {new Date(feed.last_synced_at).toLocaleDateString()}
                          </span>
                        )}
                      </div>
                      <div className={styles.feedActions}>
                        <button
                          className={styles.syncBtn}
                          onClick={() => syncFeed(feed)}
                          disabled={syncing === feed.id}
                        >
                          {syncing === feed.id ? 'Syncing...' : 'Sync'}
                        </button>
                        <button className={styles.deleteFeedBtn} onClick={() => deleteFeed(feed.id)}>×</button>
                      </div>
                    </li>
                  ))}
                </ul>
              </div>
            )}

            <div className={styles.section}>
              <h3 className={styles.sectionTitle}>Add Calendar URL</h3>
              <div className={styles.helpCards}>
                <div className={styles.helpCard}>
                  <strong>Google Calendar</strong>
                  <p>Open calendar settings → "Integrate calendar" → copy the "Secret address in iCal format" link</p>
                </div>
                <div className={styles.helpCard}>
                  <strong>Outlook / Microsoft 365</strong>
                  <p>Go to calendar settings → "Shared calendars" → publish and copy the ICS link</p>
                </div>
              </div>
              <label className={styles.label}>Calendar Name</label>
              <input
                className={styles.input}
                value={feedName}
                onChange={e => setFeedName(e.target.value)}
                placeholder="e.g. Work Calendar"
              />
              <label className={styles.label}>iCal / ICS URL</label>
              <input
                className={styles.input}
                value={url}
                onChange={e => setUrl(e.target.value)}
                placeholder="https://calendar.google.com/calendar/ical/..."
              />
              {error && <p className={styles.error}>{error}</p>}
            </div>
          </div>
        )}

        {step === 'preview' && preview && (
          <div className={styles.body}>
            <button className={styles.backBtn} onClick={() => setStep('feeds')}>← Back</button>
            <p className={styles.previewNote}>
              Found <strong>{preview.length}</strong> total events.{' '}
              <strong>{thisWeekEvents.length}</strong> are in the current week — pre-selected below.
            </p>

            {thisWeekEvents.length > 0 && (
              <div className={styles.section}>
                <div className={styles.sectionTitleRow}>
                  <h3 className={styles.sectionTitle}>This Week</h3>
                  <div className={styles.selectBtns}>
                    <button className={styles.linkBtn} onClick={() => setSelectedUids(new Set(thisWeekEvents.map(e => e.uid)))}>All</button>
                    <button className={styles.linkBtn} onClick={() => setSelectedUids(new Set())}>None</button>
                  </div>
                </div>
                <ul className={styles.previewList}>
                  {thisWeekEvents.map(e => (
                    <li
                      key={e.uid}
                      className={`${styles.previewItem} ${selectedUids.has(e.uid) ? styles.previewSelected : ''}`}
                      onClick={() => toggleUid(e.uid)}
                    >
                      <input
                        type="checkbox"
                        checked={selectedUids.has(e.uid)}
                        onChange={() => toggleUid(e.uid)}
                        onClick={ev => ev.stopPropagation()}
                        className={styles.checkbox}
                      />
                      <div>
                        <span className={styles.previewTitle}>{e.summary}</span>
                        {e.dtstart && (
                          <span className={styles.previewDate}>
                            {new Date(e.dtstart).toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })}
                            {' · '}
                            {new Date(e.dtstart).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })}
                            {e.dtend && ` – ${new Date(e.dtend).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })}`}
                          </span>
                        )}
                      </div>
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {otherEvents.length > 0 && (
              <div className={styles.section}>
                <h3 className={`${styles.sectionTitle} ${styles.dimmed}`}>Outside This Week ({otherEvents.length})</h3>
                <p className={styles.dimText}>These events are from other weeks and won't be imported.</p>
              </div>
            )}
          </div>
        )}

        <div className={styles.footer}>
          {step === 'feeds' ? (
            <>
              <button className={styles.cancelBtn} onClick={onClose}>Cancel</button>
              <button
                className={styles.primaryBtn}
                onClick={fetchPreview}
                disabled={fetching || !url.trim()}
              >
                {fetching ? 'Fetching...' : 'Preview Events'}
              </button>
            </>
          ) : (
            <>
              <button className={styles.cancelBtn} onClick={() => setStep('feeds')}>Back</button>
              <button
                className={styles.primaryBtn}
                onClick={importSelected}
                disabled={importing || selectedUids.size === 0}
              >
                {importing ? 'Importing...' : `Import ${selectedUids.size} Event${selectedUids.size !== 1 ? 's' : ''}`}
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  )
}

// Suppress unused import warning
const _toTimeSlot = toTimeSlot
void _toTimeSlot
