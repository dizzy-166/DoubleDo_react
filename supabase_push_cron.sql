-- Запустить в Supabase → SQL Editor
-- Настраивает push-уведомления через pg_net + pg_cron (без изменения Edge Function)

-- 1. Расширения
CREATE EXTENSION IF NOT EXISTS pg_net  SCHEMA extensions;
CREATE EXTENSION IF NOT EXISTS pg_cron SCHEMA cron;

-- 2. Пересоздаём send_push_to_user с правильным синтаксисом pg_net
CREATE OR REPLACE FUNCTION send_push_to_user(
  p_user_id  uuid,
  p_title    text,
  p_body     text
) RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions
AS $$
DECLARE
  v_api_key text;
  v_app_id  text := '1d084c89-fe5e-43e2-9a91-fee2f37ed467';
BEGIN
  SELECT value INTO v_api_key FROM app_secrets WHERE key = 'onesignal_rest_key';
  IF v_api_key IS NULL THEN RETURN; END IF;

  PERFORM extensions.net.http_post(
    url     := 'https://onesignal.com/api/v1/notifications',
    headers := jsonb_build_object(
      'Authorization', 'Key ' || v_api_key,
      'Content-Type',  'application/json'
    ),
    body    := jsonb_build_object(
      'app_id',          v_app_id,
      'target_channel',  'push',
      'include_aliases', jsonb_build_object('external_id', jsonb_build_array(p_user_id::text)),
      'headings',        jsonb_build_object('en', p_title, 'ru', p_title),
      'contents',        jsonb_build_object('en', p_body,  'ru', p_body)
    )
  );
END;
$$;

-- 3. Функция ежедневных push-напоминаний (запускается каждую минуту pg_cron)
CREATE OR REPLACE FUNCTION send_push_reminders() RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions
AS $$
DECLARE
  u            record;
  v_offset     constant interval := interval '3 hours'; -- UTC+3 (Москва)
  v_now        timestamptz := NOW() AT TIME ZONE 'UTC' + interval '3 hours';
  v_now_time   time        := v_now::time;
  v_today      date        := v_now::date;
BEGIN
  FOR u IN
    SELECT id
    FROM users
    WHERE notifications_enabled   = true
      AND notification_channel    = 'push'
      AND reminder_time           IS NOT NULL
      -- Совпадение с точностью до минуты
      AND to_char(reminder_time, 'HH24:MI') = to_char(v_now_time, 'HH24:MI')
  LOOP
    -- Шлём пуш только если есть невыполненные привычки сегодня
    IF EXISTS (
      SELECT 1 FROM habits h
      WHERE h.user_id   = u.id
        AND h.is_active = true
        AND NOT EXISTS (
          SELECT 1 FROM habit_progress hp
          WHERE hp.habit_id       = h.id
            AND hp.user_id        = u.id
            AND hp.completed_date = v_today
            AND hp.is_completed   = true
        )
    ) THEN
      PERFORM send_push_to_user(
        u.id,
        '🔥 Не забудь про привычки!',
        'У тебя есть невыполненные привычки на сегодня. Зайди и отметь!'
      );
    END IF;
  END LOOP;
END;
$$;

-- 4. Планируем запуск каждую минуту
SELECT cron.unschedule('push-reminders') WHERE EXISTS (
  SELECT 1 FROM cron.job WHERE jobname = 'push-reminders'
);
SELECT cron.schedule(
  'push-reminders',
  '* * * * *',
  'SELECT send_push_reminders()'
);
