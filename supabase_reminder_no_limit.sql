-- Запустить в Supabase → SQL Editor
-- Обновляем функцию set_reminder_time:
-- если канал уведомлений = 'push' — лимит раз в сутки снимается

CREATE OR REPLACE FUNCTION set_reminder_time(p_time time)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_user_id      uuid := auth.uid();
  v_channel      text;
  v_updated_at   timestamptz;
  v_offset       constant interval := interval '3 hours'; -- UTC+3
  v_today        date;
  v_updated_date date;
BEGIN
  SELECT notification_channel, reminder_time_updated_at
    INTO v_channel, v_updated_at
    FROM users
   WHERE id = v_user_id;

  -- Лимит раз в сутки только для email-канала
  IF COALESCE(v_channel, 'email') = 'email' THEN
    v_today        := (NOW() AT TIME ZONE 'UTC' + v_offset)::date;
    v_updated_date := (v_updated_at AT TIME ZONE 'UTC' + v_offset)::date;

    IF v_updated_at IS NOT NULL AND v_updated_date = v_today THEN
      RETURN jsonb_build_object('error', 'ALREADY_UPDATED_TODAY');
    END IF;
  END IF;

  UPDATE users
     SET reminder_time            = p_time,
         reminder_time_updated_at = NOW()
   WHERE id = v_user_id;

  RETURN jsonb_build_object('success', true);
END;
$$;
