"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { criarClienteServidor } from "@/lib/supabase/server";
import { deHorarioLocal } from "@/lib/datas";
import { mensagemDeErro } from "@/lib/erros";
import { CAMPOS_PRIVADOS, CAMPOS_RESUMO } from "@/lib/vp";

export type Resultado = { ok: true; id?: string } | { ok: false; erro: string };

const id = z.guid("Registro inválido.");
const textoOpcional = (max: number) =>
  z.preprocess((v) => (typeof v === "string" && v.trim() === "" ? null : v), z.string().trim().max(max, `Máximo de ${max} caracteres.`).nullable());
const SEM_PERMISSAO = "Só a equipe da Vice-Presidência agenda e altera 1:1 (e ninguém altera a própria).";
const SO_QUEM_CONDUZ = "Só quem conduziu a 1:1 (ou o diretor da VP) registra esta reunião.";

function revalidar(reuniao?: string) {
  revalidatePath("/vice-presidencia/1on1");
  if (reuniao) revalidatePath(`/vice-presidencia/1on1/${reuniao}`);
  revalidatePath("/vice-presidencia/resumo", "layout");
}

const falha = (e: { code?: string; message: string }, padrao: string): Resultado =>
  ({ ok: false, erro: e.code === "42501" ? padrao : mensagemDeErro(e) });

// ---------- Agendamento ----------

const esquemaAgendamento = z.object({
  membro_id: id,
  conduzida_por: id,
  agendada_para: z.string().regex(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/, "Informe data e hora."),
  duracao_min: z.preprocess((v) => Number(v || 30), z.number().int().min(5, "Mínimo de 5 minutos.").max(480, "Máximo de 8 horas.")),
  modalidade: z.enum(["presencial", "online"]),
  local: textoOpcional(500),
  pauta: textoOpcional(4000),
});

export async function agendarReuniao(dados: Record<string, unknown>): Promise<Resultado> {
  const v = esquemaAgendamento.safeParse(dados);
  if (!v.success) return { ok: false, erro: v.error.issues[0].message };
  if (v.data.membro_id === v.data.conduzida_por) return { ok: false, erro: "Quem conduz não pode ser o próprio membro." };
  const supabase = await criarClienteServidor();
  const { data, error } = await supabase.from("reunioes_1on1")
    .insert({ ...v.data, agendada_para: deHorarioLocal(v.data.agendada_para)! }).select("id").single();
  if (error) return falha(error, SEM_PERMISSAO);
  revalidar();
  return { ok: true, id: data.id };
}

export async function editarAgendamento(reuniao: string, dados: Record<string, unknown>): Promise<Resultado> {
  const v = esquemaAgendamento.omit({ membro_id: true }).safeParse(dados);
  if (!v.success || !id.safeParse(reuniao).success) return { ok: false, erro: v.error?.issues[0].message ?? "Registro inválido." };
  const supabase = await criarClienteServidor();
  const { data, error } = await supabase.from("reunioes_1on1")
    .update({ ...v.data, agendada_para: deHorarioLocal(v.data.agendada_para)! }).eq("id", reuniao).select("id");
  if (error) return falha(error, SEM_PERMISSAO);
  if (!data?.length) return { ok: false, erro: SEM_PERMISSAO };
  revalidar(reuniao);
  return { ok: true };
}

export async function cancelarReuniao(reuniao: string, motivo: string): Promise<Resultado> {
  if (!id.safeParse(reuniao).success) return { ok: false, erro: "Registro inválido." };
  const supabase = await criarClienteServidor();
  const { data, error } = await supabase.from("reunioes_1on1")
    .update({ status: "cancelada", motivo_cancelamento: motivo.trim().slice(0, 1000) || null }).eq("id", reuniao).select("id");
  if (error) return falha(error, SEM_PERMISSAO);
  if (!data?.length) return { ok: false, erro: SEM_PERMISSAO };
  revalidar(reuniao);
  return { ok: true };
}

/** Volta para "agendada" (desfaz cancelamento ou conclusão). */
export async function reabrirReuniao(reuniao: string): Promise<Resultado> {
  if (!id.safeParse(reuniao).success) return { ok: false, erro: "Registro inválido." };
  const supabase = await criarClienteServidor();
  const { data, error } = await supabase.from("reunioes_1on1").update({ status: "agendada" }).eq("id", reuniao).select("id");
  if (error) return falha(error, SEM_PERMISSAO);
  if (!data?.length) return { ok: false, erro: SEM_PERMISSAO };
  revalidar(reuniao);
  return { ok: true };
}

