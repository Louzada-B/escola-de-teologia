import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { corsHeaders } from "../_shared/cors.ts";

// Fluxo sem conta: o client já autenticou anonimamente antes de chamar essa
// function (supabase.auth.signInAnonymously()). Aqui só validamos o código,
// gravamos o nome informado no profile, e matriculamos na turma.

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(JSON.stringify({ error: "Sessão não encontrada" }), {
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
      return new Response(JSON.stringify({ error: "Sessão não encontrada" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { code, full_name } = await req.json();
    const cleanCode = String(code || "").trim().toUpperCase();
    const cleanName = String(full_name || "").trim();

    if (!cleanCode || !cleanName) {
      return new Response(JSON.stringify({ error: "Código e nome são obrigatórios" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const adminClient = createClient(supabaseUrl, serviceRoleKey);

    const { data: cohort, error: cohortError } = await adminClient
      .from("cohorts")
      .select("id, name, course_id, courses(id, name, access_model, has_attendance, has_certificates)")
      .eq("access_code", cleanCode)
      .maybeSingle();

    if (cohortError || !cohort) {
      return new Response(JSON.stringify({ error: "Código inválido. Confira com quem te passou o código." }), {
        status: 404,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const course = (cohort as any).courses;
    if (!course || course.access_model !== "code") {
      return new Response(JSON.stringify({ error: "Este código não é válido para acesso sem conta" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { error: profileError } = await adminClient
      .from("profiles")
      .update({ full_name: cleanName })
      .eq("id", caller.id);

    if (profileError) {
      return new Response(JSON.stringify({ error: profileError.message }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { error: enrollError } = await adminClient
      .from("cohort_students")
      .upsert({ cohort_id: cohort.id, user_id: caller.id }, { onConflict: "cohort_id,user_id", ignoreDuplicates: true });

    if (enrollError) {
      return new Response(JSON.stringify({ error: enrollError.message }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    return new Response(
      JSON.stringify({
        cohort_id: cohort.id,
        cohort_name: cohort.name,
        course_id: course.id,
        course_name: course.name,
        has_attendance: course.has_attendance,
        has_certificates: course.has_certificates,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (err: any) {
    return new Response(JSON.stringify({ error: err?.message || JSON.stringify(err) }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
