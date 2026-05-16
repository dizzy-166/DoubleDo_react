-- Запустить в Supabase Dashboard → SQL Editor
ALTER TABLE habit_progress
  ADD COLUMN IF NOT EXISTS rival_notified_at timestamptz;
