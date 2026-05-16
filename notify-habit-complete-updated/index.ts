import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import nodemailer from 'npm:nodemailer@6';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const ONESIGNAL_APP_ID = '1d084c89-fe5e-43e2-9a91-fee2f37ed467';
const ONESIGNAL_REST_KEY = Deno.env.get('ONESIGNAL_REST_KEY') ?? '';

serve(async (req) => {
  if (req.method !== 'POST') return new Response('Method not allowed', { status: 405 });

  const { to, completerName, habitTitle, habitId, userId, completedDate } = await req.json();
  if (!to || !completerName || !habitTitle || !habitId || !userId) {
    return new Response('Missing fields', { status: 400 });
  }

  await new Promise(resolve => setTimeout(resolve, 25000));

  const supabase = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
  );

  // Проверяем что привычка всё ещё выполнена и уведомление ещё не отправлялось сегодня
  const { data: progress } = await supabase
    .from('habit_progress')
    .select('is_completed, rival_notified_at')
    .eq('habit_id', habitId)
    .eq('user_id', userId)
    .eq('completed_date', completedDate)
    .single();

  if (!progress?.is_completed) {
    console.log('Привычка была отменена, уведомление не отправляем');
    return new Response('Skipped (cancelled)', { status: 200 });
  }

  if (progress?.rival_notified_at) {
    console.log('Уведомление уже было отправлено сегодня:', progress.rival_notified_at);
    return new Response('Skipped (already notified)', { status: 200 });
  }

  // Атомарно помечаем что уведомление отправляется — только если ещё не помечено
  // (защита от race condition при двойном нажатии)
  const { data: claimed, error: claimError } = await supabase
    .from('habit_progress')
    .update({ rival_notified_at: new Date().toISOString() })
    .eq('habit_id', habitId)
    .eq('user_id', userId)
    .eq('completed_date', completedDate)
    .is('rival_notified_at', null)
    .select('id');

  if (claimError || !claimed || claimed.length === 0) {
    console.log('Другой вызов уже занял отправку, пропускаем');
    return new Response('Skipped (race)', { status: 200 });
  }

  // Определяем канал уведомлений получателя по его email
  const { data: recipient } = await supabase
    .from('users')
    .select('id, notification_channel')
    .eq('email', to)
    .maybeSingle();

  const channel = recipient?.notification_channel ?? 'email';

  if (channel === 'push' && recipient?.id) {
    const body = {
      app_id: ONESIGNAL_APP_ID,
      target_channel: 'push',
      include_aliases: { external_id: [recipient.id] },
      headings: { en: `${completerName} выполнил привычку! 🔥`, ru: `${completerName} выполнил привычку! 🔥` },
      contents: {
        en: `Твой соперник ${completerName} выполнил «${habitTitle}». Не отставай — зайди и отметь свою!`,
        ru: `Твой соперник ${completerName} выполнил «${habitTitle}». Не отставай — зайди и отметь свою!`,
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

    console.log('Push sent, status:', res.status);
    return new Response('OK (push)', { status: 200 });
  }

  // Fallback: email
  const transporter = nodemailer.createTransport({
    host: 'smtp.gmail.com',
    port: 587,
    secure: false,
    auth: {
      user: Deno.env.get('SMTP_USERNAME'),
      pass: Deno.env.get('SMTP_PASSWORD'),
    },
  });

  try {
    await transporter.sendMail({
      from: `DoubleDo <${Deno.env.get('SMTP_USERNAME')}>`,
      to,
      subject: `${completerName} выполнил привычку!`,
      html: `
        <div style="font-family:sans-serif;max-width:480px;margin:auto;padding:32px">
          <h2 style="color:#667eea">DoubleDo</h2>
          <p>Твой соперник <strong>${completerName}</strong> выполнил привычку <strong>«${habitTitle}»</strong>.</p>
          <p>Не отставай — зайди в приложение и отметь свою привычку!</p>
        </div>
      `,
    });
    return new Response('OK (email)', { status: 200 });
  } catch (err) {
    console.error('Email error:', err);
    return new Response('Email send failed', { status: 500 });
  }
});
