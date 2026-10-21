"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { lerValor } from "@/lib/formatar";
import { criarClienteServidor } from "@/lib/supabase/server";
import type { Json } from "@/lib/supabase/database.types";
import { deHorarioLocal } from "@/lib/datas";
import { mensagemDeErro } from "@/lib/erros";

export type Resultado<T = undefined> = { ok: true; dados?: T } | { ok: false; erro: string };

const vazioParaNulo = (v: unknown) => (typeof v === "string" && v.trim() === "" ? null : v);
const textoOpcional = z.preprocess(vazioParaNulo, z.string().trim().nullable().optional());
const uuidOpcional = z.preprocess(vazioParaNulo, z.string().uuid().nullable().optional());
const dataOpcional = z.preprocess(vazioParaNulo, z.string().regex(/^\d{4}-\d{2}-\d{2}$/).nullable().optional());

function revalidarCrm(negocioId?: string) {
  revalidatePath("/funil");
  revalidatePath("/painel");
  revalidatePath("/comercial");
  revalidatePath("/empresas", "layout");
  if (negocioId) revalidatePath(`/negocios/${negocioId}`);
}

/** Move o negócio de fase. As regras (campos obrigatórios, motivo, trainee, rodízio, histórico) ficam no banco. */
export async function moverNegocio(entrada: {
  negocioId: string; faseId: string; motivoId?: string | null; motivoDetalhe?: string | null; retornoEm?: string | null; comentario?: string | null;
}): Promise<Resultado> {
  const supabase = await criarClienteServidor();
  const { error } = await supabase.rpc("mover_negocio", {
    _negocio: entrada.negocioId,
    _fase: entrada.faseId,
    _motivo: entrada.motivoId ?? undefined,
    _motivo_detalhe: entrada.motivoDetalhe ?? undefined,
    _retorno_em: entrada.retornoEm ?? undefined,
    _comentario: entrada.comentario ?? undefined,
  });
  if (error) return { ok: false, erro: mensagemDeErro(error) };
  revalidarCrm(entrada.negocioId);
  return { ok: true };
}

const esquemaNegocio = z.object({
  titulo: z.string().trim().min(2, "Informe o título."),
  valor: z.preprocess((v) => (v === "" || v == null ? null : lerValor(v) ?? Number.NaN),
    z.number({ message: "Valor inválido: use números, por exemplo 15.000,00." }).nonnegative("Valor inválido.").nullable()),
  responsavel_id: uuidOpcional,
  origem_id: uuidOpcional,
  origem_detalhe: textoOpcional,
  contato_id: uuidOpcional,
  data_coldcall_1: dataOpcional,
  data_coldcall_2: dataOpcional,
  dores_identificadas: textoOpcional,
});

export async function salvarNegocio(
  negocioId: string,
  dados: Record<string, unknown>,
  servicos: string[],
): Promise<Resultado> {
  const v = esquemaNegocio.safeParse(dados);
  if (!v.success) return { ok: false, erro: v.error.issues[0].message };
  const supabase = await criarClienteServidor();

  // Dores identificadas (serviços da Carta): só marca e desmarca
  const { data: atuaisServ } = await supabase.from("negocio_servicos").select("servico_id").eq("negocio_id", negocioId);
  const servAtuais = new Set((atuaisServ ?? []).map((s) => s.servico_id));
  const novosServ = servicos.filter((s) => !servAtuais.has(s));
  const remServ = [...servAtuais].filter((s) => !servicos.includes(s));
  const ops = [];
  if (novosServ.length) ops.push(supabase.from("negocio_servicos").insert(novosServ.map((servico_id) => ({ negocio_id: negocioId, servico_id }))));
  if (remServ.length) ops.push(supabase.from("negocio_servicos").delete().eq("negocio_id", negocioId).in("servico_id", remServ));
  for (const r of await Promise.all(ops)) if (r.error) return { ok: false, erro: mensagemDeErro(r.error) };

  const { data, error } = await supabase.from("negocios").update(v.data).eq("id", negocioId).select("id");
  if (error) return { ok: false, erro: mensagemDeErro(error) };
  if (!data?.length) return { ok: false, erro: "Você não tem permissão para editar este negócio." };

  revalidarCrm(negocioId);
  return { ok: true };
}

