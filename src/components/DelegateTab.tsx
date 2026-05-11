import { useEffect, useState, useCallback } from 'react'
import { supabase, Leader, DelegatedTask } from '../supabase'
import styles from './DelegateTab.module.css'

const STATUS_LABELS: Record<string, string> = {
  pending: 'Pending',
  in_progress: 'In Progress',
  completed: 'Completed',
}

const STATUS_CYCLE: DelegatedTask['status'][] = ['pending', 'in_progress', 'completed']

interface TaskForm {
  leaderId: string
  title: string
  description: string
  dueDate: string
  status: DelegatedTask['status']
}

const emptyForm = (leaderId = ''): TaskForm => ({
  leaderId,
  title: '',
  description: '',
  dueDate: '',
  status: 'pending',
})

interface Props {
  userId: string
}

export default function DelegateTab({ userId }: Props) {
  const [leaders, setLeaders] = useState<Leader[]>([])
  const [tasks, setTasks] = useState<DelegatedTask[]>([])
  const [loading, setLoading] = useState(true)
  const [showAddTask, setShowAddTask] = useState(false)
  const [taskForm, setTaskForm] = useState<TaskForm>(emptyForm())
  const [editingTask, setEditingTask] = useState<DelegatedTask | null>(null)
  const [showAddLeader, setShowAddLeader] = useState(false)
  const [leaderName, setLeaderName] = useState('')
  const [leaderRole, setLeaderRole] = useState('')
  const [saving, setSaving] = useState(false)
  const [filterLeader, setFilterLeader] = useState<string>('all')

  const load = useCallback(async () => {
    setLoading(true)
    const [lRes, tRes] = await Promise.all([
      supabase.from('leaders').select('*').eq('user_id', userId).order('name'),
      supabase.from('delegated_tasks').select('*').eq('user_id', userId).order('created_at', { ascending: false }),
    ])
    if (lRes.data) setLeaders(lRes.data as Leader[])
    if (tRes.data) setTasks(tRes.data as DelegatedTask[])
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
  }

  async function addLeader() {
    if (!leaderName.trim()) return
    const { data } = await supabase.from('leaders').insert({
      user_id: userId,
      name: leaderName.trim(),
      role: leaderRole.trim(),
    }).select().single()
    if (data) setLeaders(prev => [...prev, data as Leader])
    setLeaderName('')
    setLeaderRole('')
    setShowAddLeader(false)
  }

  async function deleteLeader(id: string) {
    if (!confirm('Delete this leader and all their tasks?')) return
    await supabase.from('leaders').delete().eq('id', id)
    setLeaders(prev => prev.filter(l => l.id !== id))
    setTasks(prev => prev.filter(t => t.leader_id !== id))
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
          <button className={styles.btnSecondary} onClick={() => setShowAddLeader(true)}>
            + Add Leader
          </button>
          <button className={styles.btnPrimary} onClick={() => { setEditingTask(null); setTaskForm(emptyForm()); setShowAddTask(true) }}>
            + Delegate Task
          </button>
        </div>
      </div>

      {/* Leader columns */}
      <div className={styles.board}>
        {leaders
          .filter(l => filterLeader === 'all' || l.id === filterLeader)
          .map(leader => {
            const ltasks = tasksByLeader(leader.id)
            const done = ltasks.filter(t => t.status === 'completed').length
            return (
              <div key={leader.id} className={styles.leaderCol}>
                <div className={styles.leaderHeader}>
                  <div className={styles.leaderAvatar}>
                    {leader.name.charAt(0).toUpperCase()}
                  </div>
                  <div className={styles.leaderInfo}>
                    <span className={styles.leaderName}>{leader.name}</span>
                    {leader.role && <span className={styles.leaderRole}>{leader.role}</span>}
                  </div>
                  <div className={styles.leaderMeta}>
                    <span className={styles.leaderCount}>{done}/{ltasks.length}</span>
                    <button
                      className={styles.deleteLeaderBtn}
                      onClick={() => deleteLeader(leader.id)}
                      title="Remove leader"
                    >×</button>
                  </div>
                </div>

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
                    {ltasks.map(task => (
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
                        {task.description && (
                          <p className={styles.taskDesc}>{task.description}</p>
                        )}
                        {task.due_date && (
                          <p className={styles.taskDue}>
                            Due: {new Date(task.due_date + 'T00:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                          </p>
                        )}
                      </li>
                    ))}
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
            <button className={styles.btnPrimary} onClick={() => setShowAddLeader(true)}>Add First Leader</button>
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
                  <option key={l.id} value={l.id}>{l.name} {l.role ? `— ${l.role}` : ''}</option>
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
                  <input
                    type="date"
                    className={styles.input}
                    value={taskForm.dueDate}
                    onChange={e => setTaskForm(f => ({ ...f, dueDate: e.target.value }))}
                  />
                </div>
                <div>
                  <label className={styles.label}>Status</label>
                  <select
                    className={styles.select}
                    value={taskForm.status}
                    onChange={e => setTaskForm(f => ({ ...f, status: e.target.value as DelegatedTask['status'] }))}
                  >
                    {STATUS_CYCLE.map(s => (
                      <option key={s} value={s}>{STATUS_LABELS[s]}</option>
                    ))}
                  </select>
                </div>
              </div>
            </div>
            <div className={styles.modalFooter}>
              <button className={styles.btnGhost} onClick={() => { setShowAddTask(false); setEditingTask(null) }}>Cancel</button>
              <button
                className={styles.btnPrimary}
                onClick={saveTask}
                disabled={saving || !taskForm.title.trim() || !taskForm.leaderId}
              >
                {saving ? 'Saving...' : editingTask ? 'Update Task' : 'Delegate Task'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Add leader modal */}
      {showAddLeader && (
        <div className={styles.backdrop} onClick={() => setShowAddLeader(false)}>
          <div className={styles.modal} onClick={e => e.stopPropagation()}>
            <div className={styles.modalHeader}>
              <h3>Add Leader</h3>
              <button className={styles.modalClose} onClick={() => setShowAddLeader(false)}>×</button>
            </div>
            <div className={styles.modalBody}>
              <label className={styles.label}>Name *</label>
              <input
                className={styles.input}
                value={leaderName}
                onChange={e => setLeaderName(e.target.value)}
                placeholder="Leader's name"
                autoFocus
                onKeyDown={e => e.key === 'Enter' && addLeader()}
              />
              <label className={styles.label}>Role / Title</label>
              <input
                className={styles.input}
                value={leaderRole}
                onChange={e => setLeaderRole(e.target.value)}
                placeholder="e.g. Team Leader, Department Head"
              />
            </div>
            <div className={styles.modalFooter}>
              <button className={styles.btnGhost} onClick={() => setShowAddLeader(false)}>Cancel</button>
              <button
                className={styles.btnPrimary}
                onClick={addLeader}
                disabled={!leaderName.trim()}
              >
                Add Leader
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
