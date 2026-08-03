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
    const results: { email: string; success: boolean; error?: string; resent?: boolean }[] = [];

    // Mapa de e-mail -> confirmado (auth.users.confirmed_at) para decidir quem está pendente
    const confirmedMap: Record<string, boolean> = {};
    {
      let page = 1;
      const perPage = 200;
      while (true) {
        const { data: listData, error: listError } = await adminClient.auth.admin.listUsers({ page, perPage });
        if (listError) break; // se falhar, segue sem o mapa (comportamento antigo: nunca reenvia)
        for (const u of listData.users) {
          if (u.email) confirmedMap[u.email.toLowerCase()] = Boolean(u.confirmed_at);
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
          const isConfirmed = confirmedMap[email] ?? true; // se não sabemos, não mexe (comportamento seguro)

          if (!isConfirmed) {
            const { error: resendError } = await adminClient.auth.admin.inviteUserByEmail(email, {
              data: { full_name: fullName, role: "aluno" },
              redirectTo,
            });
            // Não é fatal: mesmo se o reenvio falhar, o aluno já tem perfil e vínculo com a turma segue normalmente
            if (!resendError) resent = true;
          }
        } else {
          const { data: inviteData, error: inviteError } = await adminClient.auth.admin.inviteUserByEmail(email, {
            data: { full_name: fullName, role: "aluno" },
            redirectTo,
          });

          if (inviteError) {
            results.push({ email, success: false, error: inviteError.message || JSON.stringify(inviteError) });
            continue;
          }
          userId = inviteData.user.id;
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
