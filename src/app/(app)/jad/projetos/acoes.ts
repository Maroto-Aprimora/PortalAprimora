"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { criarClienteServidor } from "@/lib/supabase/server";
import { mensagemDeErro } from "@/lib/erros";

export type Resultado = { ok: true; id?: string } | { ok: false; erro: string };

const id = z.guid("Registro inválido.");
const nulo = (v: unknown) => (typeof v === "string" && v.trim() === "" ? null : v);
const data = z.preprocess(nulo, z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Data inválida.").nullable());
const STATUS = z.enum(["nao_iniciado", "em_planejamento", "em_andamento", "em_atencao", "concluido", "cancelado"]);
const SEM_PERMISSAO = "Só a VP, o responsável ou quem criou o projeto altera estes dados.";

function revalidar(projeto?: string) {
  revalidatePath("/jad", "layout");
  if (projeto) revalidatePath(`/jad/projetos/${projeto}`);
}
const falha = (e: { code?: string; message: string }): Resultado => ({ ok: false, erro: e.code === "42501" ? SEM_PERMISSAO : mensagemDeErro(e) });

const esquemaProjeto = z.object({
  nome: z.string().trim().min(2, "Dê um nome ao projeto.").max(200),
  descricao: z.preprocess(nulo, z.string().trim().max(4000).nullable()),
  objetivo: z.preprocess(nulo, z.string().trim().max(2000).nullable()),
  responsavel_id: z.preprocess(nulo, id.nullable()),
  diretoria: z.preprocess(nulo, z.string().nullable()),
  objetivo_anual_id: z.preprocess(nulo, id.nullable()),
  inicio: data,
  prazo: data,
  status: STATUS,
  resultados: z.preprocess(nulo, z.string().trim().max(4000).nullable()),
  licoes: z.preprocess(nulo, z.string().trim().max(4000).nullable()),
});

export async function salvarProjeto(projeto: string | null, dados: Record<string, unknown>): Promise<Resultado> {
  const v = esquemaProjeto.safeParse(dados);
  if (!v.success) return { ok: false, erro: v.error.issues[0].message };
  if (projeto && !id.safeParse(projeto).success) return { ok: false, erro: "Registro inválido." };
  const supabase = await criarClienteServidor();
  const { data: sessao } = await supabase.auth.getClaims();
  const { data: r, error } = projeto
    ? await supabase.from("projetos_internos").update(v.data).eq("id", projeto).select("id")
    : await supabase.from("projetos_internos").insert({ ...v.data, criado_por: sessao?.claims?.sub ?? null }).select("id");
  if (error) return falha(error);
  if (!r?.length) return { ok: false, erro: SEM_PERMISSAO };
  revalidar(r[0].id);
  return { ok: true, id: r[0].id };
}

export async function excluirProjeto(projeto: string): Promise<Resultado> {
  if (!id.safeParse(projeto).success) return { ok: false, erro: "Registro inválido." };
  const supabase = await criarClienteServidor();
  const { data: anexos } = await supabase.from("jad_anexos").select("caminho").eq("dono_tipo", "projeto").eq("dono_id", projeto);
  const { data: r, error } = await supabase.from("projetos_internos").delete().eq("id", projeto).select("id");
  if (error) return falha(error);
  if (!r?.length) return { ok: false, erro: "Só a VP ou quem criou exclui o projeto." };
  const caminhos = (anexos ?? []).map((a) => a.caminho).filter((c): c is string => !!c);
  if (caminhos.length) await supabase.storage.from("jad").remove(caminhos);
  revalidar();
  return { ok: true };
}

/** Substitui a lista de participantes (com papel). */
export async function salvarParticipantes(projeto: string, participantes: { membro_id: string; papel: string }[]): Promise<Resultado> {
  if (!id.safeParse(projeto).success) return { ok: false, erro: "Registro inválido." };
  const lista = participantes.filter((p) => id.safeParse(p.membro_id).success).map((p) => ({ projeto_id: projeto, membro_id: p.membro_id, papel: p.papel.trim().slice(0, 80) || null }));
  const supabase = await criarClienteServidor();
  const { data: atuais } = await supabase.from("projeto_participantes").select("membro_id").eq("projeto_id", projeto);
  const sair = (atuais ?? []).map((a) => a.membro_id).filter((m) => !lista.some((p) => p.membro_id === m));
  if (sair.length) {
    const { error } = await supabase.from("projeto_participantes").delete().eq("projeto_id", projeto).in("membro_id", sair);
    if (error) return falha(error);
  }
  if (lista.length) {
    const { error } = await supabase.from("projeto_participantes").upsert(lista, { onConflict: "projeto_id,membro_id" });
    if (error) return falha(error);
  }
  revalidar(projeto);
  return { ok: true };
}

const esquemaAtividade = z.object({
  etapa: z.preprocess(nulo, z.string().trim().max(120).nullable()),
  titulo: z.string().trim().min(2, "Descreva a atividade.").max(300),
  descricao: z.preprocess(nulo, z.string().trim().max(2000).nullable()),
  responsavel_id: z.preprocess(nulo, id.nullable()),
  prazo: data,
});

export async function salvarAtividade(projeto: string, atividade: string | null, dados: Record<string, unknown>, ordem: number): Promise<Resultado> {
  const v = esquemaAtividade.safeParse(dados);
  if (!v.success) return { ok: false, erro: v.error.issues[0].message };
  if (!id.safeParse(projeto).success || (atividade && !id.safeParse(atividade).success)) return { ok: false, erro: "Registro inválido." };
  const supabase = await criarClienteServidor();
  const { data: r, error } = atividade
    ? await supabase.from("projeto_atividades").update(v.data).eq("id", atividade).select("id")
    : await supabase.from("projeto_atividades").insert({ ...v.data, projeto_id: projeto, ordem }).select("id");
  if (error) return falha(error);
  if (!r?.length) return { ok: false, erro: SEM_PERMISSAO };
  revalidar(projeto);
  return { ok: true };
}

export async function mudarStatusAtividade(projeto: string, atividade: string, status: string): Promise<Resultado> {
  const s = z.enum(["pendente", "em_andamento", "concluida", "cancelada"]).safeParse(status);
  if (!s.success || !id.safeParse(atividade).success) return { ok: false, erro: "Registro inválido." };
  const supabase = await criarClienteServidor();
  const { data: r, error } = await supabase.from("projeto_atividades").update({ status: s.data }).eq("id", atividade).select("id");
  if (error) return { ok: false, erro: mensagemDeErro(error) };
  if (!r?.length) return { ok: false, erro: "Você não pode mudar esta atividade." };
  revalidar(projeto);
  return { ok: true };
}

export async function excluirAtividade(projeto: string, atividade: string): Promise<Resultado> {
  if (!id.safeParse(atividade).success) return { ok: false, erro: "Registro inválido." };
  const supabase = await criarClienteServidor();
  const { data: r, error } = await supabase.from("projeto_atividades").delete().eq("id", atividade).select("id");
  if (error) return falha(error);
  if (!r?.length) return { ok: false, erro: SEM_PERMISSAO };
  revalidar(projeto);
  return { ok: true };
}

/** Atualização (participantes e quem edita). Com status, o projeto muda de situação (se quem escreve puder editá-lo). */
export async function adicionarAtualizacao(projeto: string, texto: string, status: string): Promise<Resultado> {
  if (!id.safeParse(projeto).success) return { ok: false, erro: "Registro inválido." };
  const t = texto.trim();
  if (t.length < 2 || t.length > 4000) return { ok: false, erro: "Escreva a atualização (até 4000 caracteres)." };
  const s = status ? STATUS.safeParse(status) : null;
  if (s && !s.success) return { ok: false, erro: "Situação inválida." };
  const supabase = await criarClienteServidor();
  const { data: sessao } = await supabase.auth.getClaims();
  const { error } = await supabase.from("projeto_atualizacoes").insert({ projeto_id: projeto, texto: t, status: s?.data ?? null, autor_id: sessao?.claims?.sub ?? null });
  if (error) return falha(error);
  if (s?.data) await supabase.from("projetos_internos").update({ status: s.data }).eq("id", projeto);
  revalidar(projeto);
  return { ok: true };
}
