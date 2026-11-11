"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { criarClienteServidor } from "@/lib/supabase/server";
import { mensagemDeErro } from "@/lib/erros";

export type Resultado<T = undefined> = { ok: true; dados?: T } | { ok: false; erro: string };

const data = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Data inválida");

/** Gera o relatório da R.I: números calculados no banco agora; o Analista gerencial (A4) escreve a análise pela fila. */
export async function gerarRelatorioRi(entrada: { de: string; ate: string }): Promise<Resultado<{ id: string }>> {
  const v = z.object({ de: data, ate: data }).safeParse(entrada);
  if (!v.success) return { ok: false, erro: v.error.issues[0].message };
  const supabase = await criarClienteServidor();
  const { data: id, error } = await supabase.rpc("gerar_relatorio_ri", { _de: v.data.de, _ate: v.data.ate });
  if (error) return { ok: false, erro: mensagemDeErro(error) };
  revalidatePath("/comercial/relatorios");
  return { ok: true, dados: { id } };
}

/** Salva o texto revisado pelo diretor (a versão que vai para a R.I). */
export async function salvarRevisao(entrada: { id: string; texto: string }): Promise<Resultado> {
  const v = z.object({ id: z.guid(), texto: z.string().trim().max(50000) }).safeParse(entrada);
  if (!v.success) return { ok: false, erro: v.error.issues[0].message };
  const supabase = await criarClienteServidor();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { ok: false, erro: "Sessão expirada. Entre de novo." };
  const { data: linhas, error } = await supabase.from("relatorios")
    .update({ texto_revisado: v.data.texto || null, revisado_por: user.id, revisado_em: new Date().toISOString() })
    .eq("id", v.data.id).select("id");
  if (error) return { ok: false, erro: mensagemDeErro(error) };
  if (!linhas?.length) return { ok: false, erro: "Relatório não encontrado." };
  revalidatePath(`/comercial/relatorios/${v.data.id}`);
  revalidatePath("/comercial/relatorios");
  return { ok: true };
}
