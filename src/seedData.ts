import { supabase, ColorCategory } from './supabase'

// The one week that has sample data pre-loaded
export const SEED_WEEK = '2026-05-04'

export const TIME_SLOTS = [
  '7:00 - 7:30',
  '7:30 - 8:00',
  '8:00 - 8:30',
  '8:30 - 9:00',
  '9:00 - 9:30',
  '9:30 - 10:00',
  '10:00 - 10:30',
  '10:30 - 11:00',
  '11:00 - 11:30',
  '11:30 - 12:00',
  '12:00 - 12:30',
  '12:30 - 1:00',
  '1:00 - 1:30',
  '1:30 - 2:00',
  '2:00 - 2:30',
  '2:30 - 3:00',
  '3:00 - 3:30',
  '3:30 - 4:00',
  '4:00 - 4:30',
  '4:30 - 5:00',
]

type EventEntry = { title: string; category: ColorCategory }

const calendarData: Record<number, Record<number, EventEntry>> = {
  0: {
    1: { title: 'Morning Entry', category: 'admin' },
    2: { title: 'Rounds', category: 'admin' },
    3: { title: 'TAW Coverage', category: 'instruction' },
    4: { title: 'TAW Coverage', category: 'instruction' },
    5: { title: 'Office', category: 'admin' },
    6: { title: 'Office', category: 'admin' },
    7: { title: 'Supervision', category: 'supervision' },
    8: { title: 'TAW Notes for Teachers', category: 'admin' },
    11: { title: 'Lunch Detention', category: 'discipline' },
    12: { title: '8th Grade', category: 'instruction' },
    13: { title: '8th Grade', category: 'instruction' },
    14: { title: '8th Grade', category: 'instruction' },
    15: { title: 'Dismissal', category: 'supervision' },
    16: { title: 'Interview', category: 'admin' },
    18: { title: 'Interview', category: 'admin' },
  },
  1: {
    0: { title: '504/SST', category: 'admin' },
    1: { title: 'Morning Entry', category: 'admin' },
    2: { title: 'Rounds', category: 'admin' },
    3: { title: 'Cover Class', category: 'instruction' },
    4: { title: 'Meeting with NWEA', category: 'admin' },
    5: { title: 'Testing Hallway Supervision', category: 'supervision' },
    6: { title: 'Classrooms', category: 'admin' },
    8: { title: 'Standing Meeting with Taylor', category: 'check-ins' },
    11: { title: 'Lunch Detention', category: 'discipline' },
    12: { title: 'Deliver gifts', category: 'climate' },
    13: { title: 'Deliver gifts', category: 'climate' },
    14: { title: 'Room Service Delivery', category: 'climate' },
    15: { title: 'Dismissal', category: 'supervision' },
    16: { title: 'Interview', category: 'admin' },
    19: { title: 'School Family Community Council', category: 'family-engagement' },
  },
  2: {
    0: { title: 'IEP', category: 'admin' },
    1: { title: 'Morning Entry', category: 'admin' },
    2: { title: 'Rounds', category: 'admin' },
    3: { title: 'Cover Class', category: 'instruction' },
    4: { title: 'Cover Class', category: 'instruction' },
    5: { title: 'Testing Hallway Supervision', category: 'supervision' },
    6: { title: 'Deliver gifts', category: 'climate' },
    7: { title: 'Deliver gifts', category: 'climate' },
    8: { title: 'Reconciliation Meeting', category: 'admin' },
    9: { title: 'Classrooms', category: 'admin' },
    11: { title: 'Lunch Detention', category: 'discipline' },
    12: { title: '8th Grade', category: 'instruction' },
    13: { title: '8th Grade', category: 'instruction' },
    14: { title: 'Standing Meeting with Umbel', category: 'check-ins' },
    15: { title: 'Dismissal', category: 'supervision' },
    16: { title: 'MUSL Meeting', category: 'admin' },
  },
  3: {
    0: { title: 'CP/ Team', category: 'admin' },
    1: { title: 'Morning Entry', category: 'admin' },
    2: { title: 'Rounds', category: 'admin' },
    3: { title: 'Cover Class', category: 'instruction' },
    4: { title: 'Cover Class', category: 'instruction' },
    5: { title: 'Observe Demo Lesson', category: 'instruction' },
    6: { title: 'Observe Demo Lesson', category: 'instruction' },
    7: { title: 'Hallway Supervision', category: 'supervision' },
    8: { title: '4th Grade Meeting', category: 'admin' },
    9: { title: '4th Grade Meeting', category: 'admin' },
    11: { title: 'Meeting with SGA', category: 'check-ins' },
    12: { title: '8th Grade', category: 'instruction' },
    13: { title: '8th Grade', category: 'instruction' },
    14: { title: '8th Grade', category: 'instruction' },
    15: { title: 'Dismissal', category: 'supervision' },
  },
  4: {
    1: { title: 'Morning Entry', category: 'admin' },
    2: { title: 'Rounds', category: 'admin' },
    3: { title: 'Surprise for Teachers w/ SGA', category: 'climate' },
    4: { title: 'Cover Class', category: 'instruction' },
    5: { title: 'Cover Class', category: 'instruction' },
    6: { title: 'IEP Meeting', category: 'admin' },
    7: { title: 'Deliver gifts', category: 'climate' },
    8: { title: 'Deliver gifts', category: 'climate' },
    9: { title: 'Deliver gifts', category: 'climate' },
    11: { title: 'Lunch Detention', category: 'discipline' },
    12: { title: 'Supervision/Kona Ice', category: 'supervision' },
    13: { title: 'Supervision/Kona Ice', category: 'supervision' },
    14: { title: 'Deliver gifts', category: 'climate' },
    15: { title: 'Dismissal', category: 'supervision' },
  },
}

