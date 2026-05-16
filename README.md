# DoubleDo

Приложение для отслеживания привычек с соревновательным режимом. Создай привычку, пригласи друга и соревнуйтесь — кто дольше продержится.

**Live:** [doubledo.vercel.app](https://doubledo.vercel.app)

---

## Стек

| Слой | Технология |
|------|-----------|
| Frontend | React 19, React Router, Vite |
| Backend | Supabase (PostgreSQL, Auth, Edge Functions) |
| Push-уведомления | OneSignal |
| Email | Nodemailer (Gmail SMTP) через Edge Function |
| Деплой | Vercel |

---

## Функциональность

### Привычки
- Создание привычек с датой начала
- Календарный вид прогресса за месяц
- Счётчик серий (streak)
- Отметка выполнения с анимацией

### Соревнования
- Приглашение соперника по ссылке
- Общий счёт и календарь каждого участника
- Бесконечный или ограниченный по дням режим
- Эмодзи-реакции на прогресс соперника
- **Вызов** — push-уведомление сопернику если он не выполнил привычку сегодня (кулдаун 24ч)
- **Пропуск с причиной** — запросить у соперника засчитать пропуск ("Болел", "В дороге", своя причина)

### Уведомления
- Push (OneSignal) или Email на выбор пользователя
- Соперник выполнил привычку
- Соперник пропустил день
- Реакция на пропуск
- Вызов от соперника
- Ответ на запрос пропуска
- Ежедневное напоминание в выбранное время

### Профиль
- Вкладки: Профиль / Уведомления
- Переключение канала уведомлений (Push / Email)
- Настройка времени ежедневного напоминания

---

## Локальный запуск

```bash
git clone https://github.com/<your-org>/doubledo-react
cd doubledo-react
npm install
```

Создай `.env.local`:

```env
VITE_SUPABASE_URL=https://xxxxxxxx.supabase.co
VITE_SUPABASE_ANON_KEY=your_anon_key
VITE_ONESIGNAL_APP_ID=your_onesignal_app_id
```

```bash
npm run dev
```

---

## Supabase

### Таблицы

| Таблица | Назначение |
|---------|-----------|
| `users` | Профили, настройки уведомлений |
| `habits` | Привычки |
| `habit_members` | Участники привычки (owner / participant), связь с соревнованием |
| `habit_progress` | Ежедневный прогресс выполнения |
| `competitions` | Соревнования между двумя пользователями |
| `competition_reactions` | Эмодзи-реакции |
| `competition_provocations` | История вызовов (для кулдауна) |
| `habit_skips` | Запросы на пропуск с причиной |
| `app_secrets` | Ключи API (OneSignal REST key) |

### Ключевые SQL функции

| Функция | Описание |
|---------|---------|
| `mark_competition_habit_complete(habit_id)` | Отметить выполнение + инкремент счёта (idempotent) |
| `unmark_competition_habit_complete(habit_id)` | Отменить выполнение + декремент счёта (idempotent) |
| `send_push_to_user(user_id, title, body)` | Отправить push через OneSignal (pg_net) |
| `notify_rival_habit_complete_push(competition_id, habit_title)` | Push сопернику о выполнении |
| `notify_missed_day_push(competition_id)` | Push сопернику о пропуске дня |
| `notify_reaction_push(competition_id, emoji)` | Push о реакции |
| `send_provocation_push(competition_id)` | Вызов (с кулдауном 24ч) |
| `request_habit_skip(competition_id, date, reason)` | Запрос пропуска |
| `respond_to_skip(skip_id, accepted)` | Принять/отклонить пропуск |
| `get_competition_skips(competition_id)` | Список запросов пропуска |

### Edge Functions

| Функция | Назначение |
|---------|-----------|
| `notify-habit-complete` | Уведомление сопернику о выполнении (push или email в зависимости от канала) |
| `send-reminders` | Ежедневные напоминания о невыполненных привычках |

Актуальные версии Edge Functions:
- [`notify-habit-complete-updated/`](./notify-habit-complete-updated/)
- [`send-reminders-updated/`](./send-reminders-updated/)

### SQL миграции

Применять в Supabase → SQL Editor в следующем порядке:

| Файл | Назначение |
|------|-----------|
| `supabase_push_setup.sql` | OneSignal интеграция, базовые push-функции |
| `supabase_push_cron.sql` | Cron для ежедневных напоминаний |
| `supabase_notif_channel.sql` | Колонка `notification_channel` в `users` |
| `supabase_reminder_no_limit.sql` | Настройка времени напоминания |
| `supabase_fix_score_cheat.sql` | Защита от накрутки очков (idempotent mark/unmark) |
| `supabase_notify_habit_complete_push.sql` | Push при выполнении привычки соперником |
| `supabase_rival_notified_at.sql` | Дедупликация уведомлений о выполнении |
| `supabase_provocations_and_skips.sql` | Вызовы и пропуски с причиной |

---

## Переменные окружения

### Frontend (`.env.local`)

```env
VITE_SUPABASE_URL=
VITE_SUPABASE_ANON_KEY=
VITE_ONESIGNAL_APP_ID=
```

### Edge Functions (Supabase Secrets)

```
SUPABASE_URL
SUPABASE_SERVICE_ROLE_KEY
ONESIGNAL_REST_KEY
SMTP_USERNAME         # Gmail аккаунт
SMTP_PASSWORD         # Gmail App Password
```

---

## PWA

Приложение работает как PWA — устанавливается на iOS и Android через браузер. Иконки и манифест находятся в [`public/`](./public/).

На iOS push-уведомления работают через Safari 16.4+ при установке на домашний экран.
