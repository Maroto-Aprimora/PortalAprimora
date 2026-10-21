"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { criarClienteServidor } from "@/lib/supabase/server";
import { mensagemDeErro } from "@/lib/erros";

export type Resultado = { ok: true } | { ok: false; erro: string };

/** Marca (ou desmarca) uma ocorrência como resolvida. Só o diretor comercial consegue (RLS). */
export async function marcarResolvida(id: string, resolvida: boolean): Promise<Resultado> {
  if (!z.string().uuid().safeParse(id).success) return { ok: false, erro: "Ocorrência inválida." };
  const supabase = await criarClienteServidor();
  const { data, error } = await supabase.from("ocorrencias")
    .update({ resolvida_em: resolvida ? new Date().toISOString() : null }).eq("id", id).select("id");
  if (error) return { ok: false, erro: mensagemDeErro(error) };
  if (!data?.length) return { ok: false, erro: "Sem permissão ou ocorrência não encontrada." };
  revalidatePath("/controle");
  return { ok: true };
}

/** Registra um erro de tela (chamado pela tela de erro do portal). Falhas aqui são ignoradas. */
export async function registrarErroTela(mensagem: string, codigo: string | undefined, caminho: string) {
  try {
    const supabase = await criarClienteServidor();
    await supabase.rpc("registrar_erro_app", { _mensagem: mensagem.slice(0, 1000), _codigo: codigo?.slice(0, 100), _caminho: caminho.slice(0, 200) });
  } catch {
    // sem rede ou sem sessão: nada a fazer
  }
}
