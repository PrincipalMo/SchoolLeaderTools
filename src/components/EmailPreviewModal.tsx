import { useEffect, useRef } from 'react'
import { Leader, DelegatedTask } from '../supabase'
import { buildEmailHtml } from '../utils/buildEmailHtml'
import styles from './EmailPreviewModal.module.css'

interface Props {
  leader: Leader & { email?: string }
  tasks: DelegatedTask[]
  weekLabel: string
  onClose: () => void
  onSend: () => void
  isSending: boolean
}

export default function EmailPreviewModal({ leader, tasks, weekLabel, onClose, onSend, isSending }: Props) {
  const iframeRef = useRef<HTMLIFrameElement>(null)

  const html = buildEmailHtml(
    leader.name,
    weekLabel,
    tasks.map(t => ({
      title: t.title,
      description: t.description,
      due_date: t.due_date || null,
      status: t.status,
    })),
    `${window.location.origin}/delegate?token=preview`,
    true
  )

  useEffect(() => {
    const iframe = iframeRef.current
    if (!iframe) return
    const doc = iframe.contentDocument || iframe.contentWindow?.document
    if (!doc) return
    doc.open()
    doc.write(html)
    doc.close()
  }, [html])

  function handleBackdropClick(e: React.MouseEvent) {
    if (e.target === e.currentTarget) onClose()
  }

  return (
    <div className={styles.backdrop} onClick={handleBackdropClick}>
      <div className={styles.panel}>
        <div className={styles.header}>
          <div className={styles.headerLeft}>
            <div className={styles.previewBadge}>Preview</div>
            <div>
              <h2 className={styles.title}>Email Draft — {leader.name}</h2>
              <p className={styles.subject}>
                Subject: <span>Your tasks for {weekLabel} — Week at a Glance</span>
              </p>
              {leader.email && (
                <p className={styles.to}>
                  To: <span>{leader.email}</span>
                </p>
              )}
              {!leader.email && (
                <p className={styles.noEmail}>No email address set — add one before sending</p>
              )}
            </div>
          </div>
          <button className={styles.closeBtn} onClick={onClose} title="Close preview">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
              <line x1="18" y1="6" x2="6" y2="18"/>
              <line x1="6" y1="6" x2="18" y2="18"/>
            </svg>
          </button>
        </div>

        <div className={styles.iframeWrap}>
          <iframe
            ref={iframeRef}
            className={styles.iframe}
            title={`Email preview for ${leader.name}`}
            sandbox="allow-same-origin"
          />
        </div>

        <div className={styles.footer}>
          <p className={styles.footerNote}>
            This is exactly what {leader.name} will receive. The blue button will contain their unique delegate link.
          </p>
          <div className={styles.footerActions}>
            <button className={styles.cancelBtn} onClick={onClose}>
              Close
            </button>
            <button
              className={styles.sendBtn}
              onClick={onSend}
              disabled={isSending || !leader.email}
              title={!leader.email ? 'Add an email address to this leader first' : undefined}
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <line x1="22" y1="2" x2="11" y2="13"/>
                <polygon points="22 2 15 22 11 13 2 9 22 2"/>
              </svg>
              {isSending ? 'Sending...' : 'Send Now'}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
