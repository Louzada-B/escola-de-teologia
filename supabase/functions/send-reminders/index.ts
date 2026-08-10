import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { SMTPClient } from "https://deno.land/x/denomailer@1.6.0/mod.ts";
import { corsHeaders } from "../_shared/cors.ts";
import { sendWebPush } from "./webpush.ts";
import { notifyAdmin, notifyEmailWrap, toAsciiSubject, cleanHtml } from "../_shared/notify.ts";

const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
const serviceKey  = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const smtpUser    = Deno.env.get("SMTP_USER")!;
const smtpPass    = Deno.env.get("SMTP_PASS")!;
const smtpHost    = Deno.env.get("SMTP_HOST")!;
const smtpPort    = Number(Deno.env.get("SMTP_PORT") ?? "465");
const vapidPub    = "BPp1QQmJdq77A3OZClICx0U6NPWlj2gOF4jj6x0JQHmOnQJ5HpC1LZ1ts2aS26ID_FrGxpWXc-_1mss1KnMIc2k";
const vapidPriv   = Deno.env.get("VAPID_PRIVATE_KEY")!;

// Extrai raw private key d via PKCS8 -> JWK
async function getRawPrivateKey(): Promise<string> {
  const pad = "=".repeat((4 - (vapidPriv.length % 4)) % 4);
  const b64 = (vapidPriv + pad).replace(/-/g, "+").replace(/_/g, "/");
  const der = Uint8Array.from(atob(b64), (ch) => ch.charCodeAt(0));
  const key = await crypto.subtle.importKey(
    "pkcs8", der.buffer,
    { name: "ECDSA", namedCurve: "P-256" }, true, ["sign"]
  );
  const jwk = await crypto.subtle.exportKey("jwk", key) as JsonWebKey;
  return jwk.d!; // raw 32-byte private scalar in base64url
}
const vapidEmail  = `mailto:${Deno.env.get("SMTP_USER")}`;


async function sendPush(admin: ReturnType<typeof createClient>, userIds: string[], title: string, body: string, url: string) {
  if (!vapidPriv) return;
  const { data: subs } = await admin
    .from("push_subscriptions").select("endpoint, p256dh, auth").in("user_id", userIds);
  if (!subs?.length) return;

  const payload = JSON.stringify({ title, body, url, icon: "/pwa-192x192.png" });

  for (const sub of subs) {
    try {
      await sendWebPush({
        endpoint: sub.endpoint,
        p256dh: sub.p256dh,
        auth: sub.auth,
        vapidPublicKey: vapidPub,
        vapidPrivateKeyRaw: await getRawPrivateKey(),
        vapidSubject: vapidEmail,
        payload,
      });
    } catch (err: any) {
      console.error("[sendPush] erro:", err?.message);
      // Remove subscricoes expiradas (HTTP 410)
      if (err?.message?.includes("410")) {
        await admin.from("push_subscriptions").delete().eq("endpoint", sub.endpoint);
      }
    }
  }
}

// Assunto sem acento, sem nenhuma codificação MIME. Depois de várias
// tentativas de codificar corretamente (deixar a lib codificar sozinha,
// RFC 2047 manual, reforço via header -- nenhuma funcionou, confirmado em
// teste real), o caminho seguro é não precisar de codificação nenhuma.

async function sendEmail(client: SMTPClient, to: string, subject: string, html: string) {
  const params = {
    from: `Forma\u00e7\u00e3o Teol\u00f3gica <${smtpUser}>`,
    to,
    // ATENÇÃO: toAsciiSubject removido de propósito, teste combinado com o
    // Bruno pra confirmar se assunto acentuado funciona agora. Reavaliar
    // depois do teste -- se corromper de novo, volta o toAsciiSubject aqui.
    subject,
    html,
  };
  try {
    await client.send(params);
  } catch (err: any) {
    const msg = String(err?.message || "");
    // Código 4xx = erro temporário do lado do servidor (o próprio SMTP pede
    // pra tentar de novo depois), diferente de 5xx (rejeição definitiva,
    // não adianta tentar de novo). Uma nova tentativa, com pausa curta,
    // cobre uma instabilidade passageira do servidor sem precisar de
    // reinvocação manual.
    if (/\b4\d{2}\b/.test(msg)) {
      console.warn(`[sendEmail] erro temporário pra ${to}, tentando de novo em 3s:`, msg);
      await new Promise((r) => setTimeout(r, 3000));
      await client.send(params);
    } else {
      throw err;
    }
  }
}