export async function excluirReuniao(reuniao: string): Promise<Resultado> {
  if (!id.safeParse(reuniao).success) return { ok: false, erro: "Registro inválido." };
  const supabase = await criarClienteServidor();
  const { data, error } = await supabase.from("reunioes_1on1").delete().eq("id", reuniao).select("id");
  if (error) return falha(error, "Só o diretor da VP exclui 1:1.");
  if (!data?.length) return { ok: false, erro: "Só o diretor da VP exclui 1:1." };
  revalidar();
  return { ok: true };
}

// ---------- Registro (resumo + conteúdo privado) ----------

export async function salvarRegistro(reuniao: string, dados: Record<string, string>, opcoes: {
  compartilhado: boolean; geradoPorIa: boolean; concluir: boolean;
}): Promise<Resultado> {
  if (!id.safeParse(reuniao).success) return { ok: false, erro: "Registro inválido." };
  const texto = (k: string, max = 8000) => (dados[k] ?? "").trim().slice(0, max) || null;
  const conteudo = Object.fromEntries(CAMPOS_RESUMO.map((c) => [c.chave, texto(c.chave)]).filter(([, v]) => v));
  const supabase = await criarClienteServidor();

  const [r, p] = await Promise.all([
    supabase.from("reuniao_1on1_resumos").upsert({
      reuniao_id: reuniao, conteudo, compartilhado: opcoes.compartilhado, gerado_por_ia: opcoes.geradoPorIa,
    }).select("reuniao_id"),
    supabase.from("reuniao_1on1_privados").upsert({
      reuniao_id: reuniao, anotacoes: texto("anotacoes", 20000),
      ...Object.fromEntries(CAMPOS_PRIVADOS.map((c) => [c.chave, texto(c.chave)])),
    }).select("reuniao_id"),
  ]);
  const erro = r.error ?? p.error;
  if (erro) return falha(erro, SO_QUEM_CONDUZ);
  if (!r.data?.length || !p.data?.length) return { ok: false, erro: SO_QUEM_CONDUZ };

  const pauta = texto("pauta", 4000);
  const { error } = await supabase.from("reunioes_1on1")
    .update({ pauta, ...(opcoes.concluir ? { status: "realizada" } : {}) }).eq("id", reuniao);
  if (error) return falha(error, SEM_PERMISSAO);
  revalidar(reuniao);
  return { ok: true };
}

// ---------- Transcrição e A13 ----------

export async function salvarTranscricao(reuniao: string, texto: string, consentimento: boolean): Promise<Resultado> {
  if (!id.safeParse(reuniao).success) return { ok: false, erro: "Registro inválido." };
  const limpo = texto.replace(/\r\n/g, "\n").trim();
  if (limpo.length < 50) return { ok: false, erro: "A transcrição parece vazia (mínimo de 50 caracteres)." };
  if (limpo.length > 200_000) return { ok: false, erro: "Transcrição muito longa (máximo de 200 mil caracteres)." };
  if (!consentimento) return { ok: false, erro: "Confirme que o membro autorizou a gravação/transcrição." };
  const supabase = await criarClienteServidor();
  const { data: sessao } = await supabase.auth.getClaims();
  const { data, error } = await supabase.from("reuniao_1on1_privados").upsert({
    reuniao_id: reuniao, transcricao: limpo, transcricao_consentimento_em: new Date().toISOString(),
    transcricao_consentimento_por: sessao?.claims?.sub ?? null,
  }).select("reuniao_id");
  if (error) return falha(error, SO_QUEM_CONDUZ);
  if (!data?.length) return { ok: false, erro: SO_QUEM_CONDUZ };
  revalidar(reuniao);
  return { ok: true };
}

export async function removerTranscricao(reuniao: string): Promise<Resultado> {
  if (!id.safeParse(reuniao).success) return { ok: false, erro: "Registro inválido." };
  const supabase = await criarClienteServidor();
  const { data, error } = await supabase.from("reuniao_1on1_privados").update({
    transcricao: null, transcricao_consentimento_em: null, transcricao_consentimento_por: null,
    analise: null, analise_status: null, analise_erro: null,
  }).eq("reuniao_id", reuniao).select("reuniao_id");
  if (error) return falha(error, SO_QUEM_CONDUZ);
  if (!data?.length) return { ok: false, erro: SO_QUEM_CONDUZ };
  revalidar(reuniao);
  return { ok: true };
}

