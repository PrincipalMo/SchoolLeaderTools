import { useState } from 'react'
import CalendarTab from './components/CalendarTab'
import DelegateTab from './components/DelegateTab'
import styles from './App.module.css'

type Tab = 'calendar' | 'delegate'

export default function App() {
  const [activeTab, setActiveTab] = useState<Tab>('calendar')

  return (
    <div className={styles.app}>
      <header className={styles.header}>
        <div className={styles.headerContent}>
          <div className={styles.brand}>
            <div className={styles.brandIcon}>W</div>
            <div>
              <h1 className={styles.title}>Week at a Glance</h1>
              <p className={styles.subtitle}>May 4 – 8, 2026</p>
            </div>
          </div>
          <nav className={styles.tabs}>
            <button
              className={`${styles.tab} ${activeTab === 'calendar' ? styles.tabActive : ''}`}
              onClick={() => setActiveTab('calendar')}
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <rect x="3" y="4" width="18" height="18" rx="2" ry="2"/>
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
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/>
                <circle cx="9" cy="7" r="4"/>
                <path d="M23 21v-2a4 4 0 0 0-3-3.87"/>
                <path d="M16 3.13a4 4 0 0 1 0 7.75"/>
              </svg>
              Delegate to Leaders
            </button>
          </nav>
        </div>
      </header>

      <main className={styles.main}>
        {activeTab === 'calendar' && <CalendarTab />}
        {activeTab === 'delegate' && <DelegateTab />}
      </main>
    </div>
  )
}
