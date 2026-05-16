// Обновлённая Edge Function send-reminders
// Деплой: Supabase Dashboard → Edge Functions → send-reminders → редактировать код
// Или через CLI: supabase functions deploy send-reminders

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const ONESIGNAL_APP_ID = '1d084c89-fe5e-43e2-9a91-fee2f37ed467';
const ONESIGNAL_REST_KEY = Deno.env.get('ONESIGNAL_REST_KEY') ?? '';

Deno.serve(async (req) => {
  try {
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
    );

    // Берём пользователей у которых: уведомления включены + есть время напоминания
    const { data: users, error } = await supabase
      .from('users')
      .select('id, email, reminder_time, notification_channel')
      .eq('notifications_enabled', true)
      .not('reminder_time', 'is', null);

    if (error) throw error;

    const nowUTC = new Date();
    const nowMoscow = new Date(nowUTC.getTime() + 3 * 60 * 60 * 1000);
    const currentHour = nowMoscow.getUTCHours();
    const currentMin  = nowMoscow.getUTCMinutes();

    const results = [];

    for (const user of users ?? []) {
      const [h, m] = (user.reminder_time as string).split(':').map(Number);
      // Срабатываем в нужный час (в пределах текущей минуты)
      if (h !== currentHour || Math.abs(m - currentMin) > 1) continue;

      // Проверяем есть ли невыполненные привычки сегодня
      const today = nowMoscow.toISOString().split('T')[0];
      const { data: habits } = await supabase
        .from('habits')
        .select('id, title')
        .eq('user_id', user.id)
        .eq('is_active', true);

      if (!habits || habits.length === 0) continue;

      const { data: progress } = await supabase
        .from('habit_progress')
        .select('habit_id')
        .eq('user_id', user.id)
        .eq('completed_date', today)
        .eq('is_completed', true);

      const doneIds = new Set((progress ?? []).map((p: any) => p.habit_id));
      const undone = habits.filter((h: any) => !doneIds.has(h.id));
      if (undone.length === 0) continue;

      const habitList = undone.map((h: any) => `• ${h.title}`).join('\n');

      const channel = user.notification_channel ?? 'email';

      if (channel === 'push') {
        // Отправляем через OneSignal
        const body = {
          app_id: ONESIGNAL_APP_ID,
          target_channel: 'push',
          include_aliases: { external_id: [user.id] },
          headings: { en: '🔥 Не забудь про привычки сегодня!', ru: '🔥 Не забудь про привычки сегодня!' },
          contents: {
            en: `Ты ещё не выполнил:\n${habitList}\nТы справишься! 💪`,
            ru: `Ты ещё не выполнил:\n${habitList}\nТы справишься! 💪`,
          },
        };

        const res = await fetch('https://onesignal.com/api/v1/notifications', {
          method: 'POST',
          headers: {
            'Authorization': `Key ${ONESIGNAL_REST_KEY}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(body),
        });
        results.push({ user: user.email, channel: 'push', status: res.status });
      } else {
        // Email — логика остаётся прежней (вызываем Resend или Supabase mailer)
        const { error: mailError } = await supabase.functions.invoke('notify-habit-complete', {
          body: { userId: user.id, habits: undone },
        });
        results.push({ user: user.email, channel: 'email', error: mailError?.message });
      }
    }

    return new Response(JSON.stringify({ ok: true, results }), {
      headers: { 'Content-Type': 'application/json' },
    });
  } catch (err: any) {
    return new Response(JSON.stringify({ error: err.message }), { status: 500 });
  }
});
