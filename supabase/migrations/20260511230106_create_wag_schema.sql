/*
  # Week at a Glance - Initial Schema

  1. New Tables
    - `calendar_events`
      - `id` (uuid, primary key)
      - `week_start` (date) - Monday of the week
      - `day_of_week` (int) - 0=Mon, 1=Tue, 2=Wed, 3=Thu, 4=Fri
      - `time_slot` (text) - e.g. "7:00 - 7:30"
      - `title` (text)
      - `color_category` (text) - color code category
      - `created_at` (timestamptz)

    - `weekly_priorities`
      - `id` (uuid, primary key)
      - `week_start` (date)
      - `title` (text)
      - `status` (text) - IP, C, or blank
      - `sort_order` (int)
      - `created_at` (timestamptz)

    - `leaders`
      - `id` (uuid, primary key)
      - `name` (text)
      - `role` (text)
      - `created_at` (timestamptz)

    - `delegated_tasks`
      - `id` (uuid, primary key)
      - `leader_id` (uuid, FK to leaders)
      - `title` (text)
      - `description` (text)
      - `due_date` (date)
      - `status` (text) - pending, in_progress, completed
      - `week_start` (date)
      - `created_at` (timestamptz)

  2. Security
    - RLS enabled on all tables
    - Public read/write policies (no auth required for this app)
*/

CREATE TABLE IF NOT EXISTS calendar_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  week_start date NOT NULL,
  day_of_week int NOT NULL CHECK (day_of_week BETWEEN 0 AND 4),
  time_slot text NOT NULL,
  title text NOT NULL DEFAULT '',
  color_category text NOT NULL DEFAULT '',
  created_at timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS weekly_priorities (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  week_start date NOT NULL,
  title text NOT NULL,
  status text NOT NULL DEFAULT '',
  sort_order int NOT NULL DEFAULT 0,
  created_at timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS leaders (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  role text NOT NULL DEFAULT '',
  created_at timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS delegated_tasks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  leader_id uuid REFERENCES leaders(id) ON DELETE CASCADE,
  title text NOT NULL,
  description text NOT NULL DEFAULT '',
  due_date date,
  status text NOT NULL DEFAULT 'pending',
  week_start date,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE calendar_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE weekly_priorities ENABLE ROW LEVEL SECURITY;
ALTER TABLE leaders ENABLE ROW LEVEL SECURITY;
ALTER TABLE delegated_tasks ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow public read calendar_events"
  ON calendar_events FOR SELECT TO anon USING (true);

CREATE POLICY "Allow public insert calendar_events"
  ON calendar_events FOR INSERT TO anon WITH CHECK (true);

CREATE POLICY "Allow public update calendar_events"
  ON calendar_events FOR UPDATE TO anon USING (true) WITH CHECK (true);

CREATE POLICY "Allow public delete calendar_events"
  ON calendar_events FOR DELETE TO anon USING (true);

CREATE POLICY "Allow public read weekly_priorities"
  ON weekly_priorities FOR SELECT TO anon USING (true);

CREATE POLICY "Allow public insert weekly_priorities"
  ON weekly_priorities FOR INSERT TO anon WITH CHECK (true);

CREATE POLICY "Allow public update weekly_priorities"
  ON weekly_priorities FOR UPDATE TO anon USING (true) WITH CHECK (true);

CREATE POLICY "Allow public delete weekly_priorities"
  ON weekly_priorities FOR DELETE TO anon USING (true);

CREATE POLICY "Allow public read leaders"
  ON leaders FOR SELECT TO anon USING (true);

CREATE POLICY "Allow public insert leaders"
  ON leaders FOR INSERT TO anon WITH CHECK (true);

CREATE POLICY "Allow public update leaders"
  ON leaders FOR UPDATE TO anon USING (true) WITH CHECK (true);

CREATE POLICY "Allow public delete leaders"
  ON leaders FOR DELETE TO anon USING (true);

CREATE POLICY "Allow public read delegated_tasks"
  ON delegated_tasks FOR SELECT TO anon USING (true);

CREATE POLICY "Allow public insert delegated_tasks"
  ON delegated_tasks FOR INSERT TO anon WITH CHECK (true);

CREATE POLICY "Allow public update delegated_tasks"
  ON delegated_tasks FOR UPDATE TO anon USING (true) WITH CHECK (true);

CREATE POLICY "Allow public delete delegated_tasks"
  ON delegated_tasks FOR DELETE TO anon USING (true);

INSERT INTO leaders (name, role) VALUES
  ('Taylor', 'Team Leader'),
  ('Umbel', 'Team Leader'),
  ('SGA', 'Student Government Association')
ON CONFLICT DO NOTHING;
