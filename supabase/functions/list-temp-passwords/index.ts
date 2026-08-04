import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { corsHeaders } from "../_shared/cors.ts";

// Lista senhas temporárias (tabela `pass`) com nome, e-mail e último acesso,
// pra dar visibilidade de quem ainda não trocou a senha gerada no convite.
// Restrito a super admin -- não é algo que um admin/professor comum deveria
// enxergar, já que dá acesso à senha de outra pessoa em texto puro.

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
      .select("is_super_admin")
      .eq("id", caller.id)
      .single();

    if (!callerProfile?.is_super_admin) {
      return new Response(JSON.stringify({ error: "Apenas super administradores podem ver essa lista" }), {
        status: 403,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const adminClient = createClient(supabaseUrl, serviceRoleKey);

    const { data: passRows, error: passError } = await adminClient
      .from("pass")
      .select("user_id, pass_temp");

    if (passError) {
      return new Response(JSON.stringify({ error: passError.message }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (!passRows || passRows.length === 0) {
      return new Response(JSON.stringify({ items: [] }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const userIds = passRows.map((r) => r.user_id);

    const { data: profiles } = await adminClient
      .from("profiles")
      .select("id, full_name, email")
      .in("id", userIds);

    const profileMap: Record<string, { full_name: string | null; email: string }> = {};
    for (const p of profiles || []) profileMap[p.id] = { full_name: p.full_name, email: p.email };

    // last_sign_in_at só vem via admin API, não existe em `profiles`
    const lastSignInMap: Record<string, string | null> = {};
    let page = 1;
    const perPage = 200;
    while (true) {
      const { data: listData, error: listError } = await adminClient.auth.admin.listUsers({ page, perPage });
      if (listError) break;
      for (const u of listData.users) {
        lastSignInMap[u.id] = u.last_sign_in_at ?? null;
      }
      if (listData.users.length < perPage) break;
      page += 1;
    }

    const items = passRows.map((r) => ({
      user_id: r.user_id,
      full_name: profileMap[r.user_id]?.full_name || "",
      email: profileMap[r.user_id]?.email || "",
      last_sign_in_at: lastSignInMap[r.user_id] ?? null,
      pass_temp: r.pass_temp,
    }));

    return new Response(JSON.stringify({ items }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err: any) {
    return new Response(JSON.stringify({ error: err?.message || JSON.stringify(err) }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
