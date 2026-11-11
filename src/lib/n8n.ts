import "server-only";
import { timingSafeEqual } from "node:crypto";
import { createClient } from "@supabase/supabase-js";
import { z } from "zod";
import type { Database } from "@/lib/supabase/database.types";
import { SUPABASE_KEY, SUPABASE_URL } from "@/lib/supabase/env";

/**
 * Base das rotas /api/n8n/*. O n8n se identifica pelo cabeçalho x-n8n-segredo (N8N_SEGREDO na Vercel =
 * PORTAL_N8N_SEGREDO no n8n). A rota confere o segredo e chama as funções n8n_* do banco, que conferem de novo
 * (hash em privado.config) e fazem o trabalho. Nenhuma chave service_role é usada.
 */
function segredoConfere(recebido: string | null) {
  const esperado = process.env.N8N_SEGREDO;
  if (!esperado || !recebido) return false;
  const a = Buffer.from(recebido);
  const b = Buffer.from(esperado);
  return a.length === b.length && timingSafeEqual(a, b);
}

/** Cliente sem sessão: só alcança as funções n8n_* (que exigem o segredo). */
function clienteN8n() {
  return createClient<Database>(SUPABASE_URL, SUPABASE_KEY, { auth: { persistSession: false, autoRefreshToken: false } });
}

type Contexto = { segredo: string; supabase: ReturnType<typeof clienteN8n>; corpo: unknown };

/** Envolve uma rota: confere o segredo, lê o corpo JSON e transforma erros em respostas JSON. */
export function rotaN8n(executar: (ctx: Contexto) => Promise<unknown>) {
  return async (request: Request) => {
    const segredo = request.headers.get("x-n8n-segredo");
    if (!segredoConfere(segredo)) return Response.json({ erro: "não autorizado" }, { status: 401 });
    let corpo: unknown = {};
    if (request.method !== "GET") {
      const texto = await request.text();
      if (texto) {
        try {
          corpo = JSON.parse(texto);
        } catch {
          return Response.json({ erro: "corpo JSON inválido" }, { status: 400 });
        }
      }
    }
    try {
      return Response.json(await executar({ segredo: segredo!, supabase: clienteN8n(), corpo }));
    } catch (e) {
      if (e instanceof z.ZodError) return Response.json({ erro: e.issues[0]?.message ?? "dados inválidos" }, { status: 400 });
      const mensagem = e instanceof Error ? e.message : typeof e === "object" && e && "message" in e ? String(e.message) : "erro";
      return Response.json({ erro: mensagem }, { status: mensagem.includes("não encontrado") ? 404 : 500 });
    }
  };
}

/** Lança o erro do Supabase (vira resposta 500/404 em rotaN8n). */
export function exigir<T>({ data, error }: { data: T; error: { message: string } | null }): T {
  if (error) throw new Error(error.message);
  return data;
}

export const uuid = z.guid("id inválido");
