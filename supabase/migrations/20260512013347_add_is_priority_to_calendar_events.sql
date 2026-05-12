/*
  # Add is_priority flag to calendar_events

  1. Changes
    - Add `is_priority` boolean column (default false) to calendar_events
    - Allows any calendar event to be flagged as a priority item
    - Priority events are visually highlighted on the calendar grid

  2. No RLS changes needed — existing per-user policies cover this column
*/

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'calendar_events' AND column_name = 'is_priority'
  ) THEN
    ALTER TABLE calendar_events ADD COLUMN is_priority boolean NOT NULL DEFAULT false;
  END IF;
END $$;
