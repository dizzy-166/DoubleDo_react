-- ============================================================
-- Запустить в Supabase Dashboard → SQL Editor
-- ============================================================

-- 1. Включаем расширение pg_net (для HTTP-запросов из SQL)
create extension if not exists pg_net schema extensions;

-- 2. Таблица для хранения секретов
create table if not exists app_secrets (
  key  text primary key,
  value text not null
);

-- Даём доступ только серверным функциям (не анонимным пользователям)
revoke all on app_secrets from anon, authenticated;

-- 3. Сохраняем OneSignal REST API ключ
insert into app_secrets (key, value)
values ('onesignal_rest_key', 'YOUR_ONESIGNAL_REST_KEY')
on conflict (key) do update set value = excluded.value;

-- ============================================================
-- 4. Базовая функция отправки пуша конкретному пользователю
-- ============================================================
create or replace function send_push_to_user(
  p_user_id  uuid,
  p_title    text,
  p_body     text
) returns void
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  v_api_key text;
  v_app_id  text := '1d084c89-fe5e-43e2-9a91-fee2f37ed467';
begin
  select value into v_api_key from app_secrets where key = 'onesignal_rest_key';
  if v_api_key is null then return; end if;

  perform extensions.http_post(
    url     := 'https://onesignal.com/api/v1/notifications',
    headers := jsonb_build_object(
      'Authorization', 'Key ' || v_api_key,
      'Content-Type',  'application/json'
    ),
    body := jsonb_build_object(
      'app_id',          v_app_id,
      'target_channel',  'push',
      'include_aliases', jsonb_build_object('external_id', jsonb_build_array(p_user_id::text)),
      'headings',        jsonb_build_object('en', p_title, 'ru', p_title),
      'contents',        jsonb_build_object('en', p_body,  'ru', p_body)
    )::text
  );
end;
$$;

-- ============================================================
-- 5. Пуш сопернику: "ты пропустил день"
--    Вызывается с фронта когда текущий юзер открывает приложение
--    и мы обнаруживаем, что он сам пропустил вчера.
-- ============================================================
create or replace function notify_missed_day_push(
  p_competition_id uuid
) returns void
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  v_caller_id  uuid := auth.uid();
  v_friend_id  uuid;
begin
  -- Находим ID соперника в этом соревновании
  select
    case
      when user1_id = v_caller_id then user2_id
      else user1_id
    end
  into v_friend_id
  from competitions
  where competition_id = p_competition_id;   -- если колонка называется "id", замени на: where id = p_competition_id

  if v_friend_id is null then return; end if;

  perform send_push_to_user(
    v_friend_id,
    'Соперник пропустил! 😏',
    'Твой соперник не выполнил вчера задание. Зайди и отправь реакцию!'
  );
end;
$$;

grant execute on function notify_missed_day_push(uuid) to authenticated;

-- ============================================================
-- 6. Пуш сопернику: "тебе прилетела реакция"
-- ============================================================
create or replace function notify_reaction_push(
  p_competition_id uuid,
  p_emoji          text
) returns void
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  v_caller_id  uuid := auth.uid();
  v_friend_id  uuid;
begin
  select
    case
      when user1_id = v_caller_id then user2_id
      else user1_id
    end
  into v_friend_id
  from competitions
  where competition_id = p_competition_id;   -- если колонка называется "id", замени на: where id = p_competition_id

  if v_friend_id is null then return; end if;

  perform send_push_to_user(
    v_friend_id,
    'Тебе прилетела реакция ' || p_emoji,
    'Соперник отправил тебе ' || p_emoji || ' — зайди посмотреть!'
  );
end;
$$;

grant execute on function notify_reaction_push(uuid, text) to authenticated;
