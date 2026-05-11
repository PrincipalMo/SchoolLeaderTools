import { useEffect, useState, useCallback } from 'react'
import { supabase, CalendarEvent, WeeklyPriority, DelegatedTask } from '../supabase'
import { TIME_SLOTS } from '../seedData'
import styles from './DelegateView.module.css'

const DAYS = ['Monday 5/4', 'Tuesday 5/5', 'Wednesday 5/6', 'Thursday 5/7', 'Friday 5/8']
const DAY_SHORT = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri']

const STATUS_LABELS: Record<string, string> = {
  pending: 'Pending',
  in_progress: 'In Progress',
  completed: 'Completed',
}
const STATUS_CYCLE: DelegatedTask['status'][] = ['pending', 'in_progress', 'completed']

interface TokenInfo {
  id: string
  leader_id: string
  owner_user_id: string
}

interface Leader {
  id: string
  name: string
  role: string
  email: string
}

interface TaskComment {
  id: string
  task_id: string
  leader_id: string
  author_type: string
  comment: string
  progress_status: string | null
  created_at: string
}

function categoryStyle(cat: string): React.CSSProperties {
  const map: Record<string, { bg: string; color: string; border: string }> = {
    'check-ins':        { bg: '#dcfce7', color: '#14532d', border: '#22c55e' },
    admin:              { bg: '#dbeafe', color: '#1e3a8a', border: '#3b82f6' },
    instruction:        { bg: '#fef3c7', color: '#78350f', border: '#f59e0b' },
    'family-engagement':{ bg: '#fce7f3', color: '#831843', border: '#ec4899' },
    supervision:        { bg: '#e0e7ff', color: '#312e81', border: '#6366f1' },
    'out-of-building':  { bg: '#ffedd5', color: '#7c2d12', border: '#f97316' },
    discipline:         { bg: '#fee2e2', color: '#7f1d1d', border: '#ef4444' },
    climate:            { bg: '#ccfbf1', color: '#134e4a', border: '#14b8a6' },
    personal:           { bg: '#fef9c3', color: '#713f12', border: '#a16207' },
  }
  const c = map[cat]
  if (!c) return { background: '#f3f4f6', color: '#374151', borderLeft: '3px solid #9ca3af' }
  return { background: c.bg, color: c.color, borderLeft: `3px solid ${c.border}` }
}

interface Props {
  token: string
}

