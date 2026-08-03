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
      return new Response(JSON.stringify({ error: "Apenas administradores e professores podem ver o status dos alunos" }), {
        status: 403,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const adminClient = createClient(supabaseUrl, serviceRoleKey);

    // auth.admin.listUsers is paginated (default 50/page) — walk all pages
    const statuses: Record<string, { confirmed_at: string | null; last_sign_in_at: string | null }> = {};
    let page = 1;
    const perPage = 200;

    while (true) {
      const { data, error } = await adminClient.auth.admin.listUsers({ page, perPage });
      if (error) {
        return new Response(JSON.stringify({ error: error.message }), {
          status: 500,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      for (const u of data.users) {
        statuses[u.id] = {
          confirmed_at: u.confirmed_at ?? null,
          last_sign_in_at: u.last_sign_in_at ?? null,
        };
      }

      if (data.users.length < perPage) break;
      page += 1;
    }

    return new Response(JSON.stringify({ statuses }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err: any) {
    return new Response(JSON.stringify({ error: err?.message || JSON.stringify(err) }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
