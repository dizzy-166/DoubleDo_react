-- ============================================================
-- Настройка: отключить уведомления о вызовах
-- Запустить в Supabase Dashboard → SQL Editor
-- ============================================================

ALTER TABLE users
  ADD COLUMN IF NOT EXISTS provocation_notif_enabled boolean DEFAULT true;

-- Обновляем send_provocation_push: проверяем настройку соперника
CREATE OR REPLACE FUNCTION send_provocation_push(p_competition_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_sender_id            uuid := auth.uid();
  v_rival_id             uuid;
  v_sender_name          text;
  v_last_prov            timestamptz;
  v_rival_notif_enabled  boolean;
BEGIN
  SELECT CASE WHEN user1_id = v_sender_id THEN user2_id ELSE user1_id END
  INTO v_rival_id
  FROM competitions WHERE id = p_competition_id;

  IF v_rival_id IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'not_found');
  END IF;

  SELECT MAX(created_at) INTO v_last_prov
  FROM competition_provocations
  WHERE competition_id = p_competition_id AND sender_id = v_sender_id;

  IF v_last_prov IS NOT NULL AND v_last_prov > NOW() - INTERVAL '24 hours' THEN
    RETURN jsonb_build_object('success', false, 'error', 'cooldown');
  END IF;

  SELECT username INTO v_sender_name FROM users WHERE id = v_sender_id;
  v_sender_name := COALESCE(v_sender_name, 'Соперник');

  -- Записываем вызов в любом случае (для кулдауна)
  INSERT INTO competition_provocations (competition_id, sender_id)
  VALUES (p_competition_id, v_sender_id);

  -- Отправляем пуш только если соперник не отключил уведомления о вызовах
  SELECT COALESCE(provocation_notif_enabled, true) INTO v_rival_notif_enabled
  FROM users WHERE id = v_rival_id;

  IF v_rival_notif_enabled THEN
    PERFORM send_push_to_user(
      v_rival_id,
      v_sender_name || ' бросает тебе вызов! 🔥',
      'Иди выполни привычку — не дай ему обогнать тебя!'
    );
  END IF;

  RETURN jsonb_build_object('success', true);
END;
$$;

GRANT EXECUTE ON FUNCTION send_provocation_push(uuid) TO authenticated;
