import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { SMTPClient } from "https://deno.land/x/denomailer@1.6.0/mod.ts";
import { corsHeaders } from "../_shared/cors.ts";

const btoaSafe = (str: string) => {
  const bytes = new TextEncoder().encode(str);
  let binary = "";
  bytes.forEach(b => binary += String.fromCharCode(b));
  return btoa(binary);
};

async function sendInviteEmail(to: string, fullName: string, inviteLink: string) {
  const smtpUser = Deno.env.get("SMTP_USER")!;
  const smtpPass = Deno.env.get("SMTP_PASS")!;

  const client = new SMTPClient({
    connection: {
      hostname: "smtp.gmail.com",
      port: 465,
      tls: true,
      auth: { username: smtpUser, password: smtpPass },
    },
  });

  const html = `
<div style="font-family:Arial,Helvetica,sans-serif;background:#f0f4f8;padding:24px;">
<div style="background:#ffffff;border-radius:8px;max-width:520px;margin:0 auto;overflow:hidden;">
  <div style="background:#1a2e52;padding:32px 40px 28px;text-align:center;">
    <h1 style="color:#ffffff;font-size:20px;font-weight:700;margin:0;letter-spacing:0.5px;">Forma\u00e7\u00e3o Teol\u00f3gica</h1>
    <p style="color:#8fabd4;font-size:12px;margin:4px 0 0;letter-spacing:1px;text-transform:uppercase;">Portal Acad\u00eamico</p>
  </div>
  <div style="padding:36px 40px;">
    <span style="display:inline-block;background:#eef2f8;color:#1a2e52;font-size:11px;padding:3px 10px;border-radius:20px;font-weight:600;letter-spacing:0.5px;margin-bottom:16px;">Convite de acesso</span>
    <h2 style="color:#1a2e52;font-size:22px;font-weight:700;margin:0 0 12px;">Bem-vindo ao portal!</h2>
    <p style="color:#4a5568;font-size:15px;line-height:1.7;margin:0 0 20px;">Ol\u00e1, <strong style="color:#1a2e52;">${fullName || to}</strong>!</p>
    <p style="color:#4a5568;font-size:15px;line-height:1.7;margin:0 0 20px;">Voc\u00ea foi convidado para acessar o <strong>Portal de Forma\u00e7\u00e3o Teol\u00f3gica</strong>. Clique no bot\u00e3o abaixo para definir sua senha e come\u00e7ar sua jornada.</p>
    <div style="text-align:center;margin:28px 0;">
      <a href="${inviteLink}" style="display:inline-block;background:#1a2e52;color:#ffffff;padding:14px 36px;border-radius:6px;font-size:15px;font-weight:600;text-decoration:none;">Definir minha senha</a>
    </div>
    <p style="font-size:13px;color:#8a9ab0;margin-bottom:8px;">Este link expira em 24 horas. Se voc\u00ea n\u00e3o solicitou esse convite, ignore este e-mail.</p>
    <hr style="border:none;border-top:1px solid #e8ecf1;margin:24px 0;">
    <p style="font-size:12px;color:#8a9ab0;line-height:1.6;word-break:break-all;">Se o bot\u00e3o n\u00e3o funcionar, copie e cole este link no seu navegador:<br><a href="${inviteLink}" style="color:#c9a84c;">${inviteLink}</a></p>
  </div>
  <div style="background:#f8f9fb;border-top:1px solid #e8ecf1;padding:20px 40px;text-align:center;">
    <p style="color:#8a9ab0;font-size:12px;margin:0;line-height:1.6;">Forma\u00e7\u00e3o Teol\u00f3gica \u2014 Portal Acad\u00eamico<br>Este \u00e9 um e-mail autom\u00e1tico, por favor n\u00e3o responda.</p>
  </div>
</div>
</div>`;

  await client.send({
    from: `Forma\u00e7\u00e3o Teol\u00f3gica <${smtpUser}>`,
    to,
    subject: `=?UTF-8?B?${btoaSafe("Seu convite para o Portal de Forma\u00e7\u00e3o Teol\u00f3gica")}?=`,
    html,
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
      return new Response(JSON.stringify({ error: "N\u00e3o autorizado" }), {
        status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

    const userClient = createClient(supabaseUrl, Deno.env.get("SUPABASE_ANON_KEY")!, {
      global: { headers: { Authorization: authHeader } },
    });

    const { data: { user: caller } } = await userClient.auth.getUser();
    if (!caller) {
      return new Response(JSON.stringify({ error: "N\u00e3o autorizado" }), {
        status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { data: callerProfile } = await userClient
      .from("profiles").select("role").eq("id", caller.id).single();

    if (!callerProfile || (callerProfile.role !== "admin" && callerProfile.role !== "professor")) {
      return new Response(JSON.stringify({ error: "Apenas administradores e professores podem convidar alunos" }), {
        status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { students, redirectTo } = await req.json();

    if (!students || !Array.isArray(students) || students.length === 0) {
      return new Response(JSON.stringify({ error: "Lista de alunos vazia" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const adminClient = createClient(supabaseUrl, serviceRoleKey);
    const results: { email: string; success: boolean; error?: string }[] = [];

    for (const student of students) {
      const email = String(student.email || "").trim().toLowerCase();
      const fullName = String(student.full_name || "").trim();
      const cohortId = String(student.cohort_id || "").trim();

      if (!email || !cohortId) {
        results.push({ email, success: false, error: "E-mail e turma s\u00e3o obrigat\u00f3rios" });
        continue;
      }

      try {
        // Verifica se usuário já existe em auth.users
        const { data: { users }, error: listError } = await adminClient.auth.admin.listUsers();
        if (listError) throw new Error("Erro ao verificar usu\u00e1rios: " + listError.message);

        const existingUser = users?.find(u => u.email?.toLowerCase() === email);
        let userId: string;

        if (existingUser) {
          console.log("[invite-student] Usu\u00e1rio j\u00e1 existe:", email);
          userId = existingUser.id;
        } else {
          // Gera o link de convite sem enviar e-mail pelo Supabase
          console.log("[invite-student] Gerando link de convite para:", email);
          const { data: linkData, error: linkError } = await adminClient.auth.admin.generateLink({
            type: "invite",
            email,
            options: {
              data: { full_name: fullName, role: "aluno" },
              redirectTo,
            },
          });

          if (linkError) {
            const msg = linkError.message || JSON.stringify(linkError);
            console.error("[invite-student] Erro ao gerar link:", msg);
            results.push({ email, success: false, error: msg });
            continue;
          }

          userId = linkData.user.id;
          const inviteLink = linkData.properties.action_link;

          // Envia o e-mail pelo nosso próprio SMTP
          console.log("[invite-student] Enviando e-mail para:", email);
          await sendInviteEmail(email, fullName, inviteLink);
        }

        // Vincula aluno à turma
        const { error: cohortError } = await adminClient
          .from("cohort_students")
          .upsert({ cohort_id: cohortId, user_id: userId }, { onConflict: "cohort_id,user_id", ignoreDuplicates: true });

        if (cohortError) {
          console.error("[invite-student] Erro ao vincular turma:", cohortError.message);
          results.push({ email, success: false, error: cohortError.message });
          continue;
        }

        results.push({ email, success: true });
        console.log("[invite-student] Sucesso:", email);
      } catch (err: any) {
        const msg = err?.message || JSON.stringify(err) || "Erro desconhecido";
        console.error("[invite-student] Exce\u00e7\u00e3o para", email, ":", msg);
        results.push({ email, success: false, error: msg });
      }
    }

    const successCount = results.filter(r => r.success).length;
    const errorCount = results.filter(r => !r.success).length;
    console.log("[invite-student] Resultado:", successCount, "sucesso(s),", errorCount, "erro(s)");

    return new Response(
      JSON.stringify({ results, successCount, errorCount }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (err: any) {
    const msg = err?.message || JSON.stringify(err) || "Erro fatal desconhecido";
    console.error("[invite-student] Erro fatal:", msg);
    return new Response(JSON.stringify({ error: msg }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
