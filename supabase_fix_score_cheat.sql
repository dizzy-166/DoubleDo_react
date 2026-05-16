-- ============================================================
-- Фикс накрутки очков: idempotent mark/unmark функции
-- Запустить в Supabase Dashboard → SQL Editor
-- ============================================================

-- Уникальный индекс чтобы не было дублей строк за один день
-- (если уже есть — просто пропустит)
ALTER TABLE habit_progress
  DROP CONSTRAINT IF EXISTS habit_progress_unique_per_day;

ALTER TABLE habit_progress
  ADD CONSTRAINT habit_progress_unique_per_day
  UNIQUE (habit_id, user_id, completed_date);

-- ============================================================
-- mark_competition_habit_complete
-- Инкрементирует счёт ТОЛЬКО если привычка не была отмечена сегодня
-- ============================================================
DROP FUNCTION IF EXISTS mark_competition_habit_complete(uuid);
CREATE FUNCTION mark_competition_habit_complete(p_habit_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id        uuid := auth.uid();
  v_today          date := (NOW() AT TIME ZONE 'Europe/Moscow')::date;
  v_competition_id uuid;
  v_already_done   boolean;
  v_is_user1       boolean;
BEGIN
  -- competition_id хранится в habit_members
  SELECT competition_id INTO v_competition_id
  FROM habit_members
  WHERE habit_id = p_habit_id AND user_id = v_user_id;

  IF v_competition_id IS NULL THEN RETURN; END IF;

  -- Текущее состояние за сегодня
  SELECT is_completed INTO v_already_done
  FROM habit_progress
  WHERE habit_id = p_habit_id
    AND user_id = v_user_id
    AND completed_date = v_today;

  -- Уже засчитано — ничего не делаем (idempotent)
  IF v_already_done IS TRUE THEN RETURN; END IF;

  -- Upsert прогресса
  INSERT INTO habit_progress (habit_id, user_id, completed_date, is_completed)
  VALUES (p_habit_id, v_user_id, v_today, true)
  ON CONFLICT (habit_id, user_id, completed_date)
  DO UPDATE SET is_completed = true;

  -- Инкремент очков только один раз за день
  SELECT (user1_id = v_user_id) INTO v_is_user1
  FROM competitions WHERE id = v_competition_id;

  IF v_is_user1 THEN
    UPDATE competitions
      SET user1_score = user1_score + 1
      WHERE id = v_competition_id;
  ELSE
    UPDATE competitions
      SET user2_score = user2_score + 1
      WHERE id = v_competition_id;
  END IF;
END;
$$;

GRANT EXECUTE ON FUNCTION mark_competition_habit_complete(uuid) TO authenticated;

-- ============================================================
-- unmark_competition_habit_complete
-- Декрементирует счёт ТОЛЬКО если привычка реально была отмечена сегодня
-- ============================================================
DROP FUNCTION IF EXISTS unmark_competition_habit_complete(uuid);
CREATE FUNCTION unmark_competition_habit_complete(p_habit_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id        uuid := auth.uid();
  v_today          date := (NOW() AT TIME ZONE 'Europe/Moscow')::date;
  v_competition_id uuid;
  v_was_done       boolean;
  v_is_user1       boolean;
BEGIN
  SELECT competition_id INTO v_competition_id
  FROM habit_members
  WHERE habit_id = p_habit_id AND user_id = v_user_id;

  IF v_competition_id IS NULL THEN RETURN; END IF;

  SELECT is_completed INTO v_was_done
  FROM habit_progress
  WHERE habit_id = p_habit_id
    AND user_id = v_user_id
    AND completed_date = v_today;

  -- Не была отмечена — ничего не делаем (idempotent)
  IF v_was_done IS NOT TRUE THEN RETURN; END IF;

  UPDATE habit_progress
    SET is_completed = false
    WHERE habit_id = p_habit_id
      AND user_id = v_user_id
      AND completed_date = v_today;

  -- Декремент, но не ниже 0
  SELECT (user1_id = v_user_id) INTO v_is_user1
  FROM competitions WHERE id = v_competition_id;

  IF v_is_user1 THEN
    UPDATE competitions
      SET user1_score = GREATEST(0, user1_score - 1)
      WHERE id = v_competition_id;
  ELSE
    UPDATE competitions
      SET user2_score = GREATEST(0, user2_score - 1)
      WHERE id = v_competition_id;
  END IF;
END;
$$;

GRANT EXECUTE ON FUNCTION unmark_competition_habit_complete(uuid) TO authenticated;
