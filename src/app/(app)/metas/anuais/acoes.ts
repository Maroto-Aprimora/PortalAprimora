"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { criarClienteServidor } from "@/lib/supabase/server";
import { mensagemDeErro } from "@/lib/erros";

export type Resultado = { ok: true } | { ok: false; erro: string };

const id = z.guid("Registro inválido.");
const nulo = (v: unknown) => (typeof v === "string" && v.trim() === "" ? null : v);
const SEM_PERMISSAO = "Os objetivos da Aprimora são do diretor da VP e da Presidência; os de uma diretoria, do diretor dela.";
const revalidar = () => { revalidatePath("/metas", "layout"); revalidatePath("/jad", "layout"); };

const esquemaObjetivo = z.object({
  ano: z.preprocess((v) => Number(v), z.number().int().min(2020).max(2100)),
  diretoria: z.preprocess(nulo, z.string().nullable()),
  titulo: z.string().trim().min(2, "Dê um título ao objetivo.").max(200),
  descricao: z.preprocess(nulo, z.string().trim().max(4000).nullable()),
  resultado_esperado: z.preprocess(nulo, z.string().trim().max(2000).nullable()),
  responsavel_id: z.preprocess(nulo, id.nullable()),
  prazo: z.preprocess(nulo, z.string().regex(/^\d{4}-\d{2}-\d{2}$/).nullable()),
});

export async function salvarObjetivoAnual(objetivo: string | null, dados: Record<string, unknown>): Promise<Resultado> {
  const v = esquemaObjetivo.safeParse(dados);
  if (!v.success) return { ok: false, erro: v.error.issues[0].message };
  if (objetivo && !id.safeParse(objetivo).success) return { ok: false, erro: "Registro inválido." };
  const supabase = await criarClienteServidor();
  const { data, error } = objetivo
    ? await supabase.from("objetivos_anuais").update(v.data).eq("id", objetivo).select("id")
    : await supabase.from("objetivos_anuais").insert(v.data).select("id");
  if (error) return { ok: false, erro: error.code === "42501" ? SEM_PERMISSAO : mensagemDeErro(error) };
  if (!data?.length) return { ok: false, erro: SEM_PERMISSAO };
  revalidar();
  return { ok: true };
}

export async function excluirObjetivoAnual(objetivo: string): Promise<Resultado> {
  if (!id.safeParse(objetivo).success) return { ok: false, erro: "Registro inválido." };
  const supabase = await criarClienteServidor();
  const { data, error } = await supabase.from("objetivos_anuais").delete().eq("id", objetivo).select("id");
  if (error) return { ok: false, erro: mensagemDeErro(error) };
  if (!data?.length) return { ok: false, erro: SEM_PERMISSAO };
  revalidar();
  return { ok: true };
}

const esquemaIndicador = z.object({
  nome: z.string().trim().min(2, "Dê um nome ao indicador.").max(200),
  unidade: z.preprocess(nulo, z.string().trim().max(20).nullable()),
  valor_inicial: z.preprocess((v) => Number(v || 0), z.number().finite()),
  alvo: z.preprocess((v) => Number(v), z.number().finite("Informe o alvo.")),
  responsavel_id: z.preprocess(nulo, id.nullable()),
  prazo: z.preprocess(nulo, z.string().regex(/^\d{4}-\d{2}-\d{2}$/).nullable()),
});

export async function salvarIndicador(objetivo: string, indicador: string | null, dados: Record<string, unknown>): Promise<Resultado> {
  const v = esquemaIndicador.safeParse(dados);
  if (!v.success) return { ok: false, erro: v.error.issues[0].message };
  if (!id.safeParse(objetivo).success || (indicador && !id.safeParse(indicador).success)) return { ok: false, erro: "Registro inválido." };
  if (v.data.alvo === v.data.valor_inicial) return { ok: false, erro: "O alvo precisa ser diferente do valor inicial." };
  const supabase = await criarClienteServidor();
  const { data, error } = indicador
    ? await supabase.from("objetivo_anual_indicadores").update(v.data).eq("id", indicador).select("id")
    : await supabase.from("objetivo_anual_indicadores").insert({ ...v.data, objetivo_id: objetivo, valor_atual: v.data.valor_inicial }).select("id");
  if (error) return { ok: false, erro: error.code === "42501" ? SEM_PERMISSAO : mensagemDeErro(error) };
  if (!data?.length) return { ok: false, erro: SEM_PERMISSAO };
  revalidar();
  return { ok: true };
}

export async function excluirIndicador(indicador: string): Promise<Resultado> {
  if (!id.safeParse(indicador).success) return { ok: false, erro: "Registro inválido." };
  const supabase = await criarClienteServidor();
  const { data, error } = await supabase.from("objetivo_anual_indicadores").delete().eq("id", indicador).select("id");
  if (error) return { ok: false, erro: mensagemDeErro(error) };
  if (!data?.length) return { ok: false, erro: SEM_PERMISSAO };
  revalidar();
  return { ok: true };
}

/** Registra o valor atual (quem gere ou o responsável), guardando o histórico com nota e link de evidência. */
export async function registrarValor(indicador: string, valor: number, nota: string, evidencia: string): Promise<Resultado> {
  if (!id.safeParse(indicador).success) return { ok: false, erro: "Registro inválido." };
  if (!Number.isFinite(valor)) return { ok: false, erro: "Informe o valor." };
  const supabase = await criarClienteServidor();
  const { error } = await supabase.rpc("registrar_valor_indicador", {
    _indicador: indicador, _valor: valor, _nota: nota.trim().slice(0, 2000), ...(evidencia.trim() ? { _evidencia: evidencia.trim() } : {}),
  });
  if (error) return { ok: false, erro: mensagemDeErro(error) };
  revalidar();
  return { ok: true };
}
