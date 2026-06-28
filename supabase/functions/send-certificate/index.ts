import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { corsHeaders } from "../_shared/cors.ts";

serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const { studentEmail, studentName, cohortName, issuedDate, pdfBase64 } = await req.json();

    const smtpHost = Deno.env.get("SMTP_HOST") ?? "smtp.gmail.com";
    const smtpPort = parseInt(Deno.env.get("SMTP_PORT") ?? "587");
    const smtpUser = Deno.env.get("SMTP_USER")!;
    const smtpPass = Deno.env.get("SMTP_PASS")!;

    if (!smtpUser || !smtpPass) {
      throw new Error("SMTP credentials not configured. Set SMTP_USER and SMTP_PASS secrets.");
    }

    const emailHtml = `
<div style="font-family:Arial,Helvetica,sans-serif;background:#f0f4f8;padding:24px;">
<div style="background:#ffffff;border-radius:8px;max-width:520px;margin:0 auto;overflow:hidden;">
  <div style="background:#1a2e52;padding:32px 40px 28px;text-align:center;">
    <h1 style="color:#ffffff;font-size:20px;font-weight:700;margin:0;letter-spacing:0.5px;">Escola de Teologia Brasa Church</h1>
    <p style="color:#8fabd4;font-size:12px;margin:4px 0 0;letter-spacing:1px;text-transform:uppercase;">Certificado de Conclusão</p>
  </div>
  <div style="padding:36px 40px;">
    <h2 style="color:#1a2e52;font-size:22px;font-weight:700;margin:0 0 12px;">Parabéns, ${studentName}!</h2>
    <p style="color:#4a5568;font-size:15px;line-height:1.7;margin:0 0 16px;">
      É com grande satisfação que a <strong>Escola de Teologia Brasa Church</strong> emite seu certificado
      de conclusão do curso de formação teológica — <strong>${cohortName}</strong>.
    </p>
    <p style="color:#4a5568;font-size:15px;line-height:1.7;margin:0 0 20px;">
      Seu certificado está em anexo a este e-mail. Guarde-o com cuidado — ele é o reconhecimento
      do seu comprometimento e dedicação ao estudo da Palavra.
    </p>
    <p style="color:#4a5568;font-size:15px;line-height:1.7;margin:0 0 8px;">
      Que esse aprendizado continue frutificando em sua vida e ministério.
    </p>
    <hr style="border:none;border-top:1px solid #e8ecf1;margin:24px 0;">
    <p style="font-size:12px;color:#8a9ab0;margin:0;">
      Emitido em: ${issuedDate}
    </p>
  </div>
  <div style="background:#f8f9fb;border-top:1px solid #e8ecf1;padding:20px 40px;text-align:center;">
    <p style="color:#8a9ab0;font-size:12px;margin:0;line-height:1.6;">
      Escola de Teologia Brasa Church — Portal Acadêmico<br>
      Este é um e-mail automático, por favor não responda.
    </p>
  </div>
</div>
</div>`;

    // Build raw MIME message with PDF attachment
    // btoa seguro para strings com caracteres fora do Latin1
    const btoaSafe = (str: string) => {
      const bytes = new TextEncoder().encode(str);
      let binary = "";
      bytes.forEach(b => binary += String.fromCharCode(b));
      return btoa(binary);
    };

    const boundary = `----=_Part_${Date.now()}`;
    const pdfFilename = `Certificado_${studentName.replace(/\s+/g, "_")}.pdf`;

    const rawMessage = [
      `From: Escola de Teologia Brasa Church <${smtpUser}>`,
      `To: ${studentEmail}`,
      `Subject: =?UTF-8?B?${btoaSafe("Certificado de Conclus\u00e3o \u2014 Escola de Teologia Brasa Church")}?=`,
      `MIME-Version: 1.0`,
      `Content-Type: multipart/mixed; boundary="${boundary}"`,
      ``,
      `--${boundary}`,
      `Content-Type: text/html; charset=UTF-8`,
      `Content-Transfer-Encoding: quoted-printable`,
      ``,
      emailHtml,
      ``,
      `--${boundary}`,
      `Content-Type: application/pdf; name="${pdfFilename}"`,
      `Content-Transfer-Encoding: base64`,
      `Content-Disposition: attachment; filename="${pdfFilename}"`,
      ``,
      pdfBase64,
      ``,
      `--${boundary}--`,
    ].join("\r\n");

    // Send via SMTP using fetch to Gmail API or raw SMTP
    // Using Deno TCP for SMTP
    const conn = await Deno.connectTls({
      hostname: smtpHost,
      port: smtpPort === 465 ? 465 : undefined as any,
      ...(smtpPort !== 465 ? {} : {}),
    }).catch(async () => {
      // Fallback: try plain TCP with STARTTLS
      return await Deno.connect({ hostname: smtpHost, port: smtpPort });
    });

    // Use the SMTPClient from denomailer
    const { SMTPClient } = await import("https://deno.land/x/denomailer@1.6.0/mod.ts");

    const client = new SMTPClient({
      connection: {
        hostname: smtpHost,
        port: smtpPort,
        tls: smtpPort === 465,
        auth: {
          username: smtpUser,
          password: smtpPass,
        },
      },
    });

    await client.send({
      from: `Escola de Teologia Brasa Church <${smtpUser}>`,
      to: studentEmail,
      subject: `Certificado de Conclusão — Escola de Teologia Brasa Church`,
      html: emailHtml,
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

    return new Response(
      JSON.stringify({ success: true }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error: any) {
    console.error("send-certificate error:", error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
