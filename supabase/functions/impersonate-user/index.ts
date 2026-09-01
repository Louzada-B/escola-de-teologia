import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { corsHeaders } from "../_shared/cors.ts";

// Gera um token de sessão pro aluno alvo, pra super admin "virar" ele no
// portal. Restrito a super admin -- confere isso do lado do servidor, não
// só escondendo o botão na tela (mesmo padrão de list-temp-passwords).
//
// Não devolve uma sessão pronta direto -- devolve um hashed_token que o
// FRONTEND troca por uma sessão de verdade via supabase.auth.verifyOtp().
// Isso evita qualquer manipulação manual de URL de redirect/fragmento.

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
    const anonKey = Deno.env.get("SUPABASE_ANON_KEY")!;

    const userClient = createClient(supabaseUrl, anonKey, {
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
      .select("is_super_admin")
      .eq("id", caller.id)
      .single();

    if (!callerProfile?.is_super_admin) {
      return new Response(JSON.stringify({ error: "Apenas o administrador master pode fazer isso" }), {
        status: 403,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { target_user_id } = await req.json();
    if (!target_user_id) {
      return new Response(JSON.stringify({ error: "target_user_id é obrigatório" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const admin = createClient(supabaseUrl, serviceRoleKey);

    const { data: targetUserData, error: getUserErr } = await admin.auth.admin.getUserById(target_user_id);
    if (getUserErr || !targetUserData?.user?.email) {
      return new Response(JSON.stringify({ error: "Aluno não encontrado" }), {
        status: 404,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { data: linkData, error: linkErr } = await admin.auth.admin.generateLink({
      type: "magiclink",
      email: targetUserData.user.email,
    });

    if (linkErr || !linkData?.properties?.hashed_token) {
      return new Response(JSON.stringify({ error: linkErr?.message || "Falha ao gerar acesso" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { data: targetProfile } = await admin
      .from("profiles")
      .select("full_name, email")
      .eq("id", target_user_id)
      .maybeSingle();

    return new Response(
      JSON.stringify({
        hashed_token: linkData.properties.hashed_token,
        target_name: targetProfile?.full_name || targetProfile?.email || targetUserData.user.email,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (err: any) {
    return new Response(JSON.stringify({ error: err?.message || "Erro inesperado" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
