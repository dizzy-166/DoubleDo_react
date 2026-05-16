-- ============================================================
-- Провокации и пропуски по причине
-- Запустить в Supabase Dashboard → SQL Editor
-- ============================================================

-- Таблица провокаций (для кулдауна 24ч)
CREATE TABLE IF NOT EXISTS competition_provocations (
  id            uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  competition_id uuid REFERENCES competitions(id) ON DELETE CASCADE,
  sender_id     uuid REFERENCES users(id),
  created_at    timestamptz DEFAULT NOW()
);

-- Таблица запросов на пропуск
CREATE TABLE IF NOT EXISTS habit_skips (
  id             uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  competition_id uuid REFERENCES competitions(id) ON DELETE CASCADE,
  requester_id   uuid REFERENCES users(id),
  skip_date      date NOT NULL,
  reason         text NOT NULL,
  status         text DEFAULT 'pending' CHECK (status IN ('pending', 'accepted', 'rejected')),
  created_at     timestamptz DEFAULT NOW(),
  reviewed_at    timestamptz,
  UNIQUE (competition_id, requester_id, skip_date)
);

-- ============================================================
-- send_provocation_push: отправить вызов сопернику (кулдаун 24ч)
-- ============================================================
CREATE OR REPLACE FUNCTION send_provocation_push(p_competition_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_sender_id   uuid := auth.uid();
  v_rival_id    uuid;
  v_sender_name text;
  v_last_prov   timestamptz;
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

  INSERT INTO competition_provocations (competition_id, sender_id)
  VALUES (p_competition_id, v_sender_id);

  PERFORM send_push_to_user(
    v_rival_id,
    v_sender_name || ' бросает тебе вызов! 🔥',
    'Иди выполни привычку — не дай ему обогнать тебя!'
  );

  RETURN jsonb_build_object('success', true);
END;
$$;

-- ============================================================
-- request_habit_skip: запросить пропуск с причиной
-- ============================================================
CREATE OR REPLACE FUNCTION request_habit_skip(
  p_competition_id uuid,
  p_skip_date      date,
  p_reason         text
) RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id   uuid := auth.uid();
  v_rival_id  uuid;
  v_user_name text;
  v_skip_id   uuid;
BEGIN
  SELECT CASE WHEN user1_id = v_user_id THEN user2_id ELSE user1_id END
  INTO v_rival_id
  FROM competitions WHERE id = p_competition_id;

  IF v_rival_id IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'not_found');
  END IF;

  SELECT username INTO v_user_name FROM users WHERE id = v_user_id;
  v_user_name := COALESCE(v_user_name, 'Соперник');

  INSERT INTO habit_skips (competition_id, requester_id, skip_date, reason)
  VALUES (p_competition_id, v_user_id, p_skip_date, p_reason)
  ON CONFLICT (competition_id, requester_id, skip_date)
  DO UPDATE SET reason = EXCLUDED.reason, status = 'pending', reviewed_at = NULL
  RETURNING id INTO v_skip_id;

  PERFORM send_push_to_user(
    v_rival_id,
    v_user_name || ' просит засчитать пропуск',
    'Причина: ' || p_reason || ' — Зайди и рассмотри запрос'
  );

  RETURN jsonb_build_object('success', true, 'skip_id', v_skip_id);
END;
$$;

-- ============================================================
-- respond_to_skip: принять или отклонить запрос на пропуск
-- ============================================================
CREATE OR REPLACE FUNCTION respond_to_skip(p_skip_id uuid, p_accepted boolean)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id uuid := auth.uid();
  v_skip    habit_skips%ROWTYPE;
BEGIN
  SELECT * INTO v_skip FROM habit_skips WHERE id = p_skip_id;

  IF v_skip.id IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'not_found');
  END IF;
  IF v_skip.requester_id = v_user_id THEN
    RETURN jsonb_build_object('success', false, 'error', 'cannot_review_own');
  END IF;
  IF v_skip.status <> 'pending' THEN
    RETURN jsonb_build_object('success', false, 'error', 'already_reviewed');
  END IF;

  UPDATE habit_skips
  SET status      = CASE WHEN p_accepted THEN 'accepted' ELSE 'rejected' END,
      reviewed_at = NOW()
  WHERE id = p_skip_id;

  PERFORM send_push_to_user(
    v_skip.requester_id,
    CASE WHEN p_accepted THEN 'Пропуск засчитан ✅' ELSE 'Пропуск отклонён ❌' END,
    CASE WHEN p_accepted
      THEN 'Соперник принял твою причину пропуска'
      ELSE 'Соперник не засчитал пропуск'
    END
  );

  RETURN jsonb_build_object('success', true);
END;
$$;

-- ============================================================
-- get_competition_skips: список запросов по соревнованию
-- ============================================================
CREATE OR REPLACE FUNCTION get_competition_skips(p_competition_id uuid)
RETURNS TABLE (
  id                 uuid,
  requester_id       uuid,
  requester_username text,
  skip_date          date,
  reason             text,
  status             text,
  created_at         timestamptz
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN QUERY
  SELECT
    hs.id,
    hs.requester_id,
    u.username AS requester_username,
    hs.skip_date,
    hs.reason,
    hs.status,
    hs.created_at
  FROM habit_skips hs
  JOIN users u ON u.id = hs.requester_id
  WHERE hs.competition_id = p_competition_id
  ORDER BY hs.created_at DESC;
END;
$$;

GRANT EXECUTE ON FUNCTION send_provocation_push(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION request_habit_skip(uuid, date, text) TO authenticated;
GRANT EXECUTE ON FUNCTION respond_to_skip(uuid, boolean) TO authenticated;
GRANT EXECUTE ON FUNCTION get_competition_skips(uuid) TO authenticated;