const priorities = [
  { title: 'Master Schedule Submission', status: 'IP', sort_order: 0 },
  { title: 'Hiring', status: 'IP', sort_order: 1 },
  { title: 'Board Report (Make up and the new one)', status: 'IP', sort_order: 2 },
  { title: 'Field Day Communication', status: 'C', sort_order: 3 },
  { title: 'TAW tasks', status: '', sort_order: 4 },
  { title: '8th grade planning', status: '', sort_order: 5 },
  { title: 'Informals/ Formals', status: '', sort_order: 6 },
  { title: 'Parent Contact', status: '', sort_order: 7 },
]

// Seeds sample data for the May 4 week only — called once per user
export async function seedWeekData(userId: string) {
  const { data: existing } = await supabase
    .from('calendar_events')
    .select('id')
    .eq('week_start', SEED_WEEK)
    .eq('user_id', userId)
    .limit(1)

  if (existing && existing.length > 0) return

  const events: object[] = []
  for (const [dayStr, slots] of Object.entries(calendarData)) {
    const day = parseInt(dayStr)
    for (const [slotStr, entry] of Object.entries(slots)) {
      const slotIdx = parseInt(slotStr)
      events.push({
        user_id: userId,
        week_start: SEED_WEEK,
        day_of_week: day,
        time_slot: TIME_SLOTS[slotIdx],
        title: entry.title,
        color_category: entry.category,
        source: 'manual',
      })
    }
  }
  await supabase.from('calendar_events').insert(events)

  const { data: existingPriorities } = await supabase
    .from('weekly_priorities')
    .select('id')
    .eq('week_start', SEED_WEEK)
    .eq('user_id', userId)
    .limit(1)

  if (!existingPriorities || existingPriorities.length === 0) {
    await supabase.from('weekly_priorities').insert(
      priorities.map((p) => ({ ...p, user_id: userId, week_start: SEED_WEEK }))
    )
  }

  // Seed default leaders (once per user, not per week)
  const { data: existingLeaders } = await supabase
    .from('leaders')
    .select('id')
    .eq('user_id', userId)
    .limit(1)

  if (!existingLeaders || existingLeaders.length === 0) {
    await supabase.from('leaders').insert([
      { user_id: userId, name: 'Taylor', role: 'Team Leader' },
      { user_id: userId, name: 'Umbel', role: 'Team Leader' },
      { user_id: userId, name: 'SGA', role: 'Student Government Association' },
    ])
  }
}
