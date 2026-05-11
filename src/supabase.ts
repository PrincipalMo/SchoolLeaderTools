import { createClient } from '@supabase/supabase-js'

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL as string
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_SUPABASE_ANON_KEY as string

export const supabase = createClient(supabaseUrl, supabaseAnonKey)

export type ColorCategory =
  | 'check-ins'
  | 'admin'
  | 'instruction'
  | 'family-engagement'
  | 'supervision'
  | 'out-of-building'
  | 'discipline'
  | 'climate'
  | 'personal'
  | ''

export interface CalendarEvent {
  id: string
  week_start: string
  day_of_week: number
  time_slot: string
  title: string
  color_category: ColorCategory
  created_at: string
}

export interface WeeklyPriority {
  id: string
  week_start: string
  title: string
  status: string
  sort_order: number
  created_at: string
}

export interface Leader {
  id: string
  name: string
  role: string
  created_at: string
}

export interface DelegatedTask {
  id: string
  leader_id: string
  title: string
  description: string
  due_date: string | null
  status: 'pending' | 'in_progress' | 'completed'
  week_start: string | null
  created_at: string
}
