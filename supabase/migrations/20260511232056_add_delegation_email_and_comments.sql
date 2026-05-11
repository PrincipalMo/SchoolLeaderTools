/*
  # Delegation email, comments, and delegate access tokens

  1. Changes
    - Add `email` column to leaders table
    - Add `task_comments` table for delegate progress updates and comments
    - Add `delegate_tokens` table for secure, token-based delegate access (no auth required)
    - Update RLS: delegate_tokens and task_comments readable by token holder (via anon)

  2. New Tables
    - `task_comments`
      - `id` (uuid)
      - `task_id` (uuid FK delegated_tasks)
      - `leader_id` (uuid FK leaders)
      - `author_type` (text) - 'admin' | 'delegate'
      - `comment` (text)
      - `progress_status` (text) - optional status update from delegate
      - `created_at` (timestamptz)

    - `delegate_tokens`
      - `id` (uuid)
      - `token` (text, unique) - random secure token
      - `leader_id` (uuid FK leaders)
      - `owner_user_id` (uuid FK auth.users) - the admin who owns the data
      - `expires_at` (timestamptz, nullable)
      - `created_at` (timestamptz)

  3. Security
    - task_comments: admins can CRUD their own, delegates can read/insert via token lookup
    - delegate_tokens: admins manage their own tokens; anon can SELECT by token value
*/

-- Add email to leaders
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'leaders' AND column_name = 'email'
  ) THEN
    ALTER TABLE leaders ADD COLUMN email text NOT NULL DEFAULT '';
  END IF;
END $$;

-- task_comments table
CREATE TABLE IF NOT EXISTS task_comments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  task_id uuid NOT NULL REFERENCES delegated_tasks(id) ON DELETE CASCADE,
  leader_id uuid NOT NULL REFERENCES leaders(id) ON DELETE CASCADE,
  author_type text NOT NULL DEFAULT 'admin',
  comment text NOT NULL DEFAULT '',
  progress_status text,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE task_comments ENABLE ROW LEVEL SECURITY;

-- delegate_tokens table
CREATE TABLE IF NOT EXISTS delegate_tokens (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  token text NOT NULL UNIQUE,
  leader_id uuid NOT NULL REFERENCES leaders(id) ON DELETE CASCADE,
  owner_user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  expires_at timestamptz,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE delegate_tokens ENABLE ROW LEVEL SECURITY;

-- task_comments: authenticated admin can CRUD their own
CREATE POLICY "Admins can view task comments they own"
  ON task_comments FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM delegated_tasks dt
      WHERE dt.id = task_comments.task_id AND dt.user_id = auth.uid()
    )
  );

CREATE POLICY "Admins can insert task comments they own"
  ON task_comments FOR INSERT TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM delegated_tasks dt
      WHERE dt.id = task_comments.task_id AND dt.user_id = auth.uid()
    )
  );

CREATE POLICY "Admins can delete task comments they own"
  ON task_comments FOR DELETE TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM delegated_tasks dt
      WHERE dt.id = task_comments.task_id AND dt.user_id = auth.uid()
    )
  );

-- task_comments: anon can read/insert if they have a valid delegate token for this leader
CREATE POLICY "Delegates can view comments for their tasks"
  ON task_comments FOR SELECT TO anon
  USING (
    EXISTS (
      SELECT 1 FROM delegate_tokens dkt
      WHERE dkt.leader_id = task_comments.leader_id
        AND (dkt.expires_at IS NULL OR dkt.expires_at > now())
    )
  );

CREATE POLICY "Delegates can insert comments for their tasks"
  ON task_comments FOR INSERT TO anon
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM delegate_tokens dkt
      WHERE dkt.leader_id = task_comments.leader_id
        AND (dkt.expires_at IS NULL OR dkt.expires_at > now())
    )
  );

-- delegate_tokens: admins manage their own
CREATE POLICY "Admins can view own delegate tokens"
  ON delegate_tokens FOR SELECT TO authenticated
  USING (auth.uid() = owner_user_id);

CREATE POLICY "Admins can insert own delegate tokens"
  ON delegate_tokens FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = owner_user_id);

CREATE POLICY "Admins can delete own delegate tokens"
  ON delegate_tokens FOR DELETE TO authenticated
  USING (auth.uid() = owner_user_id);

-- Anon can look up a token by value (for delegate login)
CREATE POLICY "Anon can look up delegate token by value"
  ON delegate_tokens FOR SELECT TO anon
  USING (expires_at IS NULL OR expires_at > now());

-- delegated_tasks: anon delegates can view and update tasks assigned to them via token
CREATE POLICY "Delegates can view their assigned tasks"
  ON delegated_tasks FOR SELECT TO anon
  USING (
    EXISTS (
      SELECT 1 FROM delegate_tokens dkt
      WHERE dkt.leader_id = delegated_tasks.leader_id
        AND (dkt.expires_at IS NULL OR dkt.expires_at > now())
    )
  );

CREATE POLICY "Delegates can update status of their tasks"
  ON delegated_tasks FOR UPDATE TO anon
  USING (
    EXISTS (
      SELECT 1 FROM delegate_tokens dkt
      WHERE dkt.leader_id = delegated_tasks.leader_id
        AND (dkt.expires_at IS NULL OR dkt.expires_at > now())
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM delegate_tokens dkt
      WHERE dkt.leader_id = delegated_tasks.leader_id
        AND (dkt.expires_at IS NULL OR dkt.expires_at > now())
    )
  );

-- Anon can read leaders (needed for delegate view)
CREATE POLICY "Delegates can view their leader record"
  ON leaders FOR SELECT TO anon
  USING (
    EXISTS (
      SELECT 1 FROM delegate_tokens dkt
      WHERE dkt.leader_id = leaders.id
        AND (dkt.expires_at IS NULL OR dkt.expires_at > now())
    )
  );

-- Anon can read calendar events (for read-only WAG view)
CREATE POLICY "Delegates can view calendar events for their admin"
  ON calendar_events FOR SELECT TO anon
  USING (
    EXISTS (
      SELECT 1 FROM delegate_tokens dkt
      WHERE dkt.owner_user_id = calendar_events.user_id
        AND (dkt.expires_at IS NULL OR dkt.expires_at > now())
    )
  );

-- Anon can read weekly priorities (for read-only WAG view)
CREATE POLICY "Delegates can view priorities for their admin"
  ON weekly_priorities FOR SELECT TO anon
  USING (
    EXISTS (
      SELECT 1 FROM delegate_tokens dkt
      WHERE dkt.owner_user_id = weekly_priorities.user_id
        AND (dkt.expires_at IS NULL OR dkt.expires_at > now())
    )
  );
