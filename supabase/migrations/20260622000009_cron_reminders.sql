-- Cron jobs para lembretes automáticos
-- Requer pg_cron ativado em Database → Extensions

-- 1. Questionário fechando: todo dia às 9h (horário UTC = 12h Brasília)
SELECT cron.schedule(
  'reminder-quiz-closing',
  '0 12 * * *',
  $$
    SELECT net.http_post(
      url := current_setting('app.supabase_url') || '/functions/v1/send-reminders',
      headers := jsonb_build_object(
        'Content-Type', 'application/json',
        'Authorization', 'Bearer ' || current_setting('app.service_role_key')
      ),
      body := '{"type":"quiz"}'
    );
  $$
);

-- 2. Presença pendente: todo minuto (a função filtra as aulas que completaram 1h)
SELECT cron.schedule(
  'reminder-attendance',
  '* * * * *',
  $$
    SELECT net.http_post(
      url := current_setting('app.supabase_url') || '/functions/v1/send-reminders',
      headers := jsonb_build_object(
        'Content-Type', 'application/json',
        'Authorization', 'Bearer ' || current_setting('app.service_role_key')
      ),
      body := '{"type":"attendance"}'
    );
  $$
);

-- 3. TCC 4h antes do prazo: a cada 30 minutos (a função filtra pela janela de 4h)
SELECT cron.schedule(
  'reminder-tcc',
  '*/30 * * * *',
  $$
    SELECT net.http_post(
      url := current_setting('app.supabase_url') || '/functions/v1/send-reminders',
      headers := jsonb_build_object(
        'Content-Type', 'application/json',
        'Authorization', 'Bearer ' || current_setting('app.service_role_key')
      ),
      body := '{"type":"tcc"}'
    );
  $$
);
