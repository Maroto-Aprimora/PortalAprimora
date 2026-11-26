"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { criarClienteServidor } from "@/lib/supabase/server";
import { mensagemDeErro } from "@/lib/erros";

export type Resultado = { ok: true } | { ok: false; erro: string };

const id = z.guid("Registro inválido.");
const SEM_PERMISSAO = "Só a equipe da Vice-Presidência dá, devolve e exclui tarefas da VP.";

function revalidar() {
  revalidatePath("/vice-presidencia/tarefas");
  revalidatePath("/tarefas");
  revalidatePath("/painel");
}

const esquema = z.object({
  titulo: z.string().trim().min(2, "Informe o título.").max(160),
  descricao: z.preprocess((v) => (v === "" ? null : v), z.string().trim().max(2000).nullable()),
  prazo: z.preprocess((v) => (v === "" ? null : v), z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Data inválida.").nullable()),
  prioridade: z.enum(["baixa", "media", "alta"]),
  exige_comprovante: z.boolean(),
});

/** A equipe da VP dá a mesma tarefa a um ou mais membros (uma tarefa por pessoa, para cada uma comprovar a sua). */
export async function darTarefa(dados: Record<string, unknown>, responsaveis: string[]): Promise<Resultado> {
  const v = esquema.safeParse(dados);
  if (!v.success) return { ok: false, erro: v.error.issues[0].message };
  const pessoas = [...new Set(responsaveis)].filter((r) => id.safeParse(r).success);
  if (!pessoas.length) return { ok: false, erro: "Escolha pelo menos um membro." };
  if (pessoas.length > 100) return { ok: false, erro: "Escolha no máximo 100 membros por vez." };
  const supabase = await criarClienteServidor();
  const { data: sessao } = await supabase.auth.getClaims();
  const eu = sessao?.claims?.sub ?? null;
  for (const pessoa of pessoas) {
    const { data, error } = await supabase.from("tarefas")
      .insert({ ...v.data, diretoria: "rh", origem: "manual", criado_por: eu }).select("id").single();
    if (error) return { ok: false, erro: error.code === "42501" ? SEM_PERMISSAO : mensagemDeErro(error) };
    const { error: e2 } = await supabase.from("tarefa_responsaveis").insert({ tarefa_id: data.id, membro_id: pessoa });
    if (e2) return { ok: false, erro: mensagemDeErro(e2) };
  }
  revalidar();
  return { ok: true };
}

/** O responsável conclui enviando a foto (já no Storage) e um texto. */
export async function concluirComComprovante(tarefa: string, caminho: string, texto: string): Promise<Resultado> {
  if (!id.safeParse(tarefa).success) return { ok: false, erro: "Registro inválido." };
  if (!caminho.startsWith(`tarefas/${tarefa}/`)) return { ok: false, erro: "Foto inválida." };
  const t = texto.trim();
  if (t.length < 2 || t.length > 1000) return { ok: false, erro: "Escreva o que foi feito (até 1000 caracteres)." };
  const supabase = await criarClienteServidor();
  const { data, error } = await supabase.from("tarefas")
    .update({ comprovante_caminho: caminho, comprovante_texto: t, status: "concluida" }).eq("id", tarefa).select("id");
  if (error) return { ok: false, erro: mensagemDeErro(error) };
  if (!data?.length) return { ok: false, erro: "Você não é responsável por esta tarefa." };
  revalidar();
  return { ok: true };
}

/** Sem comprovante exigido: só muda o andamento. */
export async function mudarAndamento(tarefa: string, status: "pendente" | "em_andamento" | "concluida"): Promise<Resultado> {
  if (!id.safeParse(tarefa).success) return { ok: false, erro: "Registro inválido." };
  const supabase = await criarClienteServidor();
  const { data, error } = await supabase.from("tarefas").update({ status }).eq("id", tarefa).select("id");
  if (error) return { ok: false, erro: mensagemDeErro(error) };
  if (!data?.length) return { ok: false, erro: "Você não pode alterar esta tarefa." };
  revalidar();
  return { ok: true };
}

/** A VP devolve para refazer: volta a pendente e o comprovante é descartado. */
export async function devolverTarefa(tarefa: string, caminho: string | null): Promise<Resultado> {
  if (!id.safeParse(tarefa).success) return { ok: false, erro: "Registro inválido." };
  const supabase = await criarClienteServidor();
  const { data, error } = await supabase.from("tarefas").update({ status: "pendente" }).eq("id", tarefa).eq("diretoria", "rh").select("id");
  if (error) return { ok: false, erro: mensagemDeErro(error) };
  if (!data?.length) return { ok: false, erro: SEM_PERMISSAO };
  if (caminho) await supabase.storage.from("comprovantes").remove([caminho]);
  revalidar();
  return { ok: true };
}

export async function excluirTarefaVp(tarefa: string, caminho: string | null): Promise<Resultado> {
  if (!id.safeParse(tarefa).success) return { ok: false, erro: "Registro inválido." };
  const supabase = await criarClienteServidor();
  const { data, error } = await supabase.from("tarefas").delete().eq("id", tarefa).eq("diretoria", "rh").select("id");
  if (error) return { ok: false, erro: mensagemDeErro(error) };
  if (!data?.length) return { ok: false, erro: SEM_PERMISSAO };
  if (caminho) await supabase.storage.from("comprovantes").remove([caminho]);
  revalidar();
  return { ok: true };
}
