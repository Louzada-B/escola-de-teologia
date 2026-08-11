-- Lembrete de leitura pendente: todo dia às 9h horário de Brasília
-- (12h UTC, mesmo horário do lembrete de questionário fechando).
-- Por enquanto restrito ao Aluno teste dentro da própria function
-- (send-reminders/index.ts, TEST_STUDENT_EMAIL_ONLY) -- a aba de Leitura
-- ainda não foi liberada geral.
SELECT cron.schedule(
  'reminder-reading-pending',
  '0 12 * * *',
  $$
    SELECT net.http_post(
      url := current_setting('app.supabase_url') || '/functions/v1/send-reminders',
      headers := jsonb_build_object(
        'Content-Type', 'application/json',
        'Authorization', 'Bearer ' || current_setting('app.service_role_key')
      ),
      body := '{"type":"reading"}'
    );
  $$
);
