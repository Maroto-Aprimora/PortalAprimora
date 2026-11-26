"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { criarClienteServidor } from "@/lib/supabase/server";
import { mensagemDeErro } from "@/lib/erros";
import { hojeBR } from "@/lib/datas";

export type Resultado = { ok: true } | { ok: false; erro: string };

const id = z.guid("Registro inválido.");
const SEM_PERMISSAO = "Só a equipe da Vice-Presidência registra feedbacks (o autor ou o diretor da VP edita; ninguém registra sobre si).";

const esquema = z.object({
  membro_id: id,
  tipo: z.enum(["positivo", "construtivo", "reconhecimento", "ponto_desenvolvimento"], "Escolha o tipo."),
  descricao: z.string().trim().min(2, "Descreva o feedback.").max(4000, "Máximo de 4000 caracteres."),
  dado_em: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Data inválida.").refine((d) => d <= hojeBR(), "A data não pode ser futura."),
  compartilhado: z.boolean(),
  reuniao_id: z.preprocess((v) => (v === "" ? null : v), id.nullable()),
});

function revalidar() {
  revalidatePath("/vice-presidencia/feedbacks");
  revalidatePath("/vice-presidencia/resumo", "layout");
}

export async function salvarFeedback(feedback: string | null, dados: Record<string, unknown>): Promise<Resultado> {
  const v = esquema.safeParse(dados);
  if (!v.success) return { ok: false, erro: v.error.issues[0].message };
  if (feedback && !id.safeParse(feedback).success) return { ok: false, erro: "Registro inválido." };
  const supabase = await criarClienteServidor();
  const { data: sessao } = await supabase.auth.getClaims();
  const { data, error } = feedback
    ? await supabase.from("feedbacks").update(v.data).eq("id", feedback).select("id")
    : await supabase.from("feedbacks").insert({ ...v.data, autor_id: sessao?.claims?.sub ?? null }).select("id");
  if (error) return { ok: false, erro: error.code === "42501" ? SEM_PERMISSAO : mensagemDeErro(error) };
  if (!data?.length) return { ok: false, erro: SEM_PERMISSAO };
  revalidar();
  return { ok: true };
}

export async function excluirFeedback(feedback: string): Promise<Resultado> {
  if (!id.safeParse(feedback).success) return { ok: false, erro: "Registro inválido." };
  const supabase = await criarClienteServidor();
  const { data, error } = await supabase.from("feedbacks").delete().eq("id", feedback).select("id");
  if (error) return { ok: false, erro: mensagemDeErro(error) };
  if (!data?.length) return { ok: false, erro: SEM_PERMISSAO };
  revalidar();
  return { ok: true };
}