function emailWrap(body: string) {
  return `
<div style="font-family:Arial,Helvetica,sans-serif;background:#f0f4f8;padding:24px;">
<div style="background:#fff;border-radius:8px;max-width:520px;margin:0 auto;overflow:hidden;">
  <div style="background:#1a2e52;padding:28px 40px 24px;text-align:center;">
    <h1 style="color:#fff;font-size:18px;font-weight:700;margin:0;">Forma\u00e7\u00e3o Teol\u00f3gica</h1>
    <p style="color:#8fabd4;font-size:11px;margin:4px 0 0;letter-spacing:1px;text-transform:uppercase;">Portal Acad\u00eamico</p>
  </div>
  <div style="padding:32px 40px;">${cleanHtml(body)}</div>
  <div style="background:#f8f9fb;border-top:1px solid #e8ecf1;padding:16px 40px;text-align:center;">
    <p style="color:#8a9ab0;font-size:11px;margin:0;">Este \u00e9 um e-mail autom\u00e1tico, por favor n\u00e3o responda.</p>
  </div>
</div>
</div>`;
}

// Monta um índice das turmas ativas + quem está matriculado em cada uma.
// Usado pra resolver "quais alunos realmente enxergam essa aula/questionário",
// em vez de mandar lembrete pra qualquer aluno de qualquer turma ativa —
// isso evita notificar aluno de uma turma sobre conteúdo de outra turma
// (fica mais crítico ainda quando existir mais de uma turma ativa ao mesmo
// tempo, ou cursos diferentes).
async function buildCohortIndex(admin: ReturnType<typeof createClient>) {
  const { data: activeCohorts } = await admin
    .from("cohorts").select("id, start_date, end_date").eq("is_active", true);

  const { data: cohortStudents } = await admin
    .from("cohort_students").select("user_id, cohort_id");

  const activeCohortIds = new Set((activeCohorts || []).map((c: any) => c.id));
  const studentsByCohort: Record<string, Set<string>> = {};
  (cohortStudents || []).forEach((cs: any) => {
    if (!activeCohortIds.has(cs.cohort_id)) return;
    if (!studentsByCohort[cs.cohort_id]) studentsByCohort[cs.cohort_id] = new Set();
    studentsByCohort[cs.cohort_id].add(cs.user_id);
  });

  const allActiveStudentIds = new Set<string>();
  Object.values(studentsByCohort).forEach((set) => set.forEach((id) => allActiveStudentIds.add(id)));

  // Pra uma data (scheduled_date de aula), devolve o conjunto de alunos das
  // turmas ativas cujo período cobre essa data. Sem data (ex: quiz não
  // vinculado a nenhuma aula), cai no comportamento antigo: todo mundo de
  // turma ativa -- não dá pra restringir melhor sem uma data de referência.
  function studentsForDate(dateStr: string | null): Set<string> {
    if (!dateStr) return allActiveStudentIds;
    const relevantCohortIds = (activeCohorts || [])
      .filter((c: any) => dateStr >= c.start_date && dateStr <= c.end_date)
      .map((c: any) => c.id);
    const result = new Set<string>();
    relevantCohortIds.forEach((cid: string) => {
      (studentsByCohort[cid] || new Set()).forEach((id) => result.add(id));
    });
    return result;
  }

  return { allActiveStudentIds, studentsForDate };
}

