import { useEffect, useState, useCallback } from 'react'
import { supabase } from '../supabase'
import { formatWeekLabel, currentWeekMonday, addWeeks } from '../utils/weekUtils'
import { exportWeekCsv, exportWeekPdf } from '../utils/weekExport'
import styles from './SettingsTab.module.css'

interface Prefs {
  priority_color: string
  priority_outline_color: string
}

const DEFAULT_PREFS: Prefs = {
  priority_color: '#f59e0b',
  priority_outline_color: '#f59e0b',
}

const PRESET_COLORS = [
  '#f59e0b', // amber (default)
  '#ef4444', // red
  '#22c55e', // green
  '#3b82f6', // blue
  '#ec4899', // pink
  '#8b5cf6', // violet (only preset allowed)
  '#f97316', // orange
  '#14b8a6', // teal
  '#6366f1', // indigo (only preset allowed)
]

interface Props {
  userId: string
  onPrefsChange: (prefs: Prefs) => void
}

export default function SettingsTab({ userId, onPrefsChange }: Props) {
  const [prefs, setPrefs] = useState<Prefs>(DEFAULT_PREFS)
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const [exportWeek, setExportWeek] = useState(currentWeekMonday())
  const [exporting, setExporting] = useState<'csv' | 'pdf' | null>(null)

  const load = useCallback(async () => {
    const { data } = await supabase
      .from('user_preferences')
      .select('priority_color, priority_outline_color')
      .eq('user_id', userId)
      .maybeSingle()
    if (data) {
      setPrefs(data as Prefs)
      onPrefsChange(data as Prefs)
    }
  }, [userId, onPrefsChange])

  useEffect(() => { load() }, [load])

  async function savePrefs(next: Prefs) {
    setSaving(true)
    setSaved(false)
    await supabase.from('user_preferences').upsert(
      { user_id: userId, ...next, updated_at: new Date().toISOString() },
      { onConflict: 'user_id' }
    )
    onPrefsChange(next)
    setSaving(false)
    setSaved(true)
    setTimeout(() => setSaved(false), 2000)
  }

  function updateColor(field: keyof Prefs, value: string) {
    const next = { ...prefs, [field]: value }
    setPrefs(next)
  }

  async function handleDownloadCsv() {
    setExporting('csv')
    await exportWeekCsv(userId, exportWeek)
    setExporting(null)
  }

  async function handleDownloadPdf() {
    setExporting('pdf')
    await exportWeekPdf(userId, exportWeek, prefs.priority_color)
    setExporting(null)
  }

  return (
    <div className={styles.container}>
      <div className={styles.grid}>

        {/* Priority Color Settings */}
        <section className={styles.card}>
          <div className={styles.cardHeader}>
            <div className={styles.cardIconWrap}>
              <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor">
                <path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z"/>
              </svg>
            </div>
            <div>
              <h2 className={styles.cardTitle}>Priority Event Colors</h2>
              <p className={styles.cardDesc}>Customize how priority-flagged calendar events appear.</p>
            </div>
          </div>

          <div className={styles.cardBody}>
            <div className={styles.previewRow}>
              <div
                className={styles.previewChip}
                style={{
                  background: '#fef3c7',
                  color: '#78350f',
                  borderLeft: `3px solid #f59e0b`,
                  outline: `2px solid ${prefs.priority_outline_color}`,
                  outlineOffset: '-2px',
                }}
              >
                <span style={{ color: prefs.priority_color, fontSize: 13 }}>★</span>
                Sample Priority Event
              </div>
              <div
                className={styles.previewChip}
                style={{
                  background: '#dbeafe',
                  color: '#1e3a8a',
                  borderLeft: `3px solid #3b82f6`,
                  outline: `2px solid ${prefs.priority_outline_color}`,
                  outlineOffset: '-2px',
                }}
              >
                <span style={{ color: prefs.priority_color, fontSize: 13 }}>★</span>
                Another Flagged Event
              </div>
            </div>

            <div className={styles.colorGroup}>
              <div className={styles.colorField}>
                <label className={styles.label}>Star & Highlight Color</label>
                <p className={styles.labelDesc}>Color of the ★ star and event outline when flagged as priority.</p>
                <div className={styles.colorRow}>
                  <div className={styles.presets}>
                    {PRESET_COLORS.map(c => (
                      <button
                        key={c}
                        className={`${styles.preset} ${prefs.priority_color === c ? styles.presetActive : ''}`}
                        style={{ background: c }}
                        onClick={() => updateColor('priority_color', c)}
                        title={c}
                      />
                    ))}
                  </div>
                  <label className={styles.customColorLabel}>
                    <input
                      type="color"
                      value={prefs.priority_color}
                      onChange={e => updateColor('priority_color', e.target.value)}
                      className={styles.colorInput}
                    />
                    <span className={styles.customColorText}>Custom</span>
                  </label>
                </div>
              </div>

              <div className={styles.colorField}>
                <label className={styles.label}>Outline Color</label>
                <p className={styles.labelDesc}>Border outline drawn around priority event chips.</p>
                <div className={styles.colorRow}>
                  <div className={styles.presets}>
                    {PRESET_COLORS.map(c => (
                      <button
                        key={c}
                        className={`${styles.preset} ${prefs.priority_outline_color === c ? styles.presetActive : ''}`}
                        style={{ background: c }}
                        onClick={() => updateColor('priority_outline_color', c)}
                        title={c}
                      />
                    ))}
                  </div>
                  <label className={styles.customColorLabel}>
                    <input
                      type="color"
                      value={prefs.priority_outline_color}
                      onChange={e => updateColor('priority_outline_color', e.target.value)}
                      className={styles.colorInput}
                    />
                    <span className={styles.customColorText}>Custom</span>
                  </label>
                </div>
              </div>
            </div>

            <div className={styles.saveRow}>
              <button
                className={styles.saveBtn}
                onClick={() => savePrefs(prefs)}
                disabled={saving}
              >
                {saving ? 'Saving...' : 'Save Color Settings'}
              </button>
              {saved && <span className={styles.savedMsg}>Saved!</span>}
            </div>
          </div>
        </section>

        {/* Download Week at a Glance */}
        <section className={styles.card}>
          <div className={styles.cardHeader}>
            <div className={styles.cardIconWrap}>
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/>
                <polyline points="7 10 12 15 17 10"/>
                <line x1="12" y1="15" x2="12" y2="3"/>
              </svg>
            </div>
            <div>
              <h2 className={styles.cardTitle}>Download Week at a Glance</h2>
              <p className={styles.cardDesc}>Export any week's calendar and priorities as a CSV or printable PDF.</p>
            </div>
          </div>

          <div className={styles.cardBody}>
            <div className={styles.weekPickerRow}>
              <label className={styles.label}>Select Week</label>
              <div className={styles.weekPicker}>
                <button
                  className={styles.weekNavBtn}
                  onClick={() => setExportWeek(w => addWeeks(w, -1))}
                >
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                    <polyline points="15 18 9 12 15 6"/>
                  </svg>
                </button>
                <span className={styles.weekPickerLabel}>{formatWeekLabel(exportWeek)}</span>
                <button
                  className={styles.weekNavBtn}
                  onClick={() => setExportWeek(w => addWeeks(w, 1))}
                >
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                    <polyline points="9 18 15 12 9 6"/>
                  </svg>
                </button>
                {exportWeek !== currentWeekMonday() && (
                  <button className={styles.todayLink} onClick={() => setExportWeek(currentWeekMonday())}>
                    This week
                  </button>
                )}
              </div>
            </div>

            <div className={styles.downloadOptions}>
              <div className={styles.downloadOption}>
                <div className={styles.downloadOptionInfo}>
                  <div className={styles.downloadOptionIcon}>
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
                      <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/>
                      <polyline points="14 2 14 8 20 8"/>
                      <line x1="16" y1="13" x2="8" y2="13"/>
                      <line x1="16" y1="17" x2="8" y2="17"/>
                      <polyline points="10 9 9 9 8 9"/>
                    </svg>
                  </div>
                  <div>
                    <p className={styles.downloadOptionTitle}>CSV Spreadsheet</p>
                    <p className={styles.downloadOptionDesc}>Time slots × days grid with priorities list. Opens in Excel or Google Sheets.</p>
                  </div>
                </div>
                <button
                  className={`${styles.downloadBtn} ${styles.downloadBtnCsv}`}
                  onClick={handleDownloadCsv}
                  disabled={exporting !== null}
                >
                  {exporting === 'csv' ? 'Exporting...' : 'Download CSV'}
                </button>
              </div>

              <div className={styles.downloadOption}>
                <div className={styles.downloadOptionInfo}>
                  <div className={styles.downloadOptionIcon}>
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
                      <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/>
                      <polyline points="14 2 14 8 20 8"/>
                      <rect x="8" y="12" width="8" height="6"/>
                    </svg>
                  </div>
                  <div>
                    <p className={styles.downloadOptionTitle}>PDF / Print</p>
                    <p className={styles.downloadOptionDesc}>Full-color printable layout with category colors, priorities, and legend. Opens print dialog.</p>
                  </div>
                </div>
                <button
                  className={`${styles.downloadBtn} ${styles.downloadBtnPdf}`}
                  onClick={handleDownloadPdf}
                  disabled={exporting !== null}
                >
                  {exporting === 'pdf' ? 'Preparing...' : 'Download PDF'}
                </button>
              </div>
            </div>
          </div>
        </section>

      </div>
    </div>
  )
}
