"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { criarClienteServidor } from "@/lib/supabase/server";
import { mensagemDeErro } from "@/lib/erros";
import { CHAVES_INDICADOR, type ChaveIndicador } from "@/lib/indicadores-catalogo";

export type Resultado = { ok: true } | { ok: false; erro: string };

const DIRETORIA = "comercial";
const trimestre = z.string().regex(/^[1-4]T\d{4}$/, "Trimestre inválido (use 1T2027, 2T2027…).");
const numero = z.preprocess((v) => (v === "" || v == null ? null : Number(v)), z.number().finite().nullable());

const esquemaMeta = z.object({
  trimestre,
  objetivo: z.string().trim().min(2, "Informe o objetivo."),
  codigo: z.preprocess((v) => (typeof v === "string" && v.trim() === "" ? null : v), z.string().trim().nullable()),
  titulo: z.string().trim().min(2, "Informe o resultado-chave."),
  alvo: z.preprocess((v) => Number(v), z.number().finite().min(0, "O alvo não pode ser negativo.")),
  unidade: z.string().trim().min(1),
  realizado_manual: numero,
  peso: z.preprocess((v) => Number(v), z.number().positive("O peso precisa ser maior que zero.").max(999)),
  ordem: z.preprocess((v) => Number(v ?? 0), z.number().int().min(0).max(32000)),
  indicador: z.preprocess((v) => (v === "" || v == null ? null : v), z.enum(CHAVES_INDICADOR as [ChaveIndicador, ...ChaveIndicador[]]).nullable()),
  objetivo_anual_id: z.preprocess((v) => (v === "" || v == null ? null : v), z.guid().nullable()).optional(),
});

function revalidar() {
  revalidatePath("/metas");
  revalidatePath("/metas/configuracoes");
  revalidatePath("/metas/anuais");
}

/** Cria ou altera uma meta (resultado-chave) do Comercial. O banco só deixa o diretor da diretoria. */
export async function salvarMeta(id: string | null, dados: Record<string, unknown>): Promise<Resultado> {
  const v = esquemaMeta.safeParse(dados);
  if (!v.success) return { ok: false, erro: v.error.issues[0].message };
  const supabase = await criarClienteServidor();
  const { data, error } = id
    ? await supabase.from("metas").update(v.data).eq("id", id).select("id")
    : await supabase.from("metas").insert({ ...v.data, diretoria: DIRETORIA }).select("id");
  if (error) return { ok: false, erro: mensagemDeErro(error) };
  if (!data?.length) return { ok: false, erro: "Só o diretor altera as metas." };
  revalidar();
  return { ok: true };
}

export async function excluirMeta(id: string): Promise<Resultado> {
  const supabase = await criarClienteServidor();
  const { data, error } = await supabase.from("metas").delete().eq("id", id).select("id");
  if (error) return { ok: false, erro: mensagemDeErro(error) };
  if (!data?.length) return { ok: false, erro: "Só o diretor altera as metas." };
  revalidar();
  return { ok: true };
}

/** Novo trimestre: copia objetivos e resultados-chave de um trimestre existente (sem o realizado) ou começa vazio. */
export async function criarTrimestre(novo: string, copiarDe: string | null): Promise<Resultado> {
  const t = trimestre.safeParse(novo);
  if (!t.success) return { ok: false, erro: t.error.issues[0].message };
  const supabase = await criarClienteServidor();
  const { count } = await supabase.from("metas").select("id", { count: "exact", head: true }).eq("diretoria", DIRETORIA).eq("trimestre", t.data);
  if (count) return { ok: false, erro: "Esse trimestre já tem metas. Edite-as na lista." };
  if (!copiarDe) return { ok: true };
  const { data: base } = await supabase.from("metas").select("objetivo, codigo, titulo, alvo, unidade, indicador, peso, ordem")
    .eq("diretoria", DIRETORIA).eq("trimestre", copiarDe);
  if (!base?.length) return { ok: false, erro: "O trimestre de origem não tem metas." };
  const { error } = await supabase.from("metas").insert(base.map((m) => ({ ...m, diretoria: DIRETORIA, trimestre: t.data })));
  if (error) return { ok: false, erro: mensagemDeErro(error) };
  revalidar();
  return { ok: true };
}
