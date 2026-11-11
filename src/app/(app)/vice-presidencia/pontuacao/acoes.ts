"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { criarClienteServidor } from "@/lib/supabase/server";
import { mensagemDeErro } from "@/lib/erros";

export type Resultado = { ok: true } | { ok: false; erro: string };

const esquema = z.object({
  membro_id: z.guid("Escolha o membro."),
  pontos: z.preprocess((v) => Number(v), z.number().int().min(-12).max(12).refine((n) => n !== 0, "Informe os pontos.")),
  motivo: z.string().trim().min(3, "Descreva o motivo."),
  data: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Data inválida."),
});

function revalidar() {
  revalidatePath("/vice-presidencia/pontuacao");
  revalidatePath("/painel");
}

/** Lança pontos (positivo) ou abono (negativo). Só a diretoria da Vice-Presidência consegue (RLS). */
export async function lancarPontos(dados: Record<string, unknown>): Promise<Resultado> {
  const v = esquema.safeParse(dados);
  if (!v.success) return { ok: false, erro: v.error.issues[0].message };
  const supabase = await criarClienteServidor();
  const { error } = await supabase.from("pontuacoes").insert(v.data);
  if (error) return { ok: false, erro: mensagemDeErro(error) };
  revalidar();
  return { ok: true };
}

export async function cancelarLancamento(id: string): Promise<Resultado> {
  const supabase = await criarClienteServidor();
  const { data, error } = await supabase.from("pontuacoes").update({ cancelado_em: new Date().toISOString() }).eq("id", id).is("cancelado_em", null).select("id");
  if (error) return { ok: false, erro: mensagemDeErro(error) };
  if (!data?.length) return { ok: false, erro: "Só a Vice-Presidência cancela lançamentos." };
  revalidar();
  return { ok: true };
}