export async function pedirAnalise(reuniao: string): Promise<Resultado> {
  if (!id.safeParse(reuniao).success) return { ok: false, erro: "Registro inválido." };
  const supabase = await criarClienteServidor();
  const { error } = await supabase.rpc("pedir_analise_1on1", { _reuniao: reuniao });
  if (error) return { ok: false, erro: mensagemDeErro(error) };
  revalidar(reuniao);
  return { ok: true };
}

export async function descartarAnalise(reuniao: string): Promise<Resultado> {
  if (!id.safeParse(reuniao).success) return { ok: false, erro: "Registro inválido." };
  const supabase = await criarClienteServidor();
  const { error } = await supabase.from("reuniao_1on1_privados")
    .update({ analise: null, analise_status: null, analise_erro: null }).eq("reuniao_id", reuniao);
  if (error) return falha(error, SO_QUEM_CONDUZ);
  revalidar(reuniao);
  return { ok: true };
}

// ---------- Compromissos ----------

const esquemaCompromisso = z.object({
  descricao: z.string().trim().min(2, "Descreva o compromisso.").max(500, "Máximo de 500 caracteres."),
  responsavel_id: z.preprocess((v) => (v === "" ? null : v), id.nullable()),
  prazo: z.preprocess((v) => (v === "" ? null : v), z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Data inválida.").nullable()),
  compartilhado: z.boolean(),
});

export async function adicionarCompromisso(reuniao: string, dados: Record<string, unknown>): Promise<Resultado> {
  const v = esquemaCompromisso.safeParse(dados);
  if (!v.success) return { ok: false, erro: v.error.issues[0].message };
  if (!id.safeParse(reuniao).success) return { ok: false, erro: "Registro inválido." };
  const supabase = await criarClienteServidor();
  // membro_id é preenchido pelo banco a partir da reunião
  const { error } = await supabase.from("compromissos_1on1").insert({ ...v.data, reuniao_id: reuniao, membro_id: reuniao });
  if (error) return falha(error, SO_QUEM_CONDUZ);
  revalidar(reuniao);
  return { ok: true };
}

export async function mudarStatusCompromisso(compromisso: string, status: string, reuniao: string): Promise<Resultado> {
  const s = z.enum(["pendente", "em_andamento", "concluido", "cancelado"]).safeParse(status);
  if (!s.success || !id.safeParse(compromisso).success) return { ok: false, erro: "Registro inválido." };
  const supabase = await criarClienteServidor();
  const { data, error } = await supabase.from("compromissos_1on1").update({ status: s.data }).eq("id", compromisso).select("id");
  if (error) return { ok: false, erro: mensagemDeErro(error) };
  if (!data?.length) return { ok: false, erro: "Você não pode alterar este compromisso." };
  revalidar(reuniao);
  return { ok: true };
}

export async function excluirCompromisso(compromisso: string, reuniao: string): Promise<Resultado> {
  if (!id.safeParse(compromisso).success) return { ok: false, erro: "Registro inválido." };
  const supabase = await criarClienteServidor();
  const { data, error } = await supabase.from("compromissos_1on1").delete().eq("id", compromisso).select("id");
  if (error) return falha(error, SO_QUEM_CONDUZ);
  if (!data?.length) return { ok: false, erro: SO_QUEM_CONDUZ };
  revalidar(reuniao);
  return { ok: true };
}

// ---------- Configurações (diretor da VP) ----------

export async function salvarConfiguracoes(frequencia: number, a13Ativo: boolean): Promise<Resultado> {
  const f = z.number().int().min(7, "Mínimo de 7 dias.").max(180, "Máximo de 180 dias.").safeParse(frequencia);
  if (!f.success) return { ok: false, erro: f.error.issues[0].message };
  const supabase = await criarClienteServidor();
  const { data: sessao } = await supabase.auth.getClaims();
  const { data, error } = await supabase.from("parametros_vp")
    .update({ frequencia_1on1_dias: f.data, atualizado_por: sessao?.claims?.sub ?? null }).eq("id", 1).select("id");
  if (error) return { ok: false, erro: mensagemDeErro(error) };
  if (!data?.length) return { ok: false, erro: "Só o diretor da VP altera as configurações." };
  const { error: e2 } = await supabase.rpc("alternar_agente_1on1", { _ativo: a13Ativo });
  if (e2) return { ok: false, erro: mensagemDeErro(e2) };
  revalidar();
  revalidatePath("/vice-presidencia/relatorios");
  return { ok: true };
}
