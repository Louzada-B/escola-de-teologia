import { SMTPClient } from "https://deno.land/x/denomailer@1.6.0/mod.ts";

// E-mail que recebe o resumo de todo envio feito pelo sistema (convites,
// certificados, lembretes automáticos). Chamadas aqui NUNCA lançam erro —
// uma falha ao notificar o admin não pode derrubar o envio principal.
// Configurável via secret ADMIN_NOTIFY_EMAIL -- importante em staging, pra
// não misturar notificação de teste com a caixa real de produção.
const NOTIFY_EMAIL = Deno.env.get("ADMIN_NOTIFY_EMAIL") || "escoladeteologia@brasachurch.com";

export async function notifyAdmin(subject: string, htmlBody: string) {
  try {
    const smtpUser = Deno.env.get("SMTP_USER")!;
    const smtpPass = Deno.env.get("SMTP_PASS")!;
    const smtpHost = Deno.env.get("SMTP_HOST")!;
    const smtpPort = Number(Deno.env.get("SMTP_PORT") ?? "465");

    const client = new SMTPClient({
      connection: {
        hostname: smtpHost,
        port: smtpPort,
        tls: true,
        auth: { username: smtpUser, password: smtpPass },
      },
    });

    await client.send({
      from: `Formação Teológica <${smtpUser}>`,
      to: NOTIFY_EMAIL,
      subject,
      html: htmlBody,
    });
    await client.close();
  } catch (err) {
    console.error("[notifyAdmin] falha ao enviar notificação administrativa:", err);
  }
}

export function notifyEmailWrap(body: string) {
  return `
<div style="font-family:Arial,Helvetica,sans-serif;background:#f0f4f8;padding:24px;">
<div style="background:#ffffff;border-radius:8px;max-width:560px;margin:0 auto;overflow:hidden;">
  <div style="background:#1a2e52;padding:28px 40px 24px;text-align:center;">
    <h1 style="color:#ffffff;font-size:18px;font-weight:700;margin:0;">Formação Teológica</h1>
    <p style="color:#8fabd4;font-size:11px;margin:4px 0 0;letter-spacing:1px;text-transform:uppercase;">Notificação administrativa</p>
  </div>
  <div style="padding:28px 40px;">${body}</div>
</div>
</div>`;
}