// ── LEMBRETE 1: Questionário fechando hoje às 9h ─────────────────
async function remindQuizzes(admin: ReturnType<typeof createClient>, client: SMTPClient, testEmail?: string) {
  const now = new Date();
  const todayStr = now.toISOString().slice(0, 10);

  // Quizzes cujo available_until é hoje
  const { data: quizzes } = await admin
    .from("quizzes")
    .select("id, title, available_until, lesson_id")
    .gte("available_until", `${todayStr}T00:00:00`)
    .lte("available_until", `${todayStr}T23:59:59`);

  if (!quizzes?.length) return { sent: 0 };

  // Quem já respondeu cada quiz
  const quizIds = quizzes.map((q: any) => q.id);
  const { data: responses } = await admin
    .from("quiz_responses").select("user_id, quiz_id").in("quiz_id", quizIds);

  const answeredMap: Record<string, Set<string>> = {};
  (responses || []).forEach((r: any) => {
    if (!answeredMap[r.quiz_id]) answeredMap[r.quiz_id] = new Set();
    answeredMap[r.quiz_id].add(r.user_id);
  });

  // Data da aula de cada quiz (pra resolver a turma certa) -- quiz sem
  // lesson_id fica sem data, cai no fallback "todo mundo" do helper.
  const lessonIds = [...new Set(quizzes.filter((q: any) => q.lesson_id).map((q: any) => q.lesson_id))];
  const { data: lessonsData } = lessonIds.length
    ? await admin.from("lessons").select("id, scheduled_date").in("id", lessonIds)
    : { data: [] as any[] };
  const lessonDateMap: Record<string, string> = {};
  (lessonsData || []).forEach((l: any) => { lessonDateMap[l.id] = l.scheduled_date; });

  const { allActiveStudentIds, studentsForDate } = await buildCohortIndex(admin);
  if (!allActiveStudentIds.size) return { sent: 0 };

  // Perfis de todo mundo que pode ser relevante em algum dos quizzes de hoje
  const relevantIdsUnion = new Set<string>();
  for (const quiz of quizzes) {
    const dateStr = quiz.lesson_id ? lessonDateMap[quiz.lesson_id] : null;
    studentsForDate(dateStr).forEach((id) => relevantIdsUnion.add(id));
  }
  const { data: profiles } = await admin
    .from("profiles").select("id, full_name, email").in("id", [...relevantIdsUnion]);
  const profileById: Record<string, any> = {};
  (profiles || []).forEach((p: any) => { profileById[p.id] = p; });

  let sent = 0;
  const emailsSent: string[] = [];
  for (const quiz of quizzes) {
    const answeredIds = answeredMap[quiz.id] || new Set();
    const deadline = new Date(quiz.available_until).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit", timeZone: "America/Sao_Paulo" });
    const dateStr = quiz.lesson_id ? lessonDateMap[quiz.lesson_id] : null;
    const relevantIds = studentsForDate(dateStr);
    let pendingProfiles = [...relevantIds]
      .filter((id) => !answeredIds.has(id))
      .map((id) => profileById[id])
      .filter(Boolean);

    // Modo de teste: mesma lógica de "quem está pendente" de sempre, só que
    // restrito a um único e-mail -- não dispara pra mais ninguém da turma.
    if (testEmail) {
      pendingProfiles = pendingProfiles.filter((p: any) => p.email?.toLowerCase() === testEmail.toLowerCase());
    }

    for (const profile of pendingProfiles) {
      if (!profile.email) continue;
      const body = `
        <p style="color:#4a5568;font-size:15px;line-height:1.7;margin:0 0 16px;">
          Ol\u00e1, <strong style="color:#1a2e52;">${profile.full_name || "aluno(a)"}</strong>!
        </p>
        <p style="color:#4a5568;font-size:15px;line-height:1.7;margin:0 0 16px;">
          O <strong>${quiz.title}</strong> fecha hoje \u00e0s <strong>${deadline}</strong>.
          Voc\u00ea ainda n\u00e3o respondeu — acesse o portal antes que o prazo encerre.
        </p>
        <div style="text-align:center;margin:24px 0;">
          <a href="https://formacaoteologica.brasachurch.com/dashboard/questionarios"
             style="background:#1a2e52;color:#fff;padding:12px 32px;border-radius:6px;font-size:14px;font-weight:600;text-decoration:none;">
            Responder agora
          </a>
        </div>`;
      try {
        await sendEmail(client, profile.email, "Lembrete: question\u00e1rio fecha hoje", emailWrap(body));
        await sendPush(admin, [profile.id], "Questionário fecha hoje!", `${quiz.title} — encerra às ${deadline}`, "https://formacaoteologica.brasachurch.com/dashboard/questionarios");
        sent++;
        emailsSent.push(profile.email);
      } catch (err: any) {
        // Isola a falha -- um envio ruim não pode travar o resto da fila
        console.error("[remindQuizzes] falha ao enviar pra", profile.email, ":", err?.message);
      }
    }
  }
  return { sent, emails: emailsSent };
}

