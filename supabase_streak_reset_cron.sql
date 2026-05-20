-- ============================================================
-- Настройка pg_cron для ежедневного сброса стриков
-- Запустить один раз в SQL-редакторе Supabase
-- ============================================================

-- 1. Убедимся, что расширение pg_cron включено
--    (обычно уже включено на Supabase)
CREATE EXTENSION IF NOT EXISTS pg_cron;

-- 2. Удаляем старое задание (на случай повторного запуска)
SELECT cron.unschedule('reset-missed-streaks')
WHERE EXISTS (
  SELECT 1 FROM cron.job WHERE jobname = 'reset-missed-streaks'
);

-- 3. Создаём задание: каждый день в 00:05 UTC
--    Небольшая задержка (05 минут) даёт Supabase время
--    завершить транзакции конца предыдущего дня.
SELECT cron.schedule(
  'reset-missed-streaks',   -- имя задания
  '5 0 * * *',              -- cron-выражение: 00:05 UTC каждый день
  $$SELECT reset_missed_streaks()$$
);

-- 4. Проверяем, что задание создано
SELECT jobid, jobname, schedule, command, active
FROM cron.job
WHERE jobname = 'reset-missed-streaks';