/** Salva os campos específicos das fases (JSON). Mescla com os valores existentes. */
export async function salvarCamposFase(negocioId: string, valores: Record<string, Json>): Promise<Resultado> {
  const supabase = await criarClienteServidor();
  const { data: atual, error: erroLeitura } = await supabase.from("negocios").select("campos").eq("id", negocioId).single();
  if (erroLeitura) return { ok: false, erro: mensagemDeErro(erroLeitura) };
  const campos = { ...((atual.campos as Record<string, Json>) ?? {}), ...valores };
  for (const [k, val] of Object.entries(campos)) if (val === "" || val === null) delete campos[k];

  const { data, error } = await supabase.from("negocios").update({ campos }).eq("id", negocioId).select("id");
  if (error) return { ok: false, erro: mensagemDeErro(error) };
  if (!data?.length) return { ok: false, erro: "Você não tem permissão para editar este negócio." };
  revalidarCrm(negocioId);
  return { ok: true };
}

export async function excluirNegocio(negocioId: string): Promise<Resultado> {
  const supabase = await criarClienteServidor();
  const { data, error } = await supabase.from("negocios").delete().eq("id", negocioId).select("id");
  if (error) return { ok: false, erro: mensagemDeErro(error) };
  if (!data?.length) return { ok: false, erro: "Só o diretor pode excluir negócios." };
  revalidarCrm();
  return { ok: true };
}

const esquemaNovoNegocio = z.object({
  empresa_id: z.string().uuid(),
  titulo: z.string().trim().min(2),
  fase_id: z.string().uuid(),
  origem_id: uuidOpcional,
  responsavel_id: uuidOpcional,
  contato_id: uuidOpcional,
});

export async function criarNegocio(dados: z.input<typeof esquemaNovoNegocio>): Promise<Resultado<{ id: string }>> {
  const v = esquemaNovoNegocio.safeParse(dados);
  if (!v.success) return { ok: false, erro: v.error.issues[0].message };
  const supabase = await criarClienteServidor();
  const { data: fase } = await supabase.from("fases").select("funil_id").eq("id", v.data.fase_id).single();
  if (!fase) return { ok: false, erro: "Fase inválida." };
  const { data, error } = await supabase.from("negocios").insert({ ...v.data, funil_id: fase.funil_id }).select("id").single();
  if (error) return { ok: false, erro: mensagemDeErro(error) };
  revalidarCrm(data.id);
  return { ok: true, dados: { id: data.id } };
}

const esquemaLigacao = z.object({
  negocio_id: z.string().uuid(),
  resultado_id: z.string().uuid("Escolha o resultado da ligação."),
  contato_id: uuidOpcional,
  duracao_min: z.preprocess((v) => (v === "" || v == null ? null : Number(String(v).replace(",", "."))),
    z.number().nonnegative("Duração inválida.").max(600).nullable()),
  retorno_em: dataOpcional,
  compromisso_em: z.preprocess(vazioParaNulo, z.string().min(16).nullable().optional()),
  decisor_nome: textoOpcional,
  decisor_melhor_horario: textoOpcional,
  proximo_passo: textoOpcional,
  comentario: textoOpcional,
});

/** Registra uma ligação. A ação do resultado (fase, retorno, tarefa, agenda) é aplicada pelo banco. */
export async function registrarLigacao(dados: Record<string, unknown>): Promise<Resultado> {
  const v = esquemaLigacao.safeParse(dados);
  if (!v.success) return { ok: false, erro: v.error.issues[0].message };
  const { duracao_min, compromisso_em, ...resto } = v.data;
  const supabase = await criarClienteServidor();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { ok: false, erro: "Sessão expirada. Entre de novo." };
  const { error } = await supabase.from("ligacoes").insert({
    ...resto,
    membro_id: user.id,
    duracao_seg: duracao_min == null ? null : Math.round(duracao_min * 60),
    compromisso_em: deHorarioLocal(compromisso_em ?? null),
  });
  if (error) return { ok: false, erro: mensagemDeErro(error) };
  revalidarCrm(v.data.negocio_id);
  revalidatePath("/tarefas");
  revalidatePath("/agenda");
  return { ok: true };
}

/** Coloca o negócio na fila do Enriquecedor (A1). O resultado chega pela Caixa de aprovação. */
export async function enriquecerNegocio(negocioId: string): Promise<Resultado> {
  const supabase = await criarClienteServidor();
  const { error } = await supabase.rpc("enriquecer_negocio", { _negocio: negocioId });
  if (error) return { ok: false, erro: mensagemDeErro(error) };
  revalidatePath(`/negocios/${negocioId}`);
  revalidatePath("/funil/configuracoes");
  return { ok: true };
}