// ── LEMBRETE 2: Presença pendente 1h após início da aula ─────────
async function remindAttendance(admin: ReturnType<typeof createClient>, client: SMTPClient, force = false, testEmail?: string) {
  const now = new Date();
  const todayStr = now.toISOString().slice(0, 10);
  const nowMins  = now.getHours() * 60 + now.getMinutes();

  // Aulas de hoje com start_time definido
  const { data: lessons } = await admin
    .from("lessons")
    .select("id, title, start_time, module_id")
    .eq("scheduled_date", todayStr)
    .not("start_time", "is", null);

  if (!lessons?.length) return { sent: 0 };

  // Filtra aulas cujo start_time + 1h = agora (±5 min de tolerância).
  // Com force=true (disparo manual), ignora a janela e pega qualquer aula
  // de hoje que já passou de 1h desde o início — usado pra recuperar um
  // aviso perdido (ex: cron ficou desligado durante a janela normal).
  const targetLessons = (lessons || []).filter((l: any) => {
    if (!l.start_time) return false;
    const [h, m] = l.start_time.split(":").map(Number);
    const startMins = h * 60 + m;
    const targetMins = startMins + 60; // 1h depois
    if (force) return nowMins >= targetMins;
    return Math.abs(nowMins - targetMins) <= 5;
  });

  if (!targetLessons.length) return { sent: 0 };

  const lessonIds = targetLessons.map((l: any) => l.id);

  // Alunos das turmas ativas cujo período cobre a data de hoje (mesma lógica
  // do Lembrete 1) -- como toda aula desse laço é de hoje, o conjunto é o
  // mesmo pra todas elas, calculado uma vez só.
  const { studentsForDate } = await buildCohortIndex(admin);
  const activeStudentIds = [...studentsForDate(todayStr)];
  if (!activeStudentIds.length) return { sent: 0 };

  // Quem já registrou presença
  const { data: attended } = await admin
    .from("attendance_records")
    .select("user_id, lesson_id")
    .in("lesson_id", lessonIds)
    .in("user_id", activeStudentIds);

  const attendedSet = new Set((attended || []).map((a: any) => `${a.user_id}:${a.lesson_id}`));

  const { data: profiles } = await admin
    .from("profiles").select("id, full_name, email").in("id", activeStudentIds);

  let sent = 0;
  const emailsSent: string[] = [];
  for (const lesson of targetLessons) {
    let pendingProfiles = (profiles || []).filter(
      (p: any) => !attendedSet.has(`${p.id}:${lesson.id}`) && p.email
    );
    if (testEmail) {
      pendingProfiles = pendingProfiles.filter((p: any) => p.email?.toLowerCase() === testEmail.toLowerCase());
    }
    for (const profile of pendingProfiles) {
      const body = `
        <p style="color:#4a5568;font-size:15px;line-height:1.7;margin:0 0 16px;">
          Ol\u00e1, <strong style="color:#1a2e52;">${profile.full_name || "aluno(a)"}</strong>!
        </p>
        <p style="color:#4a5568;font-size:15px;line-height:1.7;margin:0 0 16px;">
          Percebemos que voc\u00ea ainda n\u00e3o registrou sua presen\u00e7a na aula de hoje:
          <strong>${lesson.title}</strong>. Ainda h\u00e1 tempo — acesse o portal agora.
        </p>
        <div style="text-align:center;margin:24px 0;">
          <a href="https://formacaoteologica.brasachurch.com/dashboard/presenca"
             style="background:#1a2e52;color:#fff;padding:12px 32px;border-radius:6px;font-size:14px;font-weight:600;text-decoration:none;">
            Registrar presen\u00e7a
          </a>
        </div>`;
      try {
        await sendEmail(client, profile.email, "Lembrete: registre sua presenca", emailWrap(body));
        await sendPush(admin, [profile.id], "Registre sua presen\u00e7a!", lesson.title, "https://formacaoteologica.brasachurch.com/dashboard/presenca");
        sent++;
        emailsSent.push(profile.email);
      } catch (err: any) {
        console.error("[remindAttendance] falha ao enviar pra", profile.email, ":", err?.message);
      }
    }
  }
  return { sent, emails: emailsSent };
}

