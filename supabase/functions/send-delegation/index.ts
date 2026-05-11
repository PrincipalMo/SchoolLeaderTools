import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey",
};

interface TaskRow {
  id: string;
  title: string;
  description: string;
  due_date: string | null;
  status: string;
}

interface LeaderRow {
  id: string;
  name: string;
  email: string;
  role: string;
}

interface TokenRow {
  token: string;
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 200, headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    // Verify the calling user
    const { data: { user }, error: userErr } = await supabase.auth.getUser(
      authHeader.replace("Bearer ", "")
    );
    if (userErr || !user) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { leaderId, weekStart, appUrl } = await req.json() as {
      leaderId: string;
      weekStart: string;
      appUrl: string;
    };

    // Fetch leader
    const { data: leader, error: leaderErr } = await supabase
      .from("leaders")
      .select("id, name, email, role")
      .eq("id", leaderId)
      .eq("user_id", user.id)
      .maybeSingle();

    if (leaderErr || !leader) {
      return new Response(JSON.stringify({ error: "Leader not found" }), {
        status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const leaderRow = leader as LeaderRow;

    if (!leaderRow.email) {
      return new Response(JSON.stringify({ error: "Leader has no email address" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Get or create a delegate token for this leader
    const { data: existingToken } = await supabase
      .from("delegate_tokens")
      .select("token")
      .eq("leader_id", leaderId)
      .eq("owner_user_id", user.id)
      .maybeSingle();

    let token: string;
    if (existingToken) {
      token = (existingToken as TokenRow).token;
    } else {
      token = crypto.randomUUID().replace(/-/g, "") + crypto.randomUUID().replace(/-/g, "");
      await supabase.from("delegate_tokens").insert({
        token,
        leader_id: leaderId,
        owner_user_id: user.id,
      });
    }

    // Fetch tasks for this leader
    const { data: tasks } = await supabase
      .from("delegated_tasks")
      .select("id, title, description, due_date, status")
      .eq("leader_id", leaderId)
      .eq("user_id", user.id)
      .order("created_at");

    const taskList = (tasks || []) as TaskRow[];
    const delegateUrl = `${appUrl}/delegate?token=${token}`;

    // Build email HTML
    const statusLabel: Record<string, string> = {
      pending: "Pending",
      in_progress: "In Progress",
      completed: "Completed",
    };

    const statusColor: Record<string, string> = {
      pending: "#d97706",
      in_progress: "#2563eb",
      completed: "#16a34a",
    };

    const taskRows = taskList.map(t => `
      <tr>
        <td style="padding:10px 12px;border-bottom:1px solid #e5e7eb;font-size:14px;color:#111827;">${t.title}</td>
        <td style="padding:10px 12px;border-bottom:1px solid #e5e7eb;font-size:13px;color:#6b7280;">${t.description || "—"}</td>
        <td style="padding:10px 12px;border-bottom:1px solid #e5e7eb;font-size:13px;color:#6b7280;">${t.due_date ? new Date(t.due_date + "T00:00:00").toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" }) : "—"}</td>
        <td style="padding:10px 12px;border-bottom:1px solid #e5e7eb;">
          <span style="background:${statusColor[t.status] || "#6b7280"}20;color:${statusColor[t.status] || "#6b7280"};padding:3px 10px;border-radius:12px;font-size:12px;font-weight:600;">
            ${statusLabel[t.status] || t.status}
          </span>
        </td>
      </tr>
    `).join("");

    const emailHtml = `
<!DOCTYPE html>
<html>
<head><meta charset="UTF-8"></head>
<body style="margin:0;padding:0;background:#f9fafb;font-family:system-ui,sans-serif;">
  <div style="max-width:600px;margin:40px auto;background:#fff;border-radius:12px;box-shadow:0 4px 16px rgba(0,0,0,0.08);overflow:hidden;">
    <div style="background:#1d4ed8;padding:28px 32px;">
      <div style="display:flex;align-items:center;gap:12px;">
        <div style="width:36px;height:36px;background:#fff;border-radius:8px;display:flex;align-items:center;justify-content:center;font-weight:700;font-size:18px;color:#1d4ed8;">W</div>
        <span style="color:#fff;font-size:20px;font-weight:700;">Week at a Glance</span>
      </div>
    </div>
    <div style="padding:32px;">
      <h1 style="margin:0 0 8px;font-size:22px;color:#111827;">Hi ${leaderRow.name},</h1>
      <p style="margin:0 0 24px;color:#6b7280;font-size:15px;">
        You have been assigned tasks for the week of <strong style="color:#111827;">${weekStart}</strong>.
        Below is your current task list. Click the link at the bottom to view the full calendar and update your progress.
      </p>

      ${taskList.length > 0 ? `
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
        <a href="${delegateUrl}"
          style="display:inline-block;background:#2563eb;color:#fff;text-decoration:none;padding:14px 32px;border-radius:8px;font-size:15px;font-weight:600;">
          View Calendar &amp; Update Progress
        </a>
      </div>
      <p style="text-align:center;color:#9ca3af;font-size:12px;margin:12px 0 0;">
        This link is unique to you. Please don't share it.
      </p>
    </div>
    <div style="background:#f9fafb;padding:20px 32px;border-top:1px solid #e5e7eb;">
      <p style="margin:0;color:#9ca3af;font-size:12px;text-align:center;">Week at a Glance · Sent by your administrator</p>
    </div>
  </div>
</body>
</html>`;

    // Send email via Supabase built-in SMTP (uses Resend under the hood via service role)
    const smtpRes = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${Deno.env.get("RESEND_API_KEY") || ""}`,
      },
      body: JSON.stringify({
        from: "WAG App <onboarding@resend.dev>",
        to: leaderRow.email,
        subject: `Your tasks for the week of ${weekStart} — Week at a Glance`,
        html: emailHtml,
      }),
    });

    if (!smtpRes.ok) {
      const errText = await smtpRes.text();
      // Still return success with the delegate URL — email sending requires Resend key setup
      return new Response(JSON.stringify({
        success: true,
        delegateUrl,
        emailSent: false,
        emailError: errText,
        message: "Delegate link generated. Email requires RESEND_API_KEY to be configured.",
      }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    return new Response(JSON.stringify({ success: true, delegateUrl, emailSent: true }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });

  } catch (err) {
    return new Response(JSON.stringify({ error: String(err) }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
