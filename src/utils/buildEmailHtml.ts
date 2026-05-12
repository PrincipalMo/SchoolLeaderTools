export interface EmailTask {
  title: string
  description: string
  due_date: string | null
  status: string
}

const STATUS_LABEL: Record<string, string> = {
  pending: 'Pending',
  in_progress: 'In Progress',
  completed: 'Completed',
}

const STATUS_COLOR: Record<string, string> = {
  pending: '#d97706',
  in_progress: '#2563eb',
  completed: '#16a34a',
}

export function buildEmailHtml(
  leaderName: string,
  weekLabel: string,
  tasks: EmailTask[],
  delegateUrl: string,
  isPreview = false
): string {
  const taskRows = tasks.map(t => `
    <tr>
      <td style="padding:10px 12px;border-bottom:1px solid #e5e7eb;font-size:14px;color:#111827;">${t.title}</td>
      <td style="padding:10px 12px;border-bottom:1px solid #e5e7eb;font-size:13px;color:#6b7280;">${t.description || '—'}</td>
      <td style="padding:10px 12px;border-bottom:1px solid #e5e7eb;font-size:13px;color:#6b7280;">${t.due_date ? new Date(t.due_date + 'T00:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) : '—'}</td>
      <td style="padding:10px 12px;border-bottom:1px solid #e5e7eb;">
        <span style="background:${(STATUS_COLOR[t.status] || '#6b7280')}20;color:${STATUS_COLOR[t.status] || '#6b7280'};padding:3px 10px;border-radius:12px;font-size:12px;font-weight:600;">
          ${STATUS_LABEL[t.status] || t.status}
        </span>
      </td>
    </tr>
  `).join('')

  const buttonStyle = isPreview
    ? 'display:inline-block;background:#9ca3af;color:#fff;text-decoration:none;padding:14px 32px;border-radius:8px;font-size:15px;font-weight:600;cursor:default;'
    : 'display:inline-block;background:#2563eb;color:#fff;text-decoration:none;padding:14px 32px;border-radius:8px;font-size:15px;font-weight:600;'

  const previewBanner = isPreview ? `
    <div style="background:#fef3c7;border-bottom:2px solid #f59e0b;padding:10px 24px;text-align:center;font-size:13px;font-weight:700;color:#92400e;font-family:system-ui,sans-serif;">
      PREVIEW MODE — This is how the email will appear to ${leaderName}
    </div>
  ` : ''

  return `<!DOCTYPE html>
<html>
<head><meta charset="UTF-8"></head>
<body style="margin:0;padding:0;background:#f9fafb;font-family:system-ui,sans-serif;">
  ${previewBanner}
  <div style="max-width:600px;margin:40px auto;background:#fff;border-radius:12px;box-shadow:0 4px 16px rgba(0,0,0,0.08);overflow:hidden;">
    <div style="background:#1d4ed8;padding:28px 32px;">
      <div style="display:flex;align-items:center;gap:12px;">
        <div style="width:36px;height:36px;background:#fff;border-radius:8px;display:flex;align-items:center;justify-content:center;font-weight:700;font-size:18px;color:#1d4ed8;">W</div>
        <span style="color:#fff;font-size:20px;font-weight:700;">Week at a Glance</span>
      </div>
    </div>
    <div style="padding:32px;">
      <h1 style="margin:0 0 8px;font-size:22px;color:#111827;">Hi ${leaderName},</h1>
      <p style="margin:0 0 24px;color:#6b7280;font-size:15px;">
        You have been assigned tasks for the week of <strong style="color:#111827;">${weekLabel}</strong>.
        Below is your current task list. Click the link at the bottom to view the full calendar and update your progress.
      </p>

      ${tasks.length > 0 ? `
      <table style="width:100%;border-collapse:collapse;margin-bottom:28px;">
        <thead>
          <tr style="background:#f3f4f6;">
            <th style="padding:10px 12px;text-align:left;font-size:12px;text-transform:uppercase;letter-spacing:0.05em;color:#6b7280;font-weight:600;">Task</th>
            <th style="padding:10px 12px;text-align:left;font-size:12px;text-transform:uppercase;letter-spacing:0.05em;color:#6b7280;font-weight:600;">Notes</th>
            <th style="padding:10px 12px;text-align:left;font-size:12px;text-transform:uppercase;letter-spacing:0.05em;color:#6b7280;font-weight:600;">Due</th>
            <th style="padding:10px 12px;text-align:left;font-size:12px;text-transform:uppercase;letter-spacing:0.05em;color:#6b7280;font-weight:600;">Status</th>
          </tr>
        </thead>
        <tbody>${taskRows}</tbody>
      </table>
      ` : `<p style="color:#9ca3af;font-style:italic;margin-bottom:28px;">No tasks assigned yet.</p>`}

      <div style="text-align:center;margin:32px 0 8px;">
        <a href="${isPreview ? '#' : delegateUrl}" style="${buttonStyle}">
          View Calendar &amp; Update Progress
        </a>
      </div>
      ${isPreview
        ? `<p style="text-align:center;color:#f59e0b;font-size:12px;font-weight:700;margin:12px 0 0;">[Preview: button links to delegate portal]</p>`
        : `<p style="text-align:center;color:#9ca3af;font-size:12px;margin:12px 0 0;">This link is unique to you. Please don't share it.</p>`
      }
    </div>
    <div style="background:#f9fafb;padding:20px 32px;border-top:1px solid #e5e7eb;">
      <p style="margin:0;color:#9ca3af;font-size:12px;text-align:center;">Week at a Glance · Sent by your administrator</p>
    </div>
  </div>
</body>
</html>`
}
