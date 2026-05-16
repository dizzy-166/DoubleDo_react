-- Запустить в Supabase → SQL Editor
-- Удаляем все возможные перегрузки функции
DROP FUNCTION IF EXISTS set_reminder_time(time);
DROP FUNCTION IF EXISTS set_reminder_time(text);
DROP FUNCTION IF EXISTS set_reminder_time(time without time zone);

-- Создаём одну правильную версию (text — безопаснее для Supabase RPC)
CREATE FUNCTION set_reminder_time(p_time text)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_user_id      uuid := auth.uid();
  v_channel      text;
  v_updated_at   timestamptz;
  v_offset       constant interval := interval '3 hours';
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
     SET reminder_time = CASE
                           WHEN p_time IS NULL OR p_time = '' THEN NULL
                           ELSE p_time::time
                         END,
         reminder_time_updated_at = NOW()
   WHERE id = v_user_id;

  RETURN jsonb_build_object('success', true);
END;
$$;