export default function DelegateView({ token }: Props) {
  const [tokenInfo, setTokenInfo] = useState<TokenInfo | null>(null)
  const [leader, setLeader] = useState<Leader | null>(null)
  const [events, setEvents] = useState<CalendarEvent[]>([])
  const [priorities, setPriorities] = useState<WeeklyPriority[]>([])
  const [tasks, setTasks] = useState<DelegatedTask[]>([])
  const [comments, setComments] = useState<TaskComment[]>([])
  const [loading, setLoading] = useState(true)
  const [invalid, setInvalid] = useState(false)
  const [activeView, setActiveView] = useState<'calendar' | 'tasks'>('tasks')
  const [expandedTask, setExpandedTask] = useState<string | null>(null)
  const [newComment, setNewComment] = useState<Record<string, string>>({})
  const [newStatus, setNewStatus] = useState<Record<string, string>>({})
  const [submitting, setSubmitting] = useState<string | null>(null)
  const [submitted, setSubmitted] = useState<string | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    // Look up token
    const { data: tkData, error: tkErr } = await supabase
      .from('delegate_tokens')
      .select('id, leader_id, owner_user_id')
      .eq('token', token)
      .maybeSingle()

    if (tkErr || !tkData) {
      setInvalid(true)
      setLoading(false)
      return
    }

    const tk = tkData as TokenInfo
    setTokenInfo(tk)

    const [leaderRes, evRes, prRes, taskRes, commentRes] = await Promise.all([
      supabase.from('leaders').select('*').eq('id', tk.leader_id).maybeSingle(),
      supabase.from('calendar_events').select('*').eq('user_id', tk.owner_user_id).eq('week_start', '2026-05-04'),
      supabase.from('weekly_priorities').select('*').eq('user_id', tk.owner_user_id).eq('week_start', '2026-05-04').order('sort_order'),
      supabase.from('delegated_tasks').select('*').eq('leader_id', tk.leader_id).order('created_at'),
      supabase.from('task_comments').select('*').eq('leader_id', tk.leader_id).order('created_at', { ascending: true }),
    ])

    if (leaderRes.data) setLeader(leaderRes.data as Leader)
    if (evRes.data) setEvents(evRes.data as CalendarEvent[])
    if (prRes.data) setPriorities(prRes.data as WeeklyPriority[])
    if (taskRes.data) setTasks(taskRes.data as DelegatedTask[])
    if (commentRes.data) setComments(commentRes.data as TaskComment[])
    setLoading(false)
  }, [token])

  useEffect(() => { load() }, [load])

  async function submitUpdate(task: DelegatedTask) {
    const comment = newComment[task.id] || ''
    const status = (newStatus[task.id] as DelegatedTask['status']) || task.status
    if (!comment.trim()) return

    setSubmitting(task.id)

    // Update task status if changed
    if (status !== task.status) {
      await supabase.from('delegated_tasks').update({ status }).eq('id', task.id)
      setTasks(prev => prev.map(t => t.id === task.id ? { ...t, status } : t))
    }

    // Insert comment
    const { data } = await supabase.from('task_comments').insert({
      task_id: task.id,
      leader_id: task.leader_id,
      author_type: 'delegate',
      comment: comment.trim(),
      progress_status: status !== task.status ? status : null,
    }).select().single()

    if (data) setComments(prev => [...prev, data as TaskComment])
    setNewComment(prev => ({ ...prev, [task.id]: '' }))
    setSubmitting(null)
    setSubmitted(task.id)
    setTimeout(() => setSubmitted(null), 3000)
  }

  const getEventsForCell = (day: number, slot: string) =>
    events.filter(e => e.day_of_week === day && e.time_slot === slot)

  const commentsForTask = (taskId: string) => comments.filter(c => c.task_id === taskId)

  if (loading) return (
    <div className={styles.splash}>
      <div className={styles.splashIcon}>W</div>
      <div className={styles.spinner} />
      <p>Loading your tasks...</p>
    </div>
  )

  if (invalid || !tokenInfo) return (
    <div className={styles.splash}>
      <div className={styles.splashIcon}>!</div>
      <h2>Invalid or expired link</h2>
      <p>This delegation link is not valid. Please contact your administrator for a new link.</p>
    </div>
  )

  return (
    <div className={styles.page}>
      <header className={styles.header}>
        <div className={styles.headerContent}>
          <div className={styles.brand}>
            <div className={styles.brandIcon}>W</div>
            <div>
              <h1 className={styles.title}>Week at a Glance</h1>
              <p className={styles.subtitle}>Delegate View — Read Only</p>
            </div>
          </div>
          {leader && (
            <div className={styles.leaderBadge}>
              <div className={styles.leaderAvatar}>{leader.name.charAt(0)}</div>
              <div>
                <span className={styles.leaderName}>{leader.name}</span>
                {leader.role && <span className={styles.leaderRole}>{leader.role}</span>}
              </div>
            </div>
          )}
        </div>
        <nav className={styles.nav}>
          <div className={styles.navInner}>
            <button
              className={`${styles.navTab} ${activeView === 'tasks' ? styles.navTabActive : ''}`}
              onClick={() => setActiveView('tasks')}
            >
              My Tasks
              <span className={styles.navBadge}>{tasks.length}</span>
            </button>
            <button
              className={`${styles.navTab} ${activeView === 'calendar' ? styles.navTabActive : ''}`}
              onClick={() => setActiveView('calendar')}
            >
              Week at a Glance
            </button>
          </div>
        </nav>
      </header>

      <main className={styles.main}>
        {activeView === 'tasks' && (
          <div className={styles.tasksView}>
            <div className={styles.tasksHeader}>
              <h2>Your Assigned Tasks</h2>
              <p>Week of May 4–8, 2026 · Click a task to report progress or leave a comment.</p>
            </div>

            {tasks.length === 0 ? (
              <div className={styles.emptyTasks}>
                <p>No tasks have been assigned to you yet.</p>
              </div>
            ) : (
              <div className={styles.taskCards}>
                {tasks.map(task => {
                  const tc = commentsForTask(task.id)
                  const isExpanded = expandedTask === task.id
                  const currentStatus = (newStatus[task.id] as DelegatedTask['status']) || task.status
                  return (
                    <div
                      key={task.id}
                      className={`${styles.taskCard} ${styles[`task_${task.status}`]}`}
                    >
                      <div className={styles.taskCardHeader} onClick={() => setExpandedTask(isExpanded ? null : task.id)}>
                        <div className={styles.taskCardLeft}>
                          <span className={`${styles.statusPill} ${styles[`pill_${task.status}`]}`}>
                            {STATUS_LABELS[task.status]}
                          </span>
                          <h3 className={styles.taskTitle}>{task.title}</h3>
                        </div>
                        <div className={styles.taskCardRight}>
                          {tc.length > 0 && (
                            <span className={styles.commentBadge}>
                              {tc.length} update{tc.length !== 1 ? 's' : ''}
                            </span>
                          )}
                          {task.due_date && (
                            <span className={styles.dueDate}>
                              Due {new Date(task.due_date + 'T00:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                            </span>
                          )}
                          <svg
                            className={`${styles.chevron} ${isExpanded ? styles.chevronOpen : ''}`}
                            width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"
                          >
                            <polyline points="6 9 12 15 18 9"/>
                          </svg>
                        </div>
                      </div>

                      {task.description && !isExpanded && (
                        <p className={styles.taskDesc}>{task.description}</p>
                      )}

                      {isExpanded && (
                        <div className={styles.taskExpanded}>
                          {task.description && (
                            <div className={styles.taskNotes}>
                              <strong>Notes:</strong> {task.description}
                            </div>
                          )}

                          {tc.length > 0 && (
                            <div className={styles.commentThread}>
                              <p className={styles.threadLabel}>Updates</p>
                              {tc.map(c => (
                                <div key={c.id} className={`${styles.commentBubble} ${c.author_type === 'delegate' ? styles.bubbleDelegate : styles.bubbleAdmin}`}>
                                  <div className={styles.bubbleMeta}>
                                    <strong>{c.author_type === 'delegate' ? 'You' : 'Admin'}</strong>
                                    {c.progress_status && (
                                      <span className={`${styles.statusPill} ${styles[`pill_${c.progress_status}`]}`} style={{ fontSize: '10px', padding: '2px 8px' }}>
                                        {STATUS_LABELS[c.progress_status] || c.progress_status}
                                      </span>
                                    )}
                                    <span className={styles.bubbleTime}>
                                      {new Date(c.created_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' })}
                                    </span>
                                  </div>
                                  <p className={styles.bubbleText}>{c.comment}</p>
                                </div>
                              ))}
                            </div>
                          )}

                          <div className={styles.updateForm}>
                            <p className={styles.updateLabel}>Report Progress</p>
                            <div className={styles.statusRow}>
                              <span className={styles.updateFieldLabel}>Update status:</span>
                              <div className={styles.statusOptions}>
                                {STATUS_CYCLE.map(s => (
                                  <button
                                    key={s}
                                    className={`${styles.statusOpt} ${currentStatus === s ? styles[`pill_${s}`] : styles.statusOptGhost}`}
                                    onClick={() => setNewStatus(prev => ({ ...prev, [task.id]: s }))}
                                  >
                                    {STATUS_LABELS[s]}
                                  </button>
                                ))}
                              </div>
                            </div>
                            <textarea
                              className={styles.updateTextarea}
                              placeholder="Describe your progress, blockers, or questions..."
                              value={newComment[task.id] || ''}
                              onChange={e => setNewComment(prev => ({ ...prev, [task.id]: e.target.value }))}
                              rows={3}
                            />
                            <div className={styles.updateFooter}>
                              {submitted === task.id && (
                                <span className={styles.submittedMsg}>Update sent!</span>
                              )}
                              <button
                                className={styles.submitBtn}
                                onClick={() => submitUpdate(task)}
                                disabled={submitting === task.id || !(newComment[task.id] || '').trim()}
                              >
                                {submitting === task.id ? 'Submitting...' : 'Submit Update'}
                              </button>
                            </div>
                          </div>
                        </div>
                      )}
                    </div>
                  )
                })}
              </div>
            )}
          </div>
        )}

        {activeView === 'calendar' && (
          <div className={styles.calendarView}>
            <div className={styles.calendarLayout}>
              <div className={styles.calendarWrap}>
                <p className={styles.readOnlyNote}>
                  Read-only view — May 4–8, 2026
                </p>
                <div className={styles.calendarHeader}>
                  <div className={styles.timeColHeader} />
                  {DAYS.map((d, i) => (
                    <div key={i} className={styles.dayHeader}>
                      <span className={styles.dayFull}>{d}</span>
                      <span className={styles.dayShort}>{DAY_SHORT[i]}</span>
                    </div>
                  ))}
                </div>
                <div>
                  {TIME_SLOTS.map(slot => (
                    <div key={slot} className={styles.row}>
                      <div className={styles.timeCell}>{slot}</div>
                      {[0, 1, 2, 3, 4].map(day => {
                        const cellEvents = getEventsForCell(day, slot)
                        return (
                          <div key={day} className={styles.cell}>
                            {cellEvents.map(ev => (
                              <div
                                key={ev.id}
                                className={styles.eventChip}
                                style={categoryStyle(ev.color_category)}
                              >
                                {ev.title}
                              </div>
                            ))}
                          </div>
                        )
                      })}
                    </div>
                  ))}
                </div>
              </div>

              <aside className={styles.sidebar}>
                <div className={styles.sidebarHeader}>
                  <h3>Priorities for Week</h3>
                </div>
                {priorities.length === 0 ? (
                  <p className={styles.noPriorities}>No priorities set.</p>
                ) : (
                  <ul className={styles.priorityList}>
                    {priorities.map(p => (
                      <li key={p.id} className={styles.priorityItem}>
                        <span className={`${styles.statusBadge} ${p.status === 'IP' ? styles.badgeIP : p.status === 'C' ? styles.badgeC : styles.badgeNone}`}>
                          {p.status || '—'}
                        </span>
                        <span className={styles.priorityText}>{p.title}</span>
                      </li>
                    ))}
                  </ul>
                )}
              </aside>
            </div>
          </div>
        )}
      </main>
    </div>
  )
}
