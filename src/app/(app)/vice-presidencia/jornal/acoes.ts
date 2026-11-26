"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { criarClienteServidor } from "@/lib/supabase/server";
import { mensagemDeErro } from "@/lib/erros";

export type Resultado = { ok: true } | { ok: false; erro: string };

const esquema = z.object({
  titulo: z.string().trim().min(2, "Dê um título.").max(120),
  conteudo: z.string().trim().min(2, "Conte o que você fez.").max(4000, "Máximo de 4000 caracteres."),
});

/** Cada um escreve no mês atual, com o próprio nome (o banco garante). */
export async function salvarTexto(id: string | null, dados: Record<string, unknown>): Promise<Resultado> {
  const v = esquema.safeParse(dados);
  if (!v.success) return { ok: false, erro: v.error.issues[0].message };
  if (id && !z.guid().safeParse(id).success) return { ok: false, erro: "Registro inválido." };
  const supabase = await criarClienteServidor();
  const { data: sessao } = await supabase.auth.getClaims();
  const { data, error } = id
    ? await supabase.from("jornal_textos").update(v.data).eq("id", id).select("id")
    : await supabase.from("jornal_textos").insert({ ...v.data, autor_id: sessao?.claims?.sub ?? "" }).select("id");
  if (error) return { ok: false, erro: mensagemDeErro(error) };
  if (!data?.length) return { ok: false, erro: "Só quem escreveu edita, e apenas na edição do mês atual." };
  revalidatePath("/vice-presidencia/jornal");
  return { ok: true };
}

export async function excluirTexto(id: string): Promise<Resultado> {
  if (!z.guid().safeParse(id).success) return { ok: false, erro: "Registro inválido." };
  const supabase = await criarClienteServidor();
  const { data, error } = await supabase.from("jornal_textos").delete().eq("id", id).select("id");
  if (error) return { ok: false, erro: mensagemDeErro(error) };
  if (!data?.length) return { ok: false, erro: "Você não pode excluir este texto." };
  revalidatePath("/vice-presidencia/jornal");
  return { ok: true };
}
