-- Запустить в Supabase → SQL Editor

ALTER TABLE users
  ADD COLUMN IF NOT EXISTS notification_channel text DEFAULT 'email'
  CHECK (notification_channel IN ('email', 'push'));
