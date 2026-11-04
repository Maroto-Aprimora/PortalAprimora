"use client";

import { useEffect, useState } from "react";
import { criarClienteNavegador } from "@/lib/supabase/client";
import { Loader2 } from "@/components/ui/icones";
import type { EmailOtpType } from "@supabase/supabase-js";

/**
 * Destino dos links enviados por e-mail. Aceita os três formatos do Supabase:
 *  - #access_token=...  (fluxo implícito, usado pelos links do portal)
 *  - ?token_hash=...&type=... (modelos de e-mail personalizados)
 *  - ?code=... (fluxo PKCE, quando o link é aberto no mesmo navegador)
 */
export default function PaginaConfirmar() {
  const [erro, setErro] = useState<string | null>(null);

  useEffect(() => {
    async function confirmar() {
      const supabase = criarClienteNavegador();
      const url = new URL(window.location.href);
      const proximoBruto = url.searchParams.get("proximo") ?? "/painel";
      const proximo = proximoBruto.startsWith("/") ? proximoBruto : "/painel";
      const hash = new URLSearchParams(url.hash.slice(1));

      let falha: string | null = hash.get("error_description");
      if (!falha && hash.get("access_token") && hash.get("refresh_token")) {
        const { error } = await supabase.auth.setSession({
          access_token: hash.get("access_token")!,
          refresh_token: hash.get("refresh_token")!,
        });
        falha = error?.message ?? null;
      } else if (!falha && url.searchParams.get("token_hash")) {
        const { error } = await supabase.auth.verifyOtp({
          token_hash: url.searchParams.get("token_hash")!,
          type: (url.searchParams.get("type") ?? "email") as EmailOtpType,
        });
        falha = error?.message ?? null;
      } else if (!falha && url.searchParams.get("code")) {
        const { error } = await supabase.auth.exchangeCodeForSession(url.searchParams.get("code")!);
        falha = error?.message ?? null;
      } else if (!falha) {
        falha = "Link inválido.";
      }

      if (falha) {
        setErro(falha);
        return;
      }
      window.location.replace(proximo);
    }
    confirmar();
  }, []);

  return (
    <main className="flex min-h-screen items-center justify-center px-6">
      <div className="max-w-sm text-center">
        {erro ? (
          <>
            <h1 className="text-xl font-bold">Não foi possível validar o link</h1>
            <p className="mt-2 text-sm text-texto-suave">
              O link pode ter expirado ou já ter sido usado. Peça um novo em “Primeiro acesso” ou “Esqueci minha senha”.
            </p>
            <a href="/entrar" className="mt-4 inline-block font-semibold text-marca underline-offset-4 hover:underline">Ir para o login</a>
          </>
        ) : (
          <>
            <Loader2 className="mx-auto h-8 w-8 animate-spin text-marca" />
            <p className="mt-4 text-sm text-texto-suave">Validando seu acesso…</p>
          </>
        )}
      </div>
    </main>
  );
}
