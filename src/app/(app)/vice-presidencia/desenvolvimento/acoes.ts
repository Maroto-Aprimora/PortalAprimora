"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { criarClienteServidor } from "@/lib/supabase/server";
import { mensagemDeErro } from "@/lib/erros";

export type Resultado = { ok: true; id?: string } | { ok: false; erro: string };

const id = z.guid("Registro inválido.");
const vazioNulo = (v: unknown) => (typeof v === "string" && v.trim() === "" ? null : v);
const STATUS = z.enum(["nao_iniciado", "em_andamento", "concluido", "pausado", "cancelado"]);
const SEM_PERMISSAO = "Só a equipe da Vice-Presidência altera objetivos (e ninguém altera os próprios).";

function revalidar() {
  revalidatePath("/vice-presidencia/desenvolvimento");
  revalidatePath("/vice-presidencia/resumo", "layout");
}
const falha = (e: { code?: string; message: string }): Resultado => ({ ok: false, erro: e.code === "42501" ? SEM_PERMISSAO : mensagemDeErro(e) });

const esquemaObjetivo = z.object({
  membro_id: id,
  titulo: z.string().trim().min(2, "Dê um título ao objetivo.").max(160, "Máximo de 160 caracteres."),
  descricao: z.preprocess(vazioNulo, z.string().trim().max(4000).nullable()),
  competencia: z.preprocess(vazioNulo, z.string().trim().max(120).nullable()),
  prazo: z.preprocess(vazioNulo, z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Data inválida.").nullable()),
  status: STATUS,
  compartilhado: z.boolean(),
  reuniao_id: z.preprocess(vazioNulo, id.nullable()),
});

export async function salvarObjetivo(objetivo: string | null, dados: Record<string, unknown>): Promise<Resultado> {
  const v = esquemaObjetivo.safeParse(dados);
  if (!v.success) return { ok: false, erro: v.error.issues[0].message };
  if (objetivo && !id.safeParse(objetivo).success) return { ok: false, erro: "Registro inválido." };
  const supabase = await criarClienteServidor();
  const { data, error } = objetivo
    ? await supabase.from("objetivos_desenvolvimento").update(v.data).eq("id", objetivo).select("id")
    : await supabase.from("objetivos_desenvolvimento").insert(v.data).select("id");
  if (error) return falha(error);
  if (!data?.length) return { ok: false, erro: SEM_PERMISSAO };
  revalidar();
  return { ok: true, id: data[0].id };
}

export async function excluirObjetivo(objetivo: string): Promise<Resultado> {
  if (!id.safeParse(objetivo).success) return { ok: false, erro: "Registro inválido." };
  const supabase = await criarClienteServidor();
  const { data, error } = await supabase.from("objetivos_desenvolvimento").delete().eq("id", objetivo).select("id");
  if (error) return falha(error);
  if (!data?.length) return { ok: false, erro: SEM_PERMISSAO };
  revalidar();
  return { ok: true };
}

export async function adicionarEtapa(objetivo: string, titulo: string, prazo: string, ordem: number): Promise<Resultado> {
  const t = titulo.trim();
  if (!id.safeParse(objetivo).success) return { ok: false, erro: "Registro inválido." };
  if (t.length < 1 || t.length > 200) return { ok: false, erro: "Descreva a etapa (até 200 caracteres)." };
  const supabase = await criarClienteServidor();
  const { error } = await supabase.from("objetivo_etapas").insert({ objetivo_id: objetivo, titulo: t, prazo: prazo || null, ordem });
  if (error) return falha(error);
  revalidar();
  return { ok: true };
}

export async function alternarEtapa(etapa: string, feita: boolean): Promise<Resultado> {
  if (!id.safeParse(etapa).success) return { ok: false, erro: "Registro inválido." };
  const supabase = await criarClienteServidor();
  const { data, error } = await supabase.from("objetivo_etapas").update({ feita }).eq("id", etapa).select("id");
  if (error) return falha(error);
  if (!data?.length) return { ok: false, erro: SEM_PERMISSAO };
  revalidar();
  return { ok: true };
}

export async function excluirEtapa(etapa: string): Promise<Resultado> {
  if (!id.safeParse(etapa).success) return { ok: false, erro: "Registro inválido." };
  const supabase = await criarClienteServidor();
  const { data, error } = await supabase.from("objetivo_etapas").delete().eq("id", etapa).select("id");
  if (error) return falha(error);
  if (!data?.length) return { ok: false, erro: SEM_PERMISSAO };
  revalidar();
  return { ok: true };
}

/** Registra a evolução; se vier um status, o objetivo passa a ter esse status. */
export async function adicionarAtualizacao(objetivo: string, texto: string, status: string): Promise<Resultado> {
  if (!id.safeParse(objetivo).success) return { ok: false, erro: "Registro inválido." };
  const t = texto.trim();
  if (t.length < 2 || t.length > 4000) return { ok: false, erro: "Escreva a atualização (até 4000 caracteres)." };
  const s = status ? STATUS.safeParse(status) : null;
  if (s && !s.success) return { ok: false, erro: "Situação inválida." };
  const supabase = await criarClienteServidor();
  const { data: sessao } = await supabase.auth.getClaims();
  const { error } = await supabase.from("objetivo_atualizacoes").insert({
    objetivo_id: objetivo, texto: t, status: s?.data ?? null, autor_id: sessao?.claims?.sub ?? null,
  });
  if (error) return falha(error);
  if (s?.data) {
    const { error: e2 } = await supabase.from("objetivos_desenvolvimento").update({ status: s.data }).eq("id", objetivo);
    if (e2) return falha(e2);
  }
  revalidar();
  return { ok: true };
}
