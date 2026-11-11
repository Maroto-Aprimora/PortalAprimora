"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { criarClienteServidor } from "@/lib/supabase/server";
import { mensagemDeErro } from "@/lib/erros";
import { obterUsuario } from "@/lib/usuario";

export type Resultado = { ok: true } | { ok: false; erro: string };
const nulo = (v: unknown) => (typeof v === "string" && v.trim() === "" ? null : typeof v === "string" ? v.trim() : v);

const esquema = z.object({
  titulo: z.string().trim().min(2, "Informe o título."),
  descricao: z.preprocess(nulo, z.string().nullable().optional()),
  prazo: z.preprocess(nulo, z.string().regex(/^\d{4}-\d{2}-\d{2}$/).nullable().optional()),
  prioridade: z.enum(["baixa", "media", "alta"]),
  negocio_id: z.preprocess(nulo, z.guid().nullable().optional()),
  diretoria: z.string().min(1),
});

function revalidar() {
  revalidatePath("/tarefas");
  revalidatePath("/painel");
}

/**
 * O diretor cria e edita tarefas para qualquer pessoa; os demais, só tarefas pessoais (para si mesmos).
 * O banco garante as duas regras (RLS e gatilho proteger_tarefa).
 */
export async function salvarTarefa(id: string | null, dados: Record<string, unknown>, responsaveis: string[]): Promise<Resultado> {
  const v = esquema.safeParse(dados);
  if (!v.success) return { ok: false, erro: v.error.issues[0].message };
  const [usuario, supabase] = await Promise.all([obterUsuario(), criarClienteServidor()]);
  // Tarefa pessoal: o único responsável é quem cria
  if (!usuario.ehDiretorDe(v.data.diretoria)) responsaveis = [usuario.id];
  if (responsaveis.length === 0) return { ok: false, erro: "Escolha pelo menos um responsável." };

  let tarefaId = id;
  if (id) {
    const { diretoria: _ignorada, ...campos } = v.data;
    void _ignorada;
    const { data, error } = await supabase.from("tarefas").update(campos).eq("id", id).select("id");
    if (error) return { ok: false, erro: mensagemDeErro(error) };
    if (!data?.length) return { ok: false, erro: "Você só pode editar as tarefas que criou para si." };
  } else {
    const { data, error } = await supabase.from("tarefas").insert({ ...v.data, origem: "manual", criado_por: usuario.id }).select("id").single();
    if (error) return { ok: false, erro: mensagemDeErro(error) };
    tarefaId = data.id;
  }
  const { data: atuais } = await supabase.from("tarefa_responsaveis").select("membro_id").eq("tarefa_id", tarefaId!);
  const jaTem = new Set((atuais ?? []).map((r) => r.membro_id));
  const novos = responsaveis.filter((r) => !jaTem.has(r));
  const sair = [...jaTem].filter((r) => !responsaveis.includes(r));
  if (novos.length) {
    const { error } = await supabase.from("tarefa_responsaveis").insert(novos.map((membro_id) => ({ tarefa_id: tarefaId!, membro_id })));
    if (error) return { ok: false, erro: mensagemDeErro(error) };
  }
  if (sair.length) {
    const { error } = await supabase.from("tarefa_responsaveis").delete().eq("tarefa_id", tarefaId!).in("membro_id", sair);
    if (error) return { ok: false, erro: mensagemDeErro(error) };
  }
  revalidar();
  return { ok: true };
}

export async function mudarStatusTarefa(id: string, status: "pendente" | "em_andamento" | "concluida"): Promise<Resultado> {
  const supabase = await criarClienteServidor();
  const { data, error } = await supabase.from("tarefas").update({ status }).eq("id", id).select("id");
  if (error) return { ok: false, erro: mensagemDeErro(error) };
  if (!data?.length) return { ok: false, erro: "Você não é responsável por esta tarefa." };
  revalidar();
  return { ok: true };
}

export async function excluirTarefa(id: string): Promise<Resultado> {
  const supabase = await criarClienteServidor();
  const { data, error } = await supabase.from("tarefas").delete().eq("id", id).select("id");
  if (error) return { ok: false, erro: mensagemDeErro(error) };
  if (!data?.length) return { ok: false, erro: "Você só pode excluir as tarefas que criou para si." };
  revalidar();
  return { ok: true };
}
