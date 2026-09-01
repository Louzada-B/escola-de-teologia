import { createContext, useContext, useState, ReactNode } from "react";
import { supabase } from "@/integrations/supabase/client";

interface ImpersonationContextType {
  isImpersonating: boolean;
  impersonatedName: string | null;
  startImpersonation: (userId: string) => Promise<{ error?: string }>;
  stopImpersonation: () => Promise<void>;
}

const ImpersonationContext = createContext<ImpersonationContextType>({
  isImpersonating: false,
  impersonatedName: null,
  startImpersonation: async () => ({ error: "Contexto não inicializado" }),
  stopImpersonation: async () => {},
});

export const useImpersonation = () => useContext(ImpersonationContext);

// sessionStorage (não localStorage): some sozinho se fechar a aba, e não
// compete com a chave que o próprio Supabase usa pra sessão ativa.
const ADMIN_SESSION_KEY = "imp_admin_session";
const ACTIVE_KEY = "imp_active";
const NAME_KEY = "imp_target_name";

export function ImpersonationProvider({ children }: { children: ReactNode }) {
  const [isImpersonating, setIsImpersonating] = useState(
    () => sessionStorage.getItem(ACTIVE_KEY) === "1"
  );
  const [impersonatedName, setImpersonatedName] = useState<string | null>(
    () => sessionStorage.getItem(NAME_KEY)
  );

  const startImpersonation = async (userId: string) => {
    // Guarda a sessão de admin de lado ANTES de trocar -- é isso que
    // permite voltar depois sem precisar logar de novo com senha.
    const { data: { session: adminSession } } = await supabase.auth.getSession();
    if (!adminSession) return { error: "Sessão de admin não encontrada." };

    const { data: fnData, error: fnError } = await supabase.functions.invoke("impersonate-user", {
      body: { target_user_id: userId },
    });
    if (fnError || (fnData as any)?.error) {
      return { error: (fnData as any)?.error || fnError?.message || "Falha ao iniciar simulação." };
    }

    const { error: verifyError } = await supabase.auth.verifyOtp({
      token_hash: (fnData as any).hashed_token,
      type: "email",
    });
    if (verifyError) {
      return { error: verifyError.message };
    }

    sessionStorage.setItem(
      ADMIN_SESSION_KEY,
      JSON.stringify({
        access_token: adminSession.access_token,
        refresh_token: adminSession.refresh_token,
      })
    );
    sessionStorage.setItem(ACTIVE_KEY, "1");
    sessionStorage.setItem(NAME_KEY, (fnData as any).target_name);
    setIsImpersonating(true);
    setImpersonatedName((fnData as any).target_name);

    // Recarrega a página inteira -- garante que todo o app (AuthContext,
    // CohortContext, etc.) reinicia do zero com a sessão nova, em vez de
    // arriscar algum estado antigo do admin ainda em cache.
    window.location.href = "/dashboard";
    return {};
  };

  const stopImpersonation = async () => {
    const raw = sessionStorage.getItem(ADMIN_SESSION_KEY);
    if (!raw) return;
    const { access_token, refresh_token } = JSON.parse(raw);

    await supabase.auth.setSession({ access_token, refresh_token });

    sessionStorage.removeItem(ADMIN_SESSION_KEY);
    sessionStorage.removeItem(ACTIVE_KEY);
    sessionStorage.removeItem(NAME_KEY);
    setIsImpersonating(false);
    setImpersonatedName(null);

    window.location.href = "/dashboard";
  };

  return (
    <ImpersonationContext.Provider
      value={{ isImpersonating, impersonatedName, startImpersonation, stopImpersonation }}
    >
      {children}
    </ImpersonationContext.Provider>
  );
}
