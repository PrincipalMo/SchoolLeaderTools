/*
  # Add user scoping and iCal import support

  1. Changes
    - Add `user_id` column to calendar_events, weekly_priorities, leaders, delegated_tasks
    - Add `source` column to calendar_events: 'manual' | 'imported'
    - Add `external_uid` to calendar_events for deduplication of imported events
    - Add `ical_feeds` table to store saved calendar import URLs per user
    - Add `activity_log` table to track all changes (downloadable record)
    - Drop old permissive anon policies, replace with auth.uid()-scoped policies

  2. Security
    - All tables now require authenticated users
    - Each row is owned by the user who created it
*/

-- Add user_id to calendar_events
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'calendar_events' AND column_name = 'user_id'
  ) THEN
    ALTER TABLE calendar_events ADD COLUMN user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'calendar_events' AND column_name = 'source'
  ) THEN
    ALTER TABLE calendar_events ADD COLUMN source text NOT NULL DEFAULT 'manual';
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'calendar_events' AND column_name = 'external_uid'
  ) THEN
    ALTER TABLE calendar_events ADD COLUMN external_uid text;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'calendar_events' AND column_name = 'start_time'
  ) THEN
    ALTER TABLE calendar_events ADD COLUMN start_time timestamptz;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'calendar_events' AND column_name = 'end_time'
  ) THEN
    ALTER TABLE calendar_events ADD COLUMN end_time timestamptz;
  END IF;
END $$;

-- Add user_id to weekly_priorities
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'weekly_priorities' AND column_name = 'user_id'
  ) THEN
    ALTER TABLE weekly_priorities ADD COLUMN user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE;
  END IF;
END $$;

-- Add user_id to leaders
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'leaders' AND column_name = 'user_id'
  ) THEN
    ALTER TABLE leaders ADD COLUMN user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE;
  END IF;
END $$;

-- Add user_id to delegated_tasks
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'delegated_tasks' AND column_name = 'user_id'
  ) THEN
    ALTER TABLE delegated_tasks ADD COLUMN user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE;
  END IF;
END $$;

-- iCal feeds table
CREATE TABLE IF NOT EXISTS ical_feeds (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name text NOT NULL,
  url text NOT NULL,
  last_synced_at timestamptz,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE ical_feeds ENABLE ROW LEVEL SECURITY;

-- Activity log table
CREATE TABLE IF NOT EXISTS activity_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  action text NOT NULL,
  entity_type text NOT NULL,
  entity_id text,
  details jsonb,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE activity_log ENABLE ROW LEVEL SECURITY;

-- Drop old anon policies on all tables
DROP POLICY IF EXISTS "Allow public read calendar_events" ON calendar_events;
DROP POLICY IF EXISTS "Allow public insert calendar_events" ON calendar_events;
DROP POLICY IF EXISTS "Allow public update calendar_events" ON calendar_events;
DROP POLICY IF EXISTS "Allow public delete calendar_events" ON calendar_events;

DROP POLICY IF EXISTS "Allow public read weekly_priorities" ON weekly_priorities;
DROP POLICY IF EXISTS "Allow public insert weekly_priorities" ON weekly_priorities;
DROP POLICY IF EXISTS "Allow public update weekly_priorities" ON weekly_priorities;
DROP POLICY IF EXISTS "Allow public delete weekly_priorities" ON weekly_priorities;

DROP POLICY IF EXISTS "Allow public read leaders" ON leaders;
DROP POLICY IF EXISTS "Allow public insert leaders" ON leaders;
DROP POLICY IF EXISTS "Allow public update leaders" ON leaders;
DROP POLICY IF EXISTS "Allow public delete leaders" ON leaders;

DROP POLICY IF EXISTS "Allow public read delegated_tasks" ON delegated_tasks;
DROP POLICY IF EXISTS "Allow public insert delegated_tasks" ON delegated_tasks;
DROP POLICY IF EXISTS "Allow public update delegated_tasks" ON delegated_tasks;
DROP POLICY IF EXISTS "Allow public delete delegated_tasks" ON delegated_tasks;

-- calendar_events policies
CREATE POLICY "Users can view own calendar events"
  ON calendar_events FOR SELECT TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own calendar events"
  ON calendar_events FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own calendar events"
  ON calendar_events FOR UPDATE TO authenticated
  USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete own calendar events"
  ON calendar_events FOR DELETE TO authenticated
  USING (auth.uid() = user_id);

-- weekly_priorities policies
CREATE POLICY "Users can view own priorities"
  ON weekly_priorities FOR SELECT TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own priorities"
  ON weekly_priorities FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own priorities"
  ON weekly_priorities FOR UPDATE TO authenticated
  USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete own priorities"
  ON weekly_priorities FOR DELETE TO authenticated
  USING (auth.uid() = user_id);

-- leaders policies
CREATE POLICY "Users can view own leaders"
  ON leaders FOR SELECT TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own leaders"
  ON leaders FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own leaders"
  ON leaders FOR UPDATE TO authenticated
  USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete own leaders"
  ON leaders FOR DELETE TO authenticated
  USING (auth.uid() = user_id);

-- delegated_tasks policies
CREATE POLICY "Users can view own tasks"
  ON delegated_tasks FOR SELECT TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own tasks"
  ON delegated_tasks FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own tasks"
  ON delegated_tasks FOR UPDATE TO authenticated
  USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete own tasks"
  ON delegated_tasks FOR DELETE TO authenticated
  USING (auth.uid() = user_id);

-- ical_feeds policies
CREATE POLICY "Users can view own feeds"
  ON ical_feeds FOR SELECT TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own feeds"
  ON ical_feeds FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own feeds"
  ON ical_feeds FOR UPDATE TO authenticated
  USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete own feeds"
  ON ical_feeds FOR DELETE TO authenticated
  USING (auth.uid() = user_id);

-- activity_log policies
CREATE POLICY "Users can view own activity"
  ON activity_log FOR SELECT TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own activity"
  ON activity_log FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = user_id);
