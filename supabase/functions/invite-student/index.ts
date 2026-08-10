import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { SMTPClient } from "https://deno.land/x/denomailer@1.6.0/mod.ts";
import { corsHeaders } from "../_shared/cors.ts";
import { notifyAdmin, notifyEmailWrap, toAsciiSubject, cleanHtml } from "../_shared/notify.ts";

// Convites antigos (magic link via inviteUserByEmail) continuam funcionando
// normalmente pra quem já recebeu esse e-mail — essa function não mexe nisso,
// só deixou de USAR esse método pra convites/reenvios novos a partir de agora.
// Novo fluxo: cria o aluno já com senha numérica de 6 dígitos e a conta já
// confirmada (sem link nenhum), e manda um e-mail customizado com os dados.

function generatePassword(): string {
  return String(Math.floor(100000 + Math.random() * 900000));
}

async function sendWelcomeEmail(email: string, fullName: string, password: string) {
  const smtpUser = Deno.env.get("SMTP_USER")!;
  const smtpPass = Deno.env.get("SMTP_PASS")!;
  const smtpHost = Deno.env.get("SMTP_HOST")!;
  const smtpPort = Number(Deno.env.get("SMTP_PORT") ?? "465");

  const client = new SMTPClient({
    connection: { hostname: smtpHost, port: smtpPort, tls: true,
      auth: { username: smtpUser, password: smtpPass } },
  });

  const html = `
<div style="font-family:Arial,Helvetica,sans-serif;background:#f0f4f8;padding:24px;">
<div style="background:#ffffff;border-radius:8px;max-width:520px;margin:0 auto;overflow:hidden;">
<div style="background:#1a2e52;padding:32px 40px 28px;text-align:center;">
  <h1 style="color:#ffffff;font-size:20px;font-weight:700;margin:0;letter-spacing:0.5px;">Formação Teológica</h1>
  <p style="color:#8fabd4;font-size:12px;margin:4px 0 0;letter-spacing:1px;text-transform:uppercase;">Portal Acadêmico</p>
</div>
  <div style="padding:36px 40px;">
    <h2 style="color:#1a2e52;font-size:22px;font-weight:700;margin:0 0 12px;">Bem-vindo(a) à Formação Teológica!</h2>
    <p style="color:#4a5568;font-size:15px;line-height:1.7;margin:0 0 20px;">Olá, <strong style="color:#1a2e52;">${fullName || "aluno(a)"}</strong>!</p>
    <p style="color:#4a5568;font-size:15px;line-height:1.7;margin:0 0 20px;">Sua conta no <strong>Portal da Formação Teológica</strong> já está pronta. Use os dados abaixo para acessar:</p>

    <div style="background:#f7f8fa;border:1px solid #e8ecf1;border-radius:8px;padding:20px 24px;margin:0 0 24px;">
      <p style="margin:0 0 8px;font-size:13px;color:#8a9ab0;text-transform:uppercase;letter-spacing:0.5px;">E-mail</p>
      <p style="margin:0 0 18px;font-size:16px;color:#1a2e52;font-weight:600;">${email}</p>
      <p style="margin:0 0 8px;font-size:13px;color:#8a9ab0;text-transform:uppercase;letter-spacing:0.5px;">Senha provisória</p>
      <p style="margin:0;font-size:26px;color:#1a2e52;font-weight:700;letter-spacing:6px;">${password}</p>
    </div>

    <div style="text-align:center;margin:28px 0;">
      <a href="https://formacaoteologica.brasachurch.com/auth" style="display:inline-block;background:#1a2e52;color:#ffffff;padding:14px 36px;border-radius:6px;font-size:15px;font-weight:600;text-decoration:none;">Acessar o portal</a>
    </div>

    <div style="background:#FDF3E0;border-radius:6px;padding:16px 20px;margin:0 0 8px;">
      <p style="margin:0;font-size:13px;color:#7a5c1e;line-height:1.6;"><strong>Recomendamos trocar essa senha</strong> assim que você acessar pela primeira vez. É só ir em <strong>Perfil → Alterar senha</strong>, dentro do portal.</p>
    </div>

    <hr style="border:none;border-top:1px solid #e8ecf1;margin:24px 0;">
    <p style="font-size:13px;color:#8a9ab0;margin-bottom:8px;">Se você não esperava este e-mail, por favor ignore.</p>
  </div>
  <div style="background:#f8f9fb;border-top:1px solid #e8ecf1;padding:20px 40px;text-align:center;">
    <p style="color:#8a9ab0;font-size:12px;margin:0;line-height:1.6;">Formação Teológica — Portal Acadêmico<br>Este é um e-mail automático, por favor não responda.</p>
  </div>
</div>
</div>`;

  await client.send({
    from: `Formação Teológica <${smtpUser}>`,
    to: email,
    subject: toAsciiSubject("Bem-vindo(a) a Formacao Teologica - seus dados de acesso"),
    html: cleanHtml(html),
  });
  await client.close();
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(JSON.stringify({ error: "Não autorizado" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

    const userClient = createClient(supabaseUrl, Deno.env.get("SUPABASE_ANON_KEY")!, {
      global: { headers: { Authorization: authHeader } },
    });

    const { data: { user: caller } } = await userClient.auth.getUser();
    if (!caller) {
      return new Response(JSON.stringify({ error: "Não autorizado" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { data: callerProfile } = await userClient
      .from("profiles")
      .select("role")
      .eq("id", caller.id)
      .single();

    if (!callerProfile || (callerProfile.role !== "admin" && callerProfile.role !== "professor")) {
      return new Response(JSON.stringify({ error: "Apenas administradores e professores podem convidar alunos" }), {
        status: 403,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { students } = await req.json();

    if (!students || !Array.isArray(students) || students.length === 0) {
      return new Response(JSON.stringify({ error: "Lista de alunos vazia" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const adminClient = createClient(supabaseUrl, serviceRoleKey);
    const results: { email: string; success: boolean; error?: string; resent?: boolean }[] = [];

    // Mapa de e-mail -> confirmado (auth.users.confirmed_at) para decidir quem está pendente
    // Mapa de e-mail -> já acessou pelo menos uma vez (last_sign_in_at). Não usamos
    // confirmed_at aqui porque, no fluxo de senha, ele já vem preenchido na criação
    // da conta -- antes do aluno sequer abrir o e-mail. last_sign_in_at só é
    // preenchido no primeiro login de verdade, então continua confiável nos dois
    // fluxos (link antigo ou senha nova).
    const accessedMap: Record<string, boolean> = {};
    {
      let page = 1;
      const perPage = 200;
      while (true) {
        const { data: listData, error: listError } = await adminClient.auth.admin.listUsers({ page, perPage });
        if (listError) break;
        for (const u of listData.users) {
          if (u.email) accessedMap[u.email.toLowerCase()] = Boolean(u.last_sign_in_at);
        }
        if (listData.users.length < perPage) break;
        page += 1;
      }
    }

    for (const student of students) {
      const email = String(student.email || "").trim().toLowerCase();
      const fullName = String(student.full_name || "").trim();
      const cohortId = String(student.cohort_id || "").trim();

      if (!email || !cohortId) {
        results.push({ email, success: false, error: "E-mail e turma são obrigatórios" });
        continue;
      }

      try {
        const { data: existingProfiles } = await adminClient
          .from("profiles")
          .select("id")
          .eq("email", email)
          .maybeSingle();

        let userId: string;
        let resent = false;

        if (existingProfiles) {
          userId = existingProfiles.id;
          const hasAccessed = accessedMap[email] ?? true; // se não sabemos, não mexe (comportamento seguro)

          if (!hasAccessed) {
            // Pendente de um convite antigo (link) ou de uma tentativa anterior: reaproveita
            // a senha já gerada antes (tabela pass), se existir -- assim não manda um segundo
            // e-mail com senha diferente do primeiro. Só gera uma nova se nunca tinha gerado.
            const { data: existingPass } = await adminClient
              .from("pass")
              .select("pass_temp")
              .eq("user_id", userId)
              .maybeSingle();

            const password = existingPass?.pass_temp || generatePassword();

            const { error: updateError } = await adminClient.auth.admin.updateUserById(userId, {
              password,
              email_confirm: true,
              user_metadata: { full_name: fullName, role: "aluno" },
            });

            if (updateError) {
              results.push({ email, success: false, error: updateError.message || JSON.stringify(updateError) });
              continue;
            }

            if (!existingPass) {
              await adminClient.from("pass").upsert({ user_id: userId, pass_temp: password });
            }

            try {
              await sendWelcomeEmail(email, fullName, password);
              resent = true;
            } catch (mailErr: any) {
              // Conta já está ativa com a senha nova, só o e-mail falhou -- não perde a senha:
              // devolve ela no resultado pra você repassar manualmente se precisar.
              results.push({
                email,
                success: false,
                error: `Conta ativada, mas e-mail falhou ao enviar. Senha: ${password} (${mailErr?.message || mailErr})`,
              });
              continue;
            }
          }
        } else {
          // Aluno novo: cria já com senha de 6 dígitos e conta confirmada -- sem link nenhum.
          const password = generatePassword();
          const { data: createData, error: createError } = await adminClient.auth.admin.createUser({
            email,
            password,
            email_confirm: true,
            user_metadata: { full_name: fullName, role: "aluno" },
          });

          if (createError) {
            results.push({ email, success: false, error: createError.message || JSON.stringify(createError) });
            continue;
          }
          userId = createData.user.id;
          await adminClient.from("pass").upsert({ user_id: userId, pass_temp: password });

          try {
            await sendWelcomeEmail(email, fullName, password);
          } catch (mailErr: any) {
            results.push({
              email,
              success: false,
              error: `Conta criada, mas e-mail falhou ao enviar. Senha gerada: ${password} (${mailErr?.message || mailErr})`,
            });
            continue;
          }
        }

        const { error: cohortError } = await adminClient
          .from("cohort_students")
          .upsert({ cohort_id: cohortId, user_id: userId }, { onConflict: "cohort_id,user_id", ignoreDuplicates: true });

        if (cohortError) {
          results.push({ email, success: false, error: cohortError.message });
          continue;
        }

        results.push({ email, success: true, resent });
      } catch (err: any) {
        results.push({ email, success: false, error: err?.message || JSON.stringify(err) || "Erro desconhecido" });
      }
    }

    const successCount = results.filter((r) => r.success).length;
    const errorCount = results.filter((r) => !r.success).length;

    if (successCount > 0) {
      const now = new Date().toLocaleString("pt-BR", { timeZone: "America/Sao_Paulo" });
      const succeeded = results.filter((r) => r.success);
      const html = notifyEmailWrap(`
        <p style="margin:0 0 12px;color:#1a2e52;"><strong>Foi enviado convite para novos alunos</strong></p>
        <p style="margin:0 0 12px;color:#4a5568;">Horário: ${now}</p>
        <p style="margin:0 0 8px;color:#4a5568;">${successCount} destinatário(s) processado(s) com sucesso${errorCount > 0 ? ` — ${errorCount} com erro` : ""}:</p>
        <ul style="margin:0;padding-left:20px;color:#4a5568;">${succeeded.map((r) => `<li>${r.email}</li>`).join("")}</ul>
      `);
      await notifyAdmin("Convites enviados — Formação Teológica", html);
    }

    return new Response(
      JSON.stringify({ results, successCount, errorCount }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (err: any) {
    return new Response(JSON.stringify({ error: err?.message || JSON.stringify(err) }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
