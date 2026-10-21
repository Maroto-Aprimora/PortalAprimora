import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import { SUPABASE_KEY, SUPABASE_URL } from "./env";

/** Rotas acessíveis sem login. */
// /api/n8n e /api/integracoes: chamadas de sistemas externos, protegidas por segredo/token (não pela sessão)
const ROTAS_PUBLICAS = ["/entrar", "/primeiro-acesso", "/esqueci-senha", "/auth", "/api/push", "/api/n8n", "/api/integracoes", "/api/agenda"];

/** Renova a sessão a cada requisição e manda para /entrar quem não está logado. */
export async function atualizarSessao(request: NextRequest) {
  let response = NextResponse.next({ request });

  const supabase = createServerClient(SUPABASE_URL, SUPABASE_KEY, {
    cookies: {
      getAll() {
        return request.cookies.getAll();
      },
      setAll(cookiesToSet) {
        cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value));
        response = NextResponse.next({ request });
        cookiesToSet.forEach(({ name, value, options }) => response.cookies.set(name, value, options));
      },
    },
  });

  // Não coloque código entre createServerClient e getClaims (recomendação do Supabase).
  const { data } = await supabase.auth.getClaims();
  const logado = !!data?.claims;
  const caminho = request.nextUrl.pathname;
  const publica = ROTAS_PUBLICAS.some((r) => caminho === r || caminho.startsWith(r + "/"));

  if (!logado && !publica) {
    const url = request.nextUrl.clone();
    url.pathname = "/entrar";
    url.searchParams.set("voltar", caminho);
    return NextResponse.redirect(url);
  }
  if (logado && (caminho === "/entrar" || caminho === "/primeiro-acesso")) {
    const url = request.nextUrl.clone();
    url.pathname = "/painel";
    url.search = "";
    return NextResponse.redirect(url);
  }
  return response;
}
