"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { criarClienteServidor } from "@/lib/supabase/server";
import { mensagemDeErro } from "@/lib/erros";
import type { Json } from "@/lib/supabase/database.types";

export type Resultado = { ok: true; id?: string; assistente?: boolean } | { ok: false; erro: string };

function revalidar(negocioId: string) {
  for (const p of ["", "/diagnostico", "/precificacao", "/proposta", "/dossie"]) revalidatePath(`/negocios/${negocioId}${p}`);
  revalidatePath("/funil");
}

// ---------------------------------------------------------------------
// Diagnóstico
// ---------------------------------------------------------------------
const esquemaRespostas = z.record(z.string().uuid(), z.object({
  nota: z.number().int().min(1).max(4).nullable(),
  comentario: z.string().max(2000).optional(),
}));

/** Cria o diagnóstico do negócio (rascunho) e devolve o id. */
export async function iniciarDiagnostico(negocioId: string): Promise<Resultado> {
  const supabase = await criarClienteServidor();
  const { data, error } = await supabase.from("diagnosticos").insert({ negocio_id: negocioId }).select("id").single();
  if (error) return { ok: false, erro: mensagemDeErro(error) };
  revalidar(negocioId);
  return { ok: true, id: data.id };
}

/** Salva as respostas (chamado a cada mudança, com espera curta). */
export async function salvarDiagnostico(id: string, negocioId: string, dados: {
  respostas: z.input<typeof esquemaRespostas>; observacoes: string; realizado_em: string;
}): Promise<Resultado> {
  const v = esquemaRespostas.safeParse(dados.respostas);
  if (!v.success) return { ok: false, erro: "Respostas inválidas." };
  const limpas = Object.fromEntries(Object.entries(v.data).filter(([, r]) => r.nota != null || (r.comentario ?? "").trim()));
  const supabase = await criarClienteServidor();
  const { data, error } = await supabase.from("diagnosticos")
    .update({ respostas: limpas as Json, observacoes: dados.observacoes.trim() || null, realizado_em: dados.realizado_em })
    .eq("id", id).select("id");
  if (error) return { ok: false, erro: mensagemDeErro(error) };
  if (!data?.length) return { ok: false, erro: "Sem permissão para editar este diagnóstico." };
  revalidatePath(`/negocios/${negocioId}`);
  return { ok: true };
}

export async function concluirDiagnostico(id: string, negocioId: string): Promise<Resultado> {
  const supabase = await criarClienteServidor();
  const { data, error } = await supabase.rpc("concluir_diagnostico", { _diagnostico: id });
  if (error) return { ok: false, erro: mensagemDeErro(error) };
  revalidar(negocioId);
  return { ok: true, assistente: !!(data as { assistente?: boolean } | null)?.assistente };
}

export async function reabrirDiagnostico(id: string, negocioId: string): Promise<Resultado> {
  const supabase = await criarClienteServidor();
  const { error } = await supabase.rpc("reabrir_diagnostico", { _diagnostico: id });
  if (error) return { ok: false, erro: mensagemDeErro(error) };
  revalidar(negocioId);
  return { ok: true };
}

// ---------------------------------------------------------------------
// Precificação
// ---------------------------------------------------------------------
const esquemaPreco = z.object({
  fatores: z.record(z.string(), z.string()),
  horas_consultor: z.number().min(0, "Horas não podem ser negativas.").max(100000),
  horas_gerente: z.number().min(0, "Horas não podem ser negativas.").max(100000),
  custos: z.array(z.object({ descricao: z.string().trim(), valor: z.number().min(0) })).max(50),
  observacoes: z.string().max(4000).nullable(),
});

export async function salvarPrecificacao(negocioId: string, dados: z.input<typeof esquemaPreco>): Promise<Resultado> {
  const v = esquemaPreco.safeParse(dados);
  if (!v.success) return { ok: false, erro: v.error.issues[0].message };
  const supabase = await criarClienteServidor();
  const linha = { ...v.data, custos: v.data.custos.filter((c) => c.descricao || c.valor) as Json, fatores: v.data.fatores as Json };
  const { data: atual } = await supabase.from("precificacoes").select("id").eq("negocio_id", negocioId).maybeSingle();
  const { error } = atual
    ? await supabase.from("precificacoes").update(linha).eq("id", atual.id)
    : await supabase.from("precificacoes").insert({ ...linha, negocio_id: negocioId });
  if (error) return { ok: false, erro: mensagemDeErro(error) };
  revalidar(negocioId);
  return { ok: true };
}

/** Só o Diretor Comercial (regra no banco). Vira o valor do negócio. Não exige diagnóstico, escopo nem a calculadora. */
export async function definirPrecoFinal(negocioId: string, preco: number | null): Promise<Resultado> {
  if (preco != null && (Number.isNaN(preco) || preco < 0)) return { ok: false, erro: "Informe um preço válido." };
  const supabase = await criarClienteServidor();
  const { data, error } = await supabase.from("precificacoes").update({ preco_final: preco }).eq("negocio_id", negocioId).select("id");
  if (error) return { ok: false, erro: mensagemDeErro(error) };
  // Sem precificação salva: o preço final pode ser registrado direto (a calculadora é opcional por enquanto)
  if (!data?.length) {
    const { error: e2 } = await supabase.from("precificacoes").insert({ negocio_id: negocioId, preco_final: preco });
    if (e2) return { ok: false, erro: mensagemDeErro(e2) };
  }
  revalidar(negocioId);
  return { ok: true };
}

// ---------------------------------------------------------------------
// Proposta
// ---------------------------------------------------------------------
export async function salvarProposta(negocioId: string, dados: {
  resumo_diagnostico: string; escopo: string; texto: string; revisada: boolean;
}): Promise<Resultado> {
  const supabase = await criarClienteServidor();
  const { data: { user } } = await supabase.auth.getUser();
  const campos = {
    resumo_diagnostico: dados.resumo_diagnostico.trim() || null, escopo: dados.escopo.trim() || null, texto: dados.texto.trim() || null,
    status: dados.revisada ? "revisada" : "rascunho",
    revisado_por: dados.revisada ? user?.id ?? null : null, revisado_em: dados.revisada ? new Date().toISOString() : null,
  };
  const { data: atual } = await supabase.from("propostas").select("id").eq("negocio_id", negocioId).maybeSingle();
  const { error } = atual
    ? await supabase.from("propostas").update(campos).eq("id", atual.id)
    : await supabase.from("propostas").insert({ ...campos, negocio_id: negocioId });
  if (error) return { ok: false, erro: mensagemDeErro(error) };
  revalidar(negocioId);
  return { ok: true };
}

/** Marca os serviços sugeridos pelo Assistente nas dores identificadas do negócio. */
export async function aplicarServicosSugeridos(negocioId: string, servicos: string[]): Promise<Resultado> {
  if (!servicos.length) return { ok: true };
  const supabase = await criarClienteServidor();
  const { data: atuais } = await supabase.from("negocio_servicos").select("servico_id").eq("negocio_id", negocioId);
  const ja = new Set((atuais ?? []).map((s) => s.servico_id));
  const novos = servicos.filter((s) => !ja.has(s));
  if (novos.length) {
    const { error } = await supabase.from("negocio_servicos").insert(novos.map((servico_id) => ({ negocio_id: negocioId, servico_id })));
    if (error) return { ok: false, erro: mensagemDeErro(error) };
  }
  revalidar(negocioId);
  return { ok: true };
}
