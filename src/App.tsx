import { useState, useEffect, useCallback } from 'react'
import { User } from '@supabase/supabase-js'
import { supabase } from './supabase'
import AuthPage from './components/AuthPage'
import CalendarTab from './components/CalendarTab'
import DelegateTab from './components/DelegateTab'
import DelegateView from './components/DelegateView'
import SettingsTab from './components/SettingsTab'
import { exportFullRecord } from './utils/exportLog'
import styles from './App.module.css'

type Tab = 'calendar' | 'delegate' | 'settings'

interface Prefs {
  priority_color: string
  priority_outline_color: string
}

const DEFAULT_PREFS: Prefs = {
  priority_color: '#f59e0b',
  priority_outline_color: '#f59e0b',
}

// Check if this is a delegate access URL
function getDelegateToken(): string | null {
  const params = new URLSearchParams(window.location.search)
  return params.get('token')
}

function applyPriorityColors(prefs: Prefs) {
  document.documentElement.style.setProperty('--priority-color', prefs.priority_color)
  document.documentElement.style.setProperty('--priority-outline-color', prefs.priority_outline_color)
}

export default function App() {
  const delegateToken = getDelegateToken()

  // If accessed via delegate link, render delegate view immediately (no auth needed)
  if (delegateToken) {
    return <DelegateView token={delegateToken} />
  }

  const [user, setUser] = useState<User | null>(null)
  const [authLoading, setAuthLoading] = useState(true)
  const [activeTab, setActiveTab] = useState<Tab>('calendar')
  const [exporting, setExporting] = useState(false)
  const [showUserMenu, setShowUserMenu] = useState(false)
  const [prefs, setPrefs] = useState<Prefs>(DEFAULT_PREFS)

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      setUser(data.session?.user ?? null)
      setAuthLoading(false)
    })

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user ?? null)
    })

    return () => subscription.unsubscribe()
  }, [])

  const handlePrefsChange = useCallback((p: Prefs) => {
    setPrefs(p)
    applyPriorityColors(p)
  }, [])

  // Apply defaults on mount
  useEffect(() => { applyPriorityColors(DEFAULT_PREFS) }, [])

  async function signOut() {
    await supabase.auth.signOut()
    setShowUserMenu(false)
  }

  async function handleExport() {
    if (!user) return
    setExporting(true)
    await exportFullRecord(user.id)
    setExporting(false)
    setShowUserMenu(false)
  }

  if (authLoading) {
    return (
      <div className={styles.splash}>
        <div className={styles.splashIcon}>W</div>
        <div className={styles.splashSpinner} />
      </div>
    )
  }

  if (!user) return <AuthPage />

  return (
    <div className={styles.app} onClick={() => setShowUserMenu(false)}>
      <header className={styles.header}>
        <div className={styles.headerContent}>
          <div className={styles.brand}>
            <div className={styles.brandIcon}>W</div>
            <div>
              <h1 className={styles.title}>Week at a Glance</h1>
              <p className={styles.subtitle}>Weekly Planning Dashboard</p>
            </div>
          </div>

          <nav className={styles.tabs}>
            <button
              className={`${styles.tab} ${activeTab === 'calendar' ? styles.tabActive : ''}`}
              onClick={() => setActiveTab('calendar')}
            >
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <rect x="3" y="4" width="18" height="18" rx="2"/>
                <line x1="16" y1="2" x2="16" y2="6"/>
                <line x1="8" y1="2" x2="8" y2="6"/>
                <line x1="3" y1="10" x2="21" y2="10"/>
              </svg>
              Weekly Calendar
            </button>
            <button
              className={`${styles.tab} ${activeTab === 'delegate' ? styles.tabActive : ''}`}
              onClick={() => setActiveTab('delegate')}
            >
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/>
                <circle cx="9" cy="7" r="4"/>
                <path d="M23 21v-2a4 4 0 0 0-3-3.87"/>
                <path d="M16 3.13a4 4 0 0 1 0 7.75"/>
              </svg>
              Delegate to Leaders
            </button>
            <button
              className={`${styles.tab} ${activeTab === 'settings' ? styles.tabActive : ''}`}
              onClick={() => setActiveTab('settings')}
            >
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <circle cx="12" cy="12" r="3"/>
                <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"/>
              </svg>
              Settings
            </button>
          </nav>

          <div className={styles.userArea} onClick={e => e.stopPropagation()}>
            <button
              className={styles.userBtn}
              onClick={() => setShowUserMenu(prev => !prev)}
            >
              <div className={styles.userAvatar}>
                {user.email?.charAt(0).toUpperCase()}
              </div>
              <span className={styles.userEmail}>{user.email}</span>
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                <polyline points="6 9 12 15 18 9"/>
              </svg>
            </button>

            {showUserMenu && (
              <div className={styles.userMenu}>
                <div className={styles.userMenuEmail}>{user.email}</div>
                <button
                  className={styles.menuItem}
                  onClick={handleExport}
                  disabled={exporting}
                >
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/>
                    <polyline points="7 10 12 15 17 10"/>
                    <line x1="12" y1="15" x2="12" y2="3"/>
                  </svg>
                  {exporting ? 'Exporting...' : 'Download Full Record (CSV)'}
                </button>
                <div className={styles.menuDivider} />
                <button className={`${styles.menuItem} ${styles.menuItemDanger}`} onClick={signOut}>
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/>
                    <polyline points="16 17 21 12 16 7"/>
                    <line x1="21" y1="12" x2="9" y2="12"/>
                  </svg>
                  Sign Out
                </button>
              </div>
            )}
          </div>
        </div>
      </header>

      <main className={styles.main}>
        {activeTab === 'calendar' && <CalendarTab userId={user.id} prefs={prefs} />}
        {activeTab === 'delegate' && <DelegateTab userId={user.id} />}
        {activeTab === 'settings' && (
          <SettingsTab userId={user.id} onPrefsChange={handlePrefsChange} />
        )}
      </main>
    </div>
  )
}
