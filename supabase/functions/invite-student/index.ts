import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { corsHeaders } from "../_shared/cors.ts";

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

    const { students, redirectTo } = await req.json();

    if (!students || !Array.isArray(students) || students.length === 0) {
      return new Response(JSON.stringify({ error: "Lista de alunos vazia" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const adminClient = createClient(supabaseUrl, serviceRoleKey);
    const results: { email: string; success: boolean; error?: string }[] = [];

    for (const student of students) {
      const email = String(student.email || "").trim().toLowerCase();
      const fullName = String(student.full_name || "").trim();
      const cohortId = String(student.cohort_id || "").trim();

      if (!email || !cohortId) {
        results.push({ email, success: false, error: "E-mail e turma são obrigatórios" });
        continue;
      }

      try {
        // Busca o usuário pelo e-mail diretamente em auth.users via admin API
        const { data: { users: existingUsers }, error: listError } = await adminClient.auth.admin.listUsers();
        
        if (listError) {
          console.error("[invite-student] Erro ao listar usuários:", listError.message);
          results.push({ email, success: false, error: "Erro ao verificar usuário existente: " + listError.message });
          continue;
        }

        const existingUser = existingUsers?.find((u) => u.email?.toLowerCase() === email);
        let userId: string;

        if (existingUser) {
          // Usuário já existe — só vincula à turma
          console.log("[invite-student] Usuário já existe:", email);
          userId = existingUser.id;
        } else {
          // Cria usuário via convite
          console.log("[invite-student] Convidando novo usuário:", email);
          const { data: inviteData, error: inviteError } = await adminClient.auth.admin.inviteUserByEmail(email, {
            data: { full_name: fullName, role: "aluno" },
            redirectTo,
          });

          if (inviteError) {
            const msg = inviteError.message || JSON.stringify(inviteError);
            console.error("[invite-student] Erro no convite:", msg);
            results.push({ email, success: false, error: msg });
            continue;
          }

          userId = inviteData.user.id;
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
        console.error("[invite-student] Exceção para", email, ":", msg);
        results.push({ email, success: false, error: msg });
      }
    }

    const successCount = results.filter((r) => r.success).length;
    const errorCount = results.filter((r) => !r.success).length;

    console.log("[invite-student] Resultado:", successCount, "sucesso(s),", errorCount, "erro(s)");

    return new Response(
      JSON.stringify({ results, successCount, errorCount }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (err: any) {
    const msg = err?.message || JSON.stringify(err) || "Erro fatal desconhecido";
    console.error("[invite-student] Erro fatal:", msg);
    return new Response(JSON.stringify({ error: msg }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