// ── LEMBRETE 3: TCC 4h antes do deadline ─────────────────────────
async function remindTCC(admin: ReturnType<typeof createClient>, client: SMTPClient) {
  const now = new Date();

  const { data: settings } = await admin
    .from("tcc_settings").select("deadline").limit(1).maybeSingle();

  const deadlineStr = (settings as any)?.deadline;
  if (!deadlineStr) return { sent: 0 };

  const deadline = new Date(deadlineStr);
  const diffHours = (deadline.getTime() - now.getTime()) / (1000 * 60 * 60);

  // Só avisa quando estiver entre 3h45 e 4h15 do prazo
  if (diffHours < 3.75 || diffHours > 4.25) return { sent: 0 };

  // Alunos ativos sem TCC enviado
  const { data: cohortStudents } = await admin
    .from("cohort_students")
    .select("user_id, cohort_id, cohorts!inner(is_active)")
    .eq("cohorts.is_active", true);

  if (!cohortStudents?.length) return { sent: 0 };

  const { data: submissions } = await admin
    .from("tcc_submissions").select("user_id");

  const submittedIds = new Set((submissions || []).map((s: any) => s.user_id));
  const pendingStudentIds = (cohortStudents || [])
    .filter((cs: any) => !submittedIds.has(cs.user_id))
    .map((cs: any) => cs.user_id);

  if (!pendingStudentIds.length) return { sent: 0 };

  const { data: profiles } = await admin
    .from("profiles").select("id, full_name, email").in("id", pendingStudentIds);

  const deadlineFmt = deadline.toLocaleString("pt-BR", {
    day: "2-digit", month: "long", hour: "2-digit", minute: "2-digit", timeZone: "America/Sao_Paulo",
  });

  let sent = 0;
  const emailsSent: string[] = [];
  for (const profile of (profiles || [])) {
    if (!profile.email) continue;
    const body = `
      <p style="color:#4a5568;font-size:15px;line-height:1.7;margin:0 0 16px;">
        Ol\u00e1, <strong style="color:#1a2e52;">${profile.full_name || "aluno(a)"}</strong>!
      </p>
      <p style="color:#4a5568;font-size:15px;line-height:1.7;margin:0 0 16px;">
        O prazo para entrega do TCC encerra em aproximadamente <strong>4 horas</strong>
        (${deadlineFmt}). Voc\u00ea ainda n\u00e3o enviou seu trabalho — acesse o portal agora.
      </p>
      <div style="text-align:center;margin:24px 0;">
        <a href="https://formacaoteologica.brasachurch.com/dashboard/tcc"
           style="background:#1a2e52;color:#fff;padding:12px 32px;border-radius:6px;font-size:14px;font-weight:600;text-decoration:none;">
          Enviar TCC
        </a>
      </div>`;
    try {
      await sendEmail(client, profile.email, "Lembrete: prazo do TCC em 4 horas!", emailWrap(body));
      await sendPush(admin, [profile.id], "TCC: prazo em 4 horas!", `Encerra ${deadlineFmt}`, "https://formacaoteologica.brasachurch.com/dashboard/tcc");
      sent++;
      emailsSent.push(profile.email);
    } catch (err: any) {
      console.error("[remindTCC] falha ao enviar pra", profile.email, ":", err?.message);
    }
  }
  return { sent, emails: emailsSent };
}

// ── Handler principal ─────────────────────────────────────────────
// Push para avisos agendados que acabaram de ativar
async function remindScheduledAnnouncements(admin: ReturnType<typeof createClient>) {
  const now = new Date().toISOString();
  // Aguarda 15s apos o horario agendado para garantir que o aviso ja esta visivel no app
  const fifteenSecAgo = new Date(Date.now() - 15 * 1000).toISOString();
  const { data: announcements } = await admin
    .from("announcements")
    .select("id, title")
    .lte("scheduled_at", fifteenSecAgo)
    .eq("push_sent", false);

  if (!announcements?.length) return { sent: 0 };

  // Busca alunos ativos
  const { data: cohortStudents } = await admin
    .from("cohort_students")
    .select("user_id, cohorts!inner(is_active)")
    .eq("cohorts.is_active", true);

  const studentIds = [...new Set(((cohortStudents || []) as any[]).map((cs: any) => cs.user_id))];
  let sent = 0;

  for (const ann of announcements) {
    await sendPush(
      admin, studentIds,
      "Novo aviso publicado",
      ann.title,
      "https://formacaoteologica.brasachurch.com/dashboard/avisos"
    );
    // Marca como enviado
    await admin.from("announcements").update({ push_sent: true } as any).eq("id", ann.id);
    sent++;
  }
  return { sent };
}

