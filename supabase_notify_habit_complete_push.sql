-- ============================================================
-- Запустить в Supabase Dashboard → SQL Editor
-- ============================================================

-- Пуш сопернику: "ты выполнил привычку"
-- Вызывается с фронта сразу после mark_competition_habit_complete
create or replace function notify_rival_habit_complete_push(
  p_competition_id uuid,
  p_habit_title    text
) returns void
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  v_caller_id    uuid := auth.uid();
  v_rival_id     uuid;
  v_caller_name  text;
begin
  -- Находим ID соперника
  select
    case
      when user1_id = v_caller_id then user2_id
      else user1_id
    end
  into v_rival_id
  from competitions
  where competition_id = p_competition_id;

  if v_rival_id is null then return; end if;

  -- Берём username того, кто выполнил
  select username into v_caller_name
  from users
  where id = v_caller_id;

  v_caller_name := coalesce(v_caller_name, 'Соперник');

  perform send_push_to_user(
    v_rival_id,
    v_caller_name || ' выполнил привычку! 🔥',
    'Твой соперник ' || v_caller_name || ' выполнил «' || p_habit_title || '». Не отставай — зайди и отметь свою!'
  );
end;
$$;

grant execute on function notify_rival_habit_complete_push(uuid, text) to authenticated;
