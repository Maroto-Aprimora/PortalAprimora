"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { criarClienteServidor } from "@/lib/supabase/server";
import { deHorarioLocal } from "@/lib/datas";
import { mensagemDeErro } from "@/lib/erros";

export type Resultado = { ok: true } | { ok: false; erro: string };

const nulo = (v: unknown) => (typeof v === "string" && v.trim() === "" ? null : typeof v === "string" ? v.trim() : v);

const esquema = z.object({
  tipo_id: z.string().uuid("Escolha o tipo."),
  titulo: z.string().trim().min(2, "Informe o título."),
  inicio: z.string().min(16, "Informe a data e a hora de início."),
  fim: z.preprocess(nulo, z.string().nullable().optional()),
  local: z.preprocess(nulo, z.string().nullable().optional()),
  link_reuniao: z.preprocess(nulo, z.string().url("Link inválido.").nullable().optional()),
  negocio_id: z.preprocess(nulo, z.string().uuid().nullable().optional()),
  responsavel_id: z.preprocess(nulo, z.string().uuid().nullable().optional()),
  stakeholder: z.preprocess(nulo, z.string().nullable().optional()),
  resumo: z.preprocess(nulo, z.string().nullable().optional()),
  proximos_passos: z.preprocess(nulo, z.string().nullable().optional()),
});

function revalidar(negocioId?: string | null) {
  revalidatePath("/agenda");
  revalidatePath("/painel");
  if (negocioId) revalidatePath(`/negocios/${negocioId}`);
  revalidatePath("/empresas", "layout");
}

export async function salvarAtividade(id: string | null, dados: Record<string, unknown>, participantes: string[]): Promise<Resultado> {
  const v = esquema.safeParse(dados);
  if (!v.success) return { ok: false, erro: v.error.issues[0].message };
  const inicio = deHorarioLocal(v.data.inicio)!;
  const fim = deHorarioLocal(v.data.fim ?? null);
  if (fim && fim < inicio) return { ok: false, erro: "O fim precisa ser depois do início." };
  const registro = { ...v.data, inicio, fim };

  const supabase = await criarClienteServidor();
  let atividadeId = id;
  if (id) {
    const { data, error } = await supabase.from("atividades").update(registro).eq("id", id).select("id");
    if (error) return { ok: false, erro: mensagemDeErro(error) };
    if (!data?.length) return { ok: false, erro: "Você não tem permissão para editar esta atividade." };
  } else {
    const { data, error } = await supabase.from("atividades").insert(registro).select("id").single();
    if (error) return { ok: false, erro: mensagemDeErro(error) };
    atividadeId = data.id;
  }

  // Participantes: substitui pelo que veio do formulário
  const { data: atuais } = await supabase.from("atividade_participantes").select("membro_id").eq("atividade_id", atividadeId!);
  const jaTem = new Set((atuais ?? []).map((p) => p.membro_id));
  const novos = participantes.filter((p) => !jaTem.has(p));
  const sair = [...jaTem].filter((p) => !participantes.includes(p));
  if (novos.length) {
    const { error } = await supabase.from("atividade_participantes").insert(novos.map((membro_id) => ({ atividade_id: atividadeId!, membro_id })));
    if (error) return { ok: false, erro: mensagemDeErro(error) };
  }
  if (sair.length) {
    const { error } = await supabase.from("atividade_participantes").delete().eq("atividade_id", atividadeId!).in("membro_id", sair);
    if (error) return { ok: false, erro: mensagemDeErro(error) };
  }
  revalidar(v.data.negocio_id);
  return { ok: true };
}

export async function mudarStatusAtividade(id: string, status: "pendente" | "confirmada" | "realizada" | "cancelada"): Promise<Resultado> {
  const supabase = await criarClienteServidor();
  const { data, error } = await supabase.from("atividades").update({ status }).eq("id", id).select("negocio_id");
  if (error) return { ok: false, erro: mensagemDeErro(error) };
  if (!data?.length) return { ok: false, erro: "Você não tem permissão para alterar esta atividade." };
  revalidar(data[0].negocio_id);
  return { ok: true };
}

export async function excluirAtividade(id: string): Promise<Resultado> {
  const supabase = await criarClienteServidor();
  const { data, error } = await supabase.from("atividades").delete().eq("id", id).select("negocio_id");
  if (error) return { ok: false, erro: mensagemDeErro(error) };
  if (!data?.length) return { ok: false, erro: "Você não tem permissão para excluir esta atividade." };
  revalidar(data[0].negocio_id);
  return { ok: true };
}

/** Remarca: a atividade atual fica "remarcada" (com a data original) e uma nova é criada na data nova. */
export async function remarcarAtividade(id: string, novoInicio: string, motivo: string | null): Promise<Resultado> {
  if (!novoInicio || novoInicio.length < 16) return { ok: false, erro: "Informe a nova data e hora." };
  const supabase = await criarClienteServidor();
  const { error } = await supabase.rpc("remarcar_atividade", {
    _atividade: id, _novo_inicio: deHorarioLocal(novoInicio)!, ...(motivo?.trim() ? { _motivo: motivo.trim() } : {}),
  });
  if (error) return { ok: false, erro: mensagemDeErro(error) };
  const { data } = await supabase.from("atividades").select("negocio_id").eq("id", id).maybeSingle();
  revalidar(data?.negocio_id);
  return { ok: true };
}

/** Cria (ou troca) o link pessoal da agenda para assinar no Google Agenda. O link antigo deixa de funcionar. */
export async function gerarLinkAgenda(): Promise<{ ok: true; token: string } | { ok: false; erro: string }> {
  const supabase = await criarClienteServidor();
  const { data, error } = await supabase.rpc("gerar_link_agenda");
  if (error || !data) return { ok: false, erro: mensagemDeErro(error) };
  return { ok: true, token: data };
}