// Push para novo aviso
async function notifyAnnouncement(admin: ReturnType<typeof createClient>, announcementId: string, title: string) {
  // Busca alunos ativos
  const { data: cohortStudents } = await admin
    .from("cohort_students")
    .select("user_id, cohorts!inner(is_active)")
    .eq("cohorts.is_active", true);

  if (!cohortStudents?.length) return { sent: 0 };
  const studentIds = [...new Set((cohortStudents as any[]).map((cs: any) => cs.user_id))];

  await sendPush(
    admin,
    studentIds,
    "Novo aviso publicado",
    title || "Um novo aviso foi publicado no portal.",
    "https://formacaoteologica.brasachurch.com/dashboard/avisos"
  );
  return { sent: studentIds.length };
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  // Uma conexão SMTP só, reaproveitada por todos os e-mails desse disparo --
  // antes, cada e-mail abria/fechava sua própria conexão, e com muitos
  // alunos pendentes isso derrubava a conexão no meio do lote ("connection
  // reset"), travando a function inteira e deixando o resto da fila sem
  // receber. fechada de propósito no finally, mesmo se algo der errado.
  const client = new SMTPClient({
    connection: { hostname: smtpHost, port: smtpPort, tls: true,
      auth: { username: smtpUser, password: smtpPass } },
    debug: { encodeLB: true },
  });

  try {
    const body = await req.json().catch(() => ({ type: "all" }));
    const { type, title: annTitle, announcement_id: annId, force, test_email: testEmail } = body;
    const admin = createClient(supabaseUrl, serviceKey);
    const results: Record<string, any> = {};

    if (type === "quiz"       || type === "all") results.quiz       = await remindQuizzes(admin, client, testEmail);
    if (type === "attendance" || type === "all") {
      results.attendance = await remindAttendance(admin, client, force === true, testEmail);
      results.scheduledAnnouncements = await remindScheduledAnnouncements(admin);
    }
    if (type === "tcc"        || type === "all") results.tcc        = await remindTCC(admin, client);
    if (type === "announcement") {
      results.announcement = await notifyAnnouncement(admin, annId || "", annTitle || "");
    }

    console.log("[send-reminders] type:", type, "results:", JSON.stringify(results));

    // Notificação resumo pro admin -- só quando realmente saiu algum e-mail
    // (não a cada verificação vazia do cron rodando em vazio).
    const groups: { label: string; emails: string[] }[] = [];
    if (results.quiz?.emails?.length) groups.push({ label: "Questionário fechando", emails: results.quiz.emails });
    if (results.attendance?.emails?.length) groups.push({ label: "Presença pendente", emails: results.attendance.emails });
    if (results.tcc?.emails?.length) groups.push({ label: "TCC — prazo próximo", emails: results.tcc.emails });

    if (groups.length > 0) {
      const now = new Date().toLocaleString("pt-BR", { timeZone: "America/Sao_Paulo" });
      const sections = groups.map((g) => `
        <p style="margin:16px 0 4px;color:#1a2e52;"><strong>${g.label}</strong> (${g.emails.length}):</p>
        <ul style="margin:0 0 8px;padding-left:20px;color:#4a5568;">${g.emails.map((e) => `<li>${e}</li>`).join("")}</ul>
      `).join("");
      await notifyAdmin(
        "Lembretes automáticos enviados — Formação Teológica",
        notifyEmailWrap(`
          <p style="margin:0 0 12px;color:#1a2e52;"><strong>Lembretes enviados</strong></p>
          <p style="margin:0 0 4px;color:#4a5568;">Horário: ${now}</p>
          ${sections}
        `),
      );
    }

    return new Response(JSON.stringify({ ok: true, results }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } });
  } catch (err: any) {
    console.error("[send-reminders] erro:", err?.message);
    return new Response(JSON.stringify({ error: err?.message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  } finally {
    try {
      await client.close();
    } catch (_) {
      // conexão já pode estar fechada/quebrada nesse ponto -- ignora
    }
  }
});
