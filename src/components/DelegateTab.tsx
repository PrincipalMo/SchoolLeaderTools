import { useEffect, useState, useCallback } from 'react'
import { supabase, Leader, DelegatedTask } from '../supabase'
import EmailPreviewModal from './EmailPreviewModal'
import styles from './DelegateTab.module.css'

const STATUS_LABELS: Record<string, string> = {
  pending: 'Pending',
  in_progress: 'In Progress',
  completed: 'Completed',
}

const STATUS_CYCLE: DelegatedTask['status'][] = ['pending', 'in_progress', 'completed']

interface TaskComment {
  id: string
  task_id: string
  leader_id: string
  author_type: string
  comment: string
  progress_status: string | null
  created_at: string
}

interface TaskForm {
  leaderId: string
  title: string
  description: string
  dueDate: string
  status: DelegatedTask['status']
}

interface LeaderForm {
  name: string
  role: string
  email: string
}

const emptyForm = (leaderId = ''): TaskForm => ({
  leaderId,
  title: '',
  description: '',
  dueDate: '',
  status: 'pending',
})

const emptyLeaderForm = (): LeaderForm => ({ name: '', role: '', email: '' })

interface Props {
  userId: string
}

export default function DelegateTab({ userId }: Props) {
  const [leaders, setLeaders] = useState<Leader[]>([])
  const [tasks, setTasks] = useState<DelegatedTask[]>([])
  const [comments, setComments] = useState<TaskComment[]>([])
  const [loading, setLoading] = useState(true)
  const [showAddTask, setShowAddTask] = useState(false)
  const [taskForm, setTaskForm] = useState<TaskForm>(emptyForm())
  const [editingTask, setEditingTask] = useState<DelegatedTask | null>(null)
  const [showAddLeader, setShowAddLeader] = useState(false)
  const [leaderForm, setLeaderForm] = useState<LeaderForm>(emptyLeaderForm())
  const [editingLeader, setEditingLeader] = useState<Leader | null>(null)
  const [saving, setSaving] = useState(false)
  const [filterLeader, setFilterLeader] = useState<string>('all')
  const [sendingEmail, setSendingEmail] = useState<string | null>(null)
  const [emailResult, setEmailResult] = useState<{ leaderId: string; url: string; sent: boolean } | null>(null)
  const [expandedTask, setExpandedTask] = useState<string | null>(null)
  const [newComment, setNewComment] = useState('')
  const [addingComment, setAddingComment] = useState(false)
  const [previewLeader, setPreviewLeader] = useState<(Leader & { email?: string }) | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    const [lRes, tRes, cRes] = await Promise.all([
      supabase.from('leaders').select('*').eq('user_id', userId).order('name'),
      supabase.from('delegated_tasks').select('*').eq('user_id', userId).order('created_at', { ascending: false }),
      supabase.from('task_comments').select('*').order('created_at', { ascending: true }),
    ])
    if (lRes.data) setLeaders(lRes.data as Leader[])
    if (tRes.data) setTasks(tRes.data as DelegatedTask[])
    if (cRes.data) setComments(cRes.data as TaskComment[])
    setLoading(false)
  }, [userId])

  useEffect(() => { load() }, [load])

  async function saveTask() {
    if (!taskForm.title.trim() || !taskForm.leaderId) return
    setSaving(true)
    const payload = {
      user_id: userId,
      leader_id: taskForm.leaderId,
      title: taskForm.title.trim(),
      description: taskForm.description.trim(),
      due_date: taskForm.dueDate || null,
      status: taskForm.status,
    }
    if (editingTask) {
      await supabase.from('delegated_tasks').update(payload).eq('id', editingTask.id)
    } else {
      await supabase.from('delegated_tasks').insert(payload)
    }
    setSaving(false)
    setShowAddTask(false)
    setEditingTask(null)
    setTaskForm(emptyForm())
    load()
  }

  async function cycleStatus(task: DelegatedTask) {
    const next = STATUS_CYCLE[(STATUS_CYCLE.indexOf(task.status) + 1) % STATUS_CYCLE.length]
    await supabase.from('delegated_tasks').update({ status: next }).eq('id', task.id)
    setTasks(prev => prev.map(t => t.id === task.id ? { ...t, status: next } : t))
  }

  async function deleteTask(id: string) {
    await supabase.from('delegated_tasks').delete().eq('id', id)
    setTasks(prev => prev.filter(t => t.id !== id))
    if (expandedTask === id) setExpandedTask(null)
  }

  async function saveLeader() {
    if (!leaderForm.name.trim()) return
    setSaving(true)
    if (editingLeader) {
      const { data } = await supabase.from('leaders').update({
        name: leaderForm.name.trim(),
        role: leaderForm.role.trim(),
        email: leaderForm.email.trim(),
      }).eq('id', editingLeader.id).select().single()
      if (data) setLeaders(prev => prev.map(l => l.id === editingLeader.id ? data as Leader : l))
    } else {
      const { data } = await supabase.from('leaders').insert({
        user_id: userId,
        name: leaderForm.name.trim(),
        role: leaderForm.role.trim(),
        email: leaderForm.email.trim(),
      }).select().single()
      if (data) setLeaders(prev => [...prev, data as Leader])
    }
    setSaving(false)
    setShowAddLeader(false)
    setEditingLeader(null)
    setLeaderForm(emptyLeaderForm())
  }

  function openEditLeader(leader: Leader) {
    setEditingLeader(leader)
    setLeaderForm({ name: leader.name, role: leader.role, email: (leader as Leader & { email?: string }).email || '' })
    setShowAddLeader(true)
  }

  async function deleteLeader(id: string) {
    if (!confirm('Delete this leader and all their tasks?')) return
    await supabase.from('leaders').delete().eq('id', id)
    setLeaders(prev => prev.filter(l => l.id !== id))
    setTasks(prev => prev.filter(t => t.leader_id !== id))
  }

  async function sendDelegationEmail(leader: Leader) {
    if (!(leader as Leader & { email?: string }).email) {
      alert('Please add an email address to this leader first.')
      openEditLeader(leader)
      return
    }
    setSendingEmail(leader.id)
    setEmailResult(null)
    try {
      const { data: { session } } = await supabase.auth.getSession()
      const res = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/send-delegation`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${session?.access_token}`,
          },
          body: JSON.stringify({
            leaderId: leader.id,
            weekStart: 'May 4–8, 2026',
            appUrl: window.location.origin,
          }),
        }
      )
      const data = await res.json()
      if (data.delegateUrl) {
        setEmailResult({ leaderId: leader.id, url: data.delegateUrl, sent: data.emailSent === true })
      } else {
        alert('Failed to generate delegate link: ' + (data.error || 'Unknown error'))
      }
    } catch (err) {
      alert('Error: ' + String(err))
    } finally {
      setSendingEmail(null)
    }
  }

  async function addComment(taskId: string, leaderId: string) {
    if (!newComment.trim()) return
    setAddingComment(true)
    const { data } = await supabase.from('task_comments').insert({
      task_id: taskId,
      leader_id: leaderId,
      author_type: 'admin',
      comment: newComment.trim(),
    }).select().single()
    if (data) setComments(prev => [...prev, data as TaskComment])
    setNewComment('')
    setAddingComment(false)
  }

  function openEdit(task: DelegatedTask) {
    setEditingTask(task)
    setTaskForm({
      leaderId: task.leader_id,
      title: task.title,
      description: task.description,
      dueDate: task.due_date || '',
      status: task.status,
    })
    setShowAddTask(true)
  }

  const visibleTasks = filterLeader === 'all'
    ? tasks
    : tasks.filter(t => t.leader_id === filterLeader)

  const tasksByLeader = (leaderId: string) => visibleTasks.filter(t => t.leader_id === leaderId)
  const commentsForTask = (taskId: string) => comments.filter(c => c.task_id === taskId)

  const stats = {
    total: visibleTasks.length,
    pending: visibleTasks.filter(t => t.status === 'pending').length,
    inProgress: visibleTasks.filter(t => t.status === 'in_progress').length,
    completed: visibleTasks.filter(t => t.status === 'completed').length,
  }

  if (loading) return (
    <div className={styles.loading}>
      <div className={styles.spinner} />
      <span>Loading...</span>
    </div>
  )

  return (
    <div className={styles.container}>
      {/* Top bar */}
      <div className={styles.topBar}>
        <div className={styles.stats}>
          <div className={styles.stat}>
            <span className={styles.statNum}>{stats.total}</span>
            <span className={styles.statLabel}>Total</span>
          </div>
          <div className={`${styles.stat} ${styles.statPending}`}>
            <span className={styles.statNum}>{stats.pending}</span>
            <span className={styles.statLabel}>Pending</span>
          </div>
          <div className={`${styles.stat} ${styles.statProgress}`}>
            <span className={styles.statNum}>{stats.inProgress}</span>
            <span className={styles.statLabel}>In Progress</span>
          </div>
          <div className={`${styles.stat} ${styles.statDone}`}>
            <span className={styles.statNum}>{stats.completed}</span>
            <span className={styles.statLabel}>Completed</span>
          </div>
        </div>
        <div className={styles.actions}>
          <select
            className={styles.filterSelect}
            value={filterLeader}
            onChange={e => setFilterLeader(e.target.value)}
          >
            <option value="all">All Leaders</option>
            {leaders.map(l => (
              <option key={l.id} value={l.id}>{l.name}</option>
            ))}
          </select>
          <button className={styles.btnSecondary} onClick={() => { setEditingLeader(null); setLeaderForm(emptyLeaderForm()); setShowAddLeader(true) }}>
            + Add Leader
          </button>
          <button className={styles.btnPrimary} onClick={() => { setEditingTask(null); setTaskForm(emptyForm()); setShowAddTask(true) }}>
            + Delegate Task
          </button>
        </div>
      </div>

      {/* Board */}
      <div className={styles.board}>
        {leaders
          .filter(l => filterLeader === 'all' || l.id === filterLeader)
          .map(leader => {
            const leaderWithEmail = leader as Leader & { email?: string }
            const ltasks = tasksByLeader(leader.id)
            const done = ltasks.filter(t => t.status === 'completed').length
            const isSending = sendingEmail === leader.id
            const result = emailResult?.leaderId === leader.id ? emailResult : null

            return (
              <div key={leader.id} className={styles.leaderCol}>
                <div className={styles.leaderHeader}>
                  <div className={styles.leaderAvatar}>{leader.name.charAt(0).toUpperCase()}</div>
                  <div className={styles.leaderInfo}>
                    <span className={styles.leaderName}>{leader.name}</span>
                    {leader.role && <span className={styles.leaderRole}>{leader.role}</span>}
                    {leaderWithEmail.email
                      ? <span className={styles.leaderEmail}>{leaderWithEmail.email}</span>
                      : <button className={styles.addEmailBtn} onClick={() => openEditLeader(leader)}>+ Add email</button>
                    }
                  </div>
                  <div className={styles.leaderMeta}>
                    <span className={styles.leaderCount}>{done}/{ltasks.length}</span>
                    <button className={styles.iconBtn} onClick={() => openEditLeader(leader)} title="Edit leader">
                      <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                        <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/>
                        <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/>
                      </svg>
                    </button>
                    <button className={`${styles.iconBtn} ${styles.iconBtnDanger}`} onClick={() => deleteLeader(leader.id)} title="Remove leader">×</button>
                  </div>
                </div>

                {/* Send delegation buttons */}
                <div className={styles.sendRow}>
                  <button
                    className={styles.previewBtn}
                    onClick={() => setPreviewLeader(leaderWithEmail)}
                  >
                    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/>
                      <circle cx="12" cy="12" r="3"/>
                    </svg>
                    Preview Email
                  </button>
                  <button
                    className={styles.sendBtn}
                    onClick={() => sendDelegationEmail(leader)}
                    disabled={isSending}
                  >
                    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <line x1="22" y1="2" x2="11" y2="13"/>
                      <polygon points="22 2 15 22 11 13 2 9 22 2"/>
                    </svg>
                    {isSending ? 'Sending...' : 'Send'}
                  </button>
                </div>

                {result && (
                  <div className={styles.emailResult}>
                    {result.sent
                      ? <span className={styles.emailSentBadge}>Email sent!</span>
                      : <span className={styles.emailPendingBadge}>Link generated (email needs RESEND key)</span>
                    }
                    <div className={styles.delegateUrlRow}>
                      <span className={styles.delegateUrlLabel}>Delegate link:</span>
                      <a href={result.url} target="_blank" rel="noreferrer" className={styles.delegateUrl}>
                        Open
                      </a>
                      <button
                        className={styles.copyBtn}
                        onClick={() => navigator.clipboard.writeText(result.url)}
                      >
                        Copy
                      </button>
                    </div>
                  </div>
                )}

                {ltasks.length === 0 ? (
                  <div className={styles.emptyCol}>
                    <p>No tasks assigned</p>
                    <button
                      className={styles.addTaskInline}
                      onClick={() => { setEditingTask(null); setTaskForm(emptyForm(leader.id)); setShowAddTask(true) }}
                    >
                      + Add task
                    </button>
                  </div>
                ) : (
                  <ul className={styles.taskList}>
                    {ltasks.map(task => {
                      const taskComments = commentsForTask(task.id)
                      const isExpanded = expandedTask === task.id
                      return (
                        <li key={task.id} className={`${styles.taskCard} ${styles[`task_${task.status}`]}`}>
                          <div className={styles.taskTop}>
                            <button
                              className={`${styles.statusPill} ${styles[`pill_${task.status}`]}`}
                              onClick={() => cycleStatus(task)}
                              title="Click to advance status"
                            >
                              {STATUS_LABELS[task.status]}
                            </button>
                            <div className={styles.taskActions}>
                              <button
                                className={`${styles.iconBtn} ${taskComments.length > 0 ? styles.iconBtnActive : ''}`}
                                onClick={() => setExpandedTask(isExpanded ? null : task.id)}
                                title="Comments"
                              >
                                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                                  <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/>
                                </svg>
                                {taskComments.length > 0 && <span className={styles.commentCount}>{taskComments.length}</span>}
                              </button>
                              <button className={styles.iconBtn} onClick={() => openEdit(task)} title="Edit">
                                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                                  <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/>
                                  <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/>
                                </svg>
                              </button>
                              <button className={`${styles.iconBtn} ${styles.iconBtnDanger}`} onClick={() => deleteTask(task.id)} title="Delete">
                                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                                  <polyline points="3 6 5 6 21 6"/>
                                  <path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/>
                                  <path d="M10 11v6"/><path d="M14 11v6"/>
                                </svg>
                              </button>
                            </div>
                          </div>
                          <p className={`${styles.taskTitle} ${task.status === 'completed' ? styles.taskDone : ''}`}>
                            {task.title}
                          </p>
                          {task.description && <p className={styles.taskDesc}>{task.description}</p>}
                          {task.due_date && (
                            <p className={styles.taskDue}>
                              Due: {new Date(task.due_date + 'T00:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                            </p>
                          )}

                          {isExpanded && (
                            <div className={styles.commentsPanel}>
                              {taskComments.length === 0 && (
                                <p className={styles.noComments}>No updates yet.</p>
                              )}
                              {taskComments.map(c => (
                                <div key={c.id} className={`${styles.comment} ${c.author_type === 'delegate' ? styles.commentDelegate : styles.commentAdmin}`}>
                                  <div className={styles.commentMeta}>
                                    <span className={styles.commentAuthor}>
                                      {c.author_type === 'delegate' ? leader.name : 'You'}
                                    </span>
                                    {c.progress_status && (
                                      <span className={`${styles.statusPill} ${styles[`pill_${c.progress_status}`]}`} style={{ fontSize: '10px', padding: '1px 7px' }}>
                                        {STATUS_LABELS[c.progress_status] || c.progress_status}
                                      </span>
                                    )}
                                    <span className={styles.commentTime}>
                                      {new Date(c.created_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' })}
                                    </span>
                                  </div>
                                  <p className={styles.commentText}>{c.comment}</p>
                                </div>
                              ))}
                              <div className={styles.addCommentRow}>
                                <input
                                  className={styles.commentInput}
                                  placeholder="Add a note..."
                                  value={newComment}
                                  onChange={e => setNewComment(e.target.value)}
                                  onKeyDown={e => e.key === 'Enter' && addComment(task.id, task.leader_id)}
                                />
                                <button
                                  className={styles.commentSendBtn}
                                  onClick={() => addComment(task.id, task.leader_id)}
                                  disabled={addingComment || !newComment.trim()}
                                >
                                  Send
                                </button>
                              </div>
                            </div>
                          )}
                        </li>
                      )
                    })}
                    <li>
                      <button
                        className={styles.addTaskInline}
                        onClick={() => { setEditingTask(null); setTaskForm(emptyForm(leader.id)); setShowAddTask(true) }}
                      >
                        + Add task
                      </button>
                    </li>
                  </ul>
                )}
              </div>
            )
          })}

        {leaders.length === 0 && (
          <div className={styles.emptyState}>
            <p>No leaders yet. Add a leader to start delegating tasks.</p>
            <button className={styles.btnPrimary} onClick={() => { setEditingLeader(null); setLeaderForm(emptyLeaderForm()); setShowAddLeader(true) }}>Add First Leader</button>
          </div>
        )}
      </div>

      {/* Task modal */}
      {showAddTask && (
        <div className={styles.backdrop} onClick={() => { setShowAddTask(false); setEditingTask(null) }}>
          <div className={styles.modal} onClick={e => e.stopPropagation()}>
            <div className={styles.modalHeader}>
              <h3>{editingTask ? 'Edit Task' : 'Delegate Task'}</h3>
              <button className={styles.modalClose} onClick={() => { setShowAddTask(false); setEditingTask(null) }}>×</button>
            </div>
            <div className={styles.modalBody}>
              <label className={styles.label}>Assign to</label>
              <select
                className={styles.select}
                value={taskForm.leaderId}
                onChange={e => setTaskForm(f => ({ ...f, leaderId: e.target.value }))}
              >
                <option value="">Select a leader...</option>
                {leaders.map(l => (
                  <option key={l.id} value={l.id}>{l.name}{l.role ? ` — ${l.role}` : ''}</option>
                ))}
              </select>
              <label className={styles.label}>Task title *</label>
              <input
                className={styles.input}
                value={taskForm.title}
                onChange={e => setTaskForm(f => ({ ...f, title: e.target.value }))}
                placeholder="What needs to be done?"
                autoFocus
              />
              <label className={styles.label}>Notes / Description</label>
              <textarea
                className={styles.textarea}
                value={taskForm.description}
                onChange={e => setTaskForm(f => ({ ...f, description: e.target.value }))}
                placeholder="Additional context..."
                rows={3}
              />
              <div className={styles.row2}>
                <div>
                  <label className={styles.label}>Due Date</label>
                  <input type="date" className={styles.input} value={taskForm.dueDate} onChange={e => setTaskForm(f => ({ ...f, dueDate: e.target.value }))} />
                </div>
                <div>
                  <label className={styles.label}>Status</label>
                  <select className={styles.select} value={taskForm.status} onChange={e => setTaskForm(f => ({ ...f, status: e.target.value as DelegatedTask['status'] }))}>
                    {STATUS_CYCLE.map(s => <option key={s} value={s}>{STATUS_LABELS[s]}</option>)}
                  </select>
                </div>
              </div>
            </div>
            <div className={styles.modalFooter}>
              <button className={styles.btnGhost} onClick={() => { setShowAddTask(false); setEditingTask(null) }}>Cancel</button>
              <button className={styles.btnPrimary} onClick={saveTask} disabled={saving || !taskForm.title.trim() || !taskForm.leaderId}>
                {saving ? 'Saving...' : editingTask ? 'Update Task' : 'Delegate Task'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Email preview modal */}
      {previewLeader && (
        <EmailPreviewModal
          leader={previewLeader}
          tasks={tasksByLeader(previewLeader.id)}
          weekLabel="May 4–8, 2026"
          onClose={() => setPreviewLeader(null)}
          onSend={() => {
            setPreviewLeader(null)
            sendDelegationEmail(previewLeader)
          }}
          isSending={sendingEmail === previewLeader.id}
        />
      )}

      {/* Add/edit leader modal */}
      {showAddLeader && (
        <div className={styles.backdrop} onClick={() => { setShowAddLeader(false); setEditingLeader(null) }}>
          <div className={styles.modal} onClick={e => e.stopPropagation()}>
            <div className={styles.modalHeader}>
              <h3>{editingLeader ? 'Edit Leader' : 'Add Leader'}</h3>
              <button className={styles.modalClose} onClick={() => { setShowAddLeader(false); setEditingLeader(null) }}>×</button>
            </div>
            <div className={styles.modalBody}>
              <label className={styles.label}>Name *</label>
              <input
                className={styles.input}
                value={leaderForm.name}
                onChange={e => setLeaderForm(f => ({ ...f, name: e.target.value }))}
                placeholder="Leader's name"
                autoFocus
              />
              <label className={styles.label}>Role / Title</label>
              <input
                className={styles.input}
                value={leaderForm.role}
                onChange={e => setLeaderForm(f => ({ ...f, role: e.target.value }))}
                placeholder="e.g. Team Leader, Department Head"
              />
              <label className={styles.label}>Email Address</label>
              <input
                type="email"
                className={styles.input}
                value={leaderForm.email}
                onChange={e => setLeaderForm(f => ({ ...f, email: e.target.value }))}
                placeholder="leader@school.edu"
              />
              <p className={styles.emailHint}>
                Email is required to send delegation notifications and the delegate link.
              </p>
            </div>
            <div className={styles.modalFooter}>
              <button className={styles.btnGhost} onClick={() => { setShowAddLeader(false); setEditingLeader(null) }}>Cancel</button>
              <button className={styles.btnPrimary} onClick={saveLeader} disabled={saving || !leaderForm.name.trim()}>
                {saving ? 'Saving...' : editingLeader ? 'Save Changes' : 'Add Leader'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
