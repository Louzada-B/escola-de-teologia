import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { SMTPClient } from "https://deno.land/x/denomailer@1.6.0/mod.ts";
import { corsHeaders } from "../_shared/cors.ts";
import { notifyAdmin, notifyEmailWrap, toAsciiSubject, cleanHtml } from "../_shared/notify.ts";

const btoaSafe = (str: string) => {
  const bytes = new TextEncoder().encode(str);
  let binary = "";
  bytes.forEach(b => binary += String.fromCharCode(b));
  return btoa(binary);
};

serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const { studentEmail, studentName, cohortName, issuedDate, pdfBase64 } = await req.json();

    const smtpUser = Deno.env.get("SMTP_USER")!;
    const smtpPass = Deno.env.get("SMTP_PASS")!;
    const smtpHost = Deno.env.get("SMTP_HOST")!;
    const smtpPort = Number(Deno.env.get("SMTP_PORT") ?? "465");

    if (!smtpUser || !smtpPass) {
      throw new Error("SMTP_USER e SMTP_PASS não configurados nos secrets.");
    }

    const client = new SMTPClient({
      connection: {
        hostname: smtpHost,
        port: smtpPort,
        tls: true,
        auth: {
          username: smtpUser,
          password: smtpPass,
        },
      },
    });

    const subject = toAsciiSubject(`Certificado de Conclus\u00e3o \u2014 Escola de Teologia Brasa Church`);
    const pdfFilename = `Certificado_${studentName.replace(/\s+/g, "_")}.pdf`;

    const emailHtml = `
<div style="font-family:Arial,Helvetica,sans-serif;background:#f0f4f8;padding:24px;">
<div style="background:#ffffff;border-radius:8px;max-width:520px;margin:0 auto;overflow:hidden;">
  <div style="background:#1a2e52;padding:32px 40px 28px;text-align:center;">
    <h1 style="color:#ffffff;font-size:20px;font-weight:700;margin:0;letter-spacing:0.5px;">Escola de Teologia Brasa Church</h1>
    <p style="color:#8fabd4;font-size:12px;margin:4px 0 0;letter-spacing:1px;text-transform:uppercase;">Certificado de Conclus\u00e3o</p>
  </div>
  <div style="padding:36px 40px;">
    <h2 style="color:#1a2e52;font-size:22px;font-weight:700;margin:0 0 12px;">Parab\u00e9ns, ${studentName}!</h2>
    <p style="color:#4a5568;font-size:15px;line-height:1.7;margin:0 0 16px;">
      \u00c9 com grande satisfa\u00e7\u00e3o que a <strong>Escola de Teologia Brasa Church</strong> emite seu certificado
      de conclus\u00e3o do curso de forma\u00e7\u00e3o teol\u00f3gica \u2014 <strong>${cohortName}</strong>.
    </p>
    <p style="color:#4a5568;font-size:15px;line-height:1.7;margin:0 0 20px;">
      Seu certificado est\u00e1 em anexo a este e-mail. Guarde-o com cuidado \u2014 ele \u00e9 o reconhecimento
      do seu comprometimento e dedica\u00e7\u00e3o ao estudo da Palavra.
    </p>
    <p style="color:#4a5568;font-size:15px;line-height:1.7;margin:0;">
      Que esse aprendizado continue frutificando em sua vida e minist\u00e9rio.
    </p>
    <hr style="border:none;border-top:1px solid #e8ecf1;margin:24px 0;">
    <p style="font-size:12px;color:#8a9ab0;margin:0;">Emitido em: ${issuedDate}</p>
  </div>
  <div style="background:#f8f9fb;border-top:1px solid #e8ecf1;padding:20px 40px;text-align:center;">
    <p style="color:#8a9ab0;font-size:12px;margin:0;line-height:1.6;">
      Escola de Teologia Brasa Church \u2014 Portal Acad\u00eamico<br>
      Este \u00e9 um e-mail autom\u00e1tico, por favor n\u00e3o responda.
    </p>
  </div>
</div>
</div>`;

    await client.send({
      from: `Escola de Teologia Brasa Church <${smtpUser}>`,
      to: studentEmail,
      subject,
      html: cleanHtml(emailHtml),
      attachments: [
        {
          filename: pdfFilename,
          content: pdfBase64,
          encoding: "base64",
          contentType: "application/pdf",
        },
      ],
    });

    await client.close();

    const now = new Date().toLocaleString("pt-BR", { timeZone: "America/Sao_Paulo" });
    await notifyAdmin(
      "Certificado enviado — Formação Teológica",
      notifyEmailWrap(`
        <p style="margin:0 0 12px;color:#1a2e52;"><strong>Foi enviado certificado de conclusão</strong></p>
        <p style="margin:0 0 8px;color:#4a5568;">Horário: ${now}</p>
        <p style="margin:0 0 4px;color:#4a5568;">Aluno: ${studentName} (${studentEmail})</p>
        <p style="margin:0;color:#4a5568;">Turma: ${cohortName}</p>
      `),
    );

    return new Response(
      JSON.stringify({ success: true }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error: any) {
    console.error("send-certificate error:", error);
    return new Response(
      JSON.stringify({ error: error?.message ?? String(error) }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
